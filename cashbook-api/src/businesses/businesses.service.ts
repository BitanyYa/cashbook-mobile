import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBusinessDto) {
    const userBigIntId = BigInt(userId);
    const currency = dto.currency && dto.currency.trim() !== '' ? dto.currency.trim() : 'USD';

    const business = await this.prisma.businesses.create({
      data: {
        name: dto.name.trim(),
        currency,
      },
    });

    const businessUser = await this.prisma.business_user.create({
      data: {
        business_id: business.id,
        user_id: userBigIntId,
        role: 'owner',
      },
    });

    return {
      id: business.id.toString(),
      name: business.name,
      currency: business.currency,
      role: businessUser.role,
    };
  }

  async findAllForUser(userId: string) {
    const userBigIntId = BigInt(userId);

    const records = await this.prisma.business_user.findMany({
      where: {
        user_id: userBigIntId,
        businesses: {
          deleted_at: null,
        },
      },
      include: {
        businesses: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    const businesses = records.map((bu) => ({
      id: bu.businesses.id.toString(),
      name: bu.businesses.name,
      currency: bu.businesses.currency,
      role: bu.role,
    }));

    return {
      businesses,
    };
  }

  async findOneForUser(id: string, userId: string) {
    let businessBigIntId: bigint;
    try {
      businessBigIntId = BigInt(id);
    } catch {
      throw new NotFoundException('Business not found or access denied');
    }

    const userBigIntId = BigInt(userId);
    const bu = await this.prisma.business_user.findFirst({
      where: {
        business_id: businessBigIntId,
        user_id: userBigIntId,
        businesses: {
          deleted_at: null,
        },
      },
      include: {
        businesses: true,
      },
    });

    if (!bu || !bu.businesses) {
      throw new NotFoundException('Business not found or access denied');
    }

    return {
      id: bu.businesses.id.toString(),
      name: bu.businesses.name,
      currency: bu.businesses.currency,
      role: bu.role,
    };
  }

  async getMembersForBusiness(businessId: string, userId: string) {
    let bId: bigint;
    let uId: bigint;
    try {
      bId = BigInt(businessId);
      uId = BigInt(userId);
    } catch {
      throw new NotFoundException('Business not found or access denied');
    }

    // Verify current user membership
    const currentUserMembership = await this.prisma.business_user.findFirst({
      where: {
        business_id: bId,
        user_id: uId,
      },
    });

    if (!currentUserMembership) {
      throw new NotFoundException('Business not found or access denied');
    }

    const members = await this.prisma.business_user.findMany({
      where: {
        business_id: bId,
      },
      include: {
        users: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return {
      members: members.map((m) => ({
        id: m.users.id.toString(),
        name: m.users.name || 'Member',
        email: m.users.email,
        role: m.role,
      })),
    };
  }

  async getContactNamesForBusiness(businessId: string, userId: string, query?: string) {
    let bId: bigint;
    let uId: bigint;
    try {
      bId = BigInt(businessId);
      uId = BigInt(userId);
    } catch {
      throw new NotFoundException('Business not found or access denied');
    }

    const membership = await this.prisma.business_user.findFirst({
      where: {
        business_id: bId,
        user_id: uId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Business not found or access denied');
    }

    const whereInput: any = {
      business_id: bId,
      deleted_at: null,
      contact_name: {
        not: null,
      },
    };

    if (query && query.trim() !== '') {
      whereInput.contact_name = {
        contains: query.trim(),
      };
    }

    const records = await this.prisma.transactions.findMany({
      where: whereInput,
      select: {
        contact_name: true,
      },
      distinct: ['contact_name'],
    });

    const seen = new Set<string>();
    const contactNames: string[] = [];

    for (const r of records) {
      const name = r.contact_name?.trim();
      if (name && name.length > 0) {
        const lower = name.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          contactNames.push(name);
        }
      }
    }

    contactNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return {
      contactNames,
    };
  }

  async getContactTransactionsForBusiness(
    businessId: string,
    userId: string,
    params: {
      contact_name: string;
      book_id?: string;
      type?: string;
      from_date?: string;
      to_date?: string;
      search?: string;
    },
  ) {
    let bId: bigint;
    let uId: bigint;
    try {
      bId = BigInt(businessId);
      uId = BigInt(userId);
    } catch {
      throw new NotFoundException('Business not found or access denied');
    }

    const membership = await this.prisma.business_user.findFirst({
      where: {
        business_id: bId,
        user_id: uId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Business not found or access denied');
    }

    if (!params.contact_name || params.contact_name.trim() === '') {
      throw new BadRequestException('contact_name query parameter is required');
    }

    const trimmedContact = params.contact_name.trim();

    const whereClause: any = {
      business_id: bId,
      deleted_at: null,
      contact_name: {
        equals: trimmedContact,
      },
    };

    if (params.book_id && params.book_id !== 'all' && params.book_id.trim() !== '') {
      try {
        const bkId = BigInt(params.book_id);
        const bookExists = await this.prisma.books.findFirst({
          where: {
            id: bkId,
            business_id: bId,
            deleted_at: null,
          },
        });
        if (!bookExists) {
          throw new NotFoundException('Book not found in this business');
        }
        whereClause.book_id = bkId;
      } catch (err) {
        if (err instanceof NotFoundException) throw err;
        throw new BadRequestException('Invalid book_id parameter');
      }
    }

    if (params.type === 'income' || params.type === 'expense') {
      whereClause.type = params.type;
    }

    if (params.from_date || params.to_date) {
      const dateFilter: any = {};
      if (params.from_date && params.from_date.trim() !== '') {
        const trimmedFrom = params.from_date.split('T')[0];
        dateFilter.gte = new Date(trimmedFrom + 'T00:00:00.000Z');
      }
      if (params.to_date && params.to_date.trim() !== '') {
        const trimmedTo = params.to_date.split('T')[0];
        dateFilter.lte = new Date(trimmedTo + 'T23:59:59.999Z');
      }
      whereClause.transaction_date = dateFilter;
    }

    const search = (params.search || '').trim();
    if (search !== '') {
      const searchConditions: any[] = [
        { description: { contains: search } },
      ];
      const numVal = parseFloat(search);
      if (!isNaN(numVal)) {
        searchConditions.push({ amount: { equals: new Prisma.Decimal(search) } });
      }
      whereClause.OR = searchConditions;
    }

    const list = await this.prisma.transactions.findMany({
      where: whereClause,
      include: {
        categories: true,
        users_transactions_user_idTousers: true,
        transaction_attachments: true,
        books: true,
      },
      orderBy: [
        { transaction_date: 'desc' },
        { created_at: 'desc' },
        { id: 'desc' },
      ],
    });

    let totalIncome = 0;
    let totalExpense = 0;

    const transactions = list.map((tx) => {
      const amountNum = parseFloat(tx.amount != null ? tx.amount.toString() : '0');
      if (tx.type === 'income') {
        totalIncome += amountNum;
      } else {
        totalExpense += amountNum;
      }

      const rawAttachments = tx.transaction_attachments || [];
      const attachments = rawAttachments.map((att: any) => ({
        id: att.id.toString(),
        filePath: att.file_path,
        originalName: att.original_name || 'Attachment',
        mimeType: att.mime_type || 'application/octet-stream',
        fileSize: att.file_size ? Number(att.file_size) : null,
        url: att.file_path.startsWith('http')
          ? att.file_path
          : `/uploads/${att.file_path.replace(/^\/?(uploads\/)?/, '')}`,
      }));

      return {
        id: tx.id ? tx.id.toString() : '',
        businessId: tx.business_id ? tx.business_id.toString() : '',
        bookId: tx.book_id ? tx.book_id.toString() : '',
        bookName: tx.books?.name || null,
        categoryId: tx.category_id ? tx.category_id.toString() : null,
        userId: tx.user_id ? tx.user_id.toString() : null,
        amount: tx.amount != null ? tx.amount.toString() : '0',
        type: tx.type || 'income',
        mode: tx.mode || null,
        imagePath: tx.image_path || (attachments.length > 0 ? attachments[0].filePath : null),
        image_path: tx.image_path || (attachments.length > 0 ? attachments[0].filePath : null),
        attachments,
        status: tx.status || 'approved',
        description: tx.description || null,
        contactName: tx.contact_name || null,
        transactionDate: tx.transaction_date || tx.created_at || new Date().toISOString(),
        createdAt: tx.created_at || null,
        updatedAt: tx.updated_at || null,
        category: tx.categories && tx.categories.id
          ? {
              id: tx.categories.id.toString(),
              name: tx.categories.name || '',
              type: tx.categories.type || null,
            }
          : null,
        user: tx.users_transactions_user_idTousers
          ? {
              id: tx.users_transactions_user_idTousers.id.toString(),
              name: tx.users_transactions_user_idTousers.name || 'Member',
              email: tx.users_transactions_user_idTousers.email,
            }
          : null,
        book: tx.books
          ? {
              id: tx.books.id.toString(),
              name: tx.books.name,
            }
          : null,
      };
    });

    const netBalance = totalIncome - totalExpense;

    return {
      contactName: trimmedContact,
      transactions,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netBalance: netBalance.toFixed(2),
      totalCount: transactions.length,
    };
  }

}
