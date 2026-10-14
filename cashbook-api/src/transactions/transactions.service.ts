import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import * as fs from 'fs';
import * as path from 'path';

export interface TransactionQueryParams {
  search?: string;
  q?: string;
  type?: string;
  category_id?: string;
  contact_name?: string;
  member_id?: string;
  mode?: string;
  from_date?: string;
  to_date?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeTransaction(tx: any) {
    if (!tx) return null;

    const rawAttachments = tx.transaction_attachments || [];
    const attachments: Array<{
      id: string;
      filePath: string;
      originalName: string;
      mimeType: string;
      fileSize: number | null;
      url: string;
    }> = rawAttachments.map((att: any) => ({
      id: att.id.toString(),
      filePath: att.file_path,
      originalName: att.original_name || 'Attachment',
      mimeType: att.mime_type || 'application/octet-stream',
      fileSize: att.file_size ? Number(att.file_size) : null,
      url: att.file_path.startsWith('http')
        ? att.file_path
        : `/uploads/${att.file_path.replace(/^\/?(uploads\/)?/, '')}`,
    }));

    if (tx.image_path) {
      let legacyPaths: string[] = [];
      try {
        if (tx.image_path.startsWith('[')) {
          legacyPaths = JSON.parse(tx.image_path);
        } else {
          legacyPaths = [tx.image_path];
        }
      } catch {
        legacyPaths = [tx.image_path];
      }

      legacyPaths.forEach((pathStr, idx) => {
        const alreadyIncluded = attachments.some((a) => a.filePath === pathStr);
        if (!alreadyIncluded && pathStr) {
          const isPdf = pathStr.toLowerCase().endsWith('.pdf');
          attachments.push({
            id: `legacy-${idx}`,
            filePath: pathStr,
            originalName: pathStr.split('/').pop() || `Receipt ${idx + 1}`,
            mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
            fileSize: null,
            url: pathStr.startsWith('http')
              ? pathStr
              : `/uploads/${pathStr.replace(/^\/?(uploads\/)?/, '')}`,
          });
        }
      });
    }

    const firstImage = attachments.length > 0 ? attachments[0].filePath : null;

    return {
      id: tx.id ? tx.id.toString() : '',
      businessId: tx.business_id ? tx.business_id.toString() : '',
      bookId: tx.book_id ? tx.book_id.toString() : '',
      categoryId: tx.category_id ? tx.category_id.toString() : null,
      userId: tx.user_id ? tx.user_id.toString() : null,
      amount: tx.amount != null ? tx.amount.toString() : '0',
      type: tx.type || 'income',
      mode: tx.mode || null,
      imagePath: tx.image_path || firstImage,
      image_path: tx.image_path || firstImage,
      attachments,
      status: tx.status || 'approved',
      description: tx.description || null,
      contactName: tx.contact_name || null,
      transactionDate: tx.transaction_date || tx.created_at || new Date().toISOString(),
      createdAt: tx.created_at || null,
      updatedAt: tx.updated_at || null,
      category:
        tx.categories && tx.categories.id
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
    };
  }

  private async verifyBookAccess(userId: string, businessId: string, bookId: string) {
    let bId: bigint;
    let bkId: bigint;
    let uId: bigint;

    try {
      bId = BigInt(businessId);
      bkId = BigInt(bookId);
      uId = BigInt(userId);
    } catch {
      throw new NotFoundException('Book not found or access denied');
    }

    const membership = await this.prisma.business_user.findFirst({
      where: {
        business_id: bId,
        user_id: uId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Book not found or access denied');
    }

    const book = await this.prisma.books.findFirst({
      where: {
        id: bkId,
        business_id: bId,
        deleted_at: null,
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found or access denied');
    }

    return { bId, bkId, uId };
  }

  private async validateCategory(
    bId: bigint,
    categoryIdStr: string,
  ): Promise<bigint> {
    let catId: bigint;
    try {
      catId = BigInt(categoryIdStr);
    } catch {
      throw new BadRequestException('Invalid category_id');
    }

    const category = await this.prisma.categories.findFirst({
      where: {
        id: catId,
        business_id: bId,
      },
    });

    if (!category) {
      throw new BadRequestException(
        'Category not found or does not belong to this business',
      );
    }

    return catId;
  }

  async create(
    userId: string,
    businessId: string,
    bookId: string,
    dto: CreateTransactionDto,
    files?: Array<Express.Multer.File>,
  ) {
    const { bId, bkId, uId } = await this.verifyBookAccess(userId, businessId, bookId);

    const amountNum = parseFloat(dto.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('amount must be greater than 0');
    }

    let dateObj: Date;
    try {
      const trimmedDate = dto.transaction_date.split('T')[0];
      dateObj = new Date(trimmedDate + 'T12:00:00.000Z');
      if (isNaN(dateObj.getTime())) {
        throw new BadRequestException('Invalid transaction_date format');
      }
    } catch {
      throw new BadRequestException('Invalid transaction_date format');
    }

    let catId: bigint | undefined = undefined;
    if (dto.category_id) {
      catId = await this.validateCategory(bId, dto.category_id);
    }

    const tx = await this.prisma.transactions.create({
      data: {
        business_id: bId,
        book_id: bkId,
        user_id: uId,
        category_id: catId,
        type: dto.type,
        amount: new Prisma.Decimal(dto.amount),
        transaction_date: dateObj,
        mode: dto.mode || 'Cash',
        contact_name: dto.contact_name || null,
        description: dto.description || null,
        status: 'approved',
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        categories: true,
        users_transactions_user_idTousers: true,
        transaction_attachments: true,
      },
    });

    if (files && files.length > 0) {
      await this.saveUploadedFiles(tx.id, files);
      const reloadedTx = await this.prisma.transactions.findFirst({
        where: { id: tx.id },
        include: {
          categories: true,
          users_transactions_user_idTousers: true,
          transaction_attachments: true,
        },
      });
      return this.serializeTransaction(reloadedTx);
    }

    return this.serializeTransaction(tx);
  }

  async findAll(
    userId: string,
    businessId: string,
    bookId: string,
    queryParams?: TransactionQueryParams,
  ) {
    const { bId, bkId } = await this.verifyBookAccess(userId, businessId, bookId);

    const whereClause: Prisma.transactionsWhereInput = {
      business_id: bId,
      book_id: bkId,
      deleted_at: null,
    };

    if (queryParams?.type === 'income' || queryParams?.type === 'expense') {
      whereClause.type = queryParams.type;
    }

    if (
      queryParams?.category_id &&
      queryParams.category_id !== 'all' &&
      queryParams.category_id !== ''
    ) {
      try {
        const catId = BigInt(queryParams.category_id);
        const categoryExists = await this.prisma.categories.findFirst({
          where: { id: catId, business_id: bId },
        });
        if (!categoryExists) {
          throw new BadRequestException('Category does not belong to this business');
        }
        whereClause.category_id = catId;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
      }
    }

    if (queryParams?.contact_name && queryParams.contact_name.trim() !== '') {
      whereClause.contact_name = {
        contains: queryParams.contact_name.trim(),
      };
    }

    if (
      queryParams?.member_id &&
      queryParams.member_id !== 'all' &&
      queryParams.member_id !== ''
    ) {
      try {
        const memBigIntId = BigInt(queryParams.member_id);
        const isMember = await this.prisma.business_user.findFirst({
          where: {
            business_id: bId,
            user_id: memBigIntId,
          },
        });
        if (!isMember) {
          throw new ForbiddenException('Member does not belong to this business');
        }
        whereClause.user_id = memBigIntId;
      } catch (err) {
        if (err instanceof ForbiddenException || err instanceof BadRequestException) throw err;
      }
    }

    if (
      queryParams?.mode &&
      queryParams.mode.toLowerCase() !== 'all' &&
      queryParams.mode.trim() !== ''
    ) {
      whereClause.mode = queryParams.mode.trim();
    }

    if (queryParams?.status && queryParams.status !== 'all' && queryParams.status !== '') {
      whereClause.status = queryParams.status as any;
    }

    const startDateStr = queryParams?.from_date || queryParams?.start_date;
    const endDateStr = queryParams?.to_date || queryParams?.end_date;

    if (startDateStr || endDateStr) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDateStr && startDateStr.trim() !== '') {
        const trimmedFrom = startDateStr.split('T')[0];
        dateFilter.gte = new Date(trimmedFrom + 'T00:00:00.000Z');
      }
      if (endDateStr && endDateStr.trim() !== '') {
        const trimmedTo = endDateStr.split('T')[0];
        dateFilter.lte = new Date(trimmedTo + 'T23:59:59.999Z');
      }
      whereClause.transaction_date = dateFilter;
    }

    const search = (queryParams?.search || queryParams?.q || '').trim();
    if (search !== '') {
      const searchConditions: Prisma.transactionsWhereInput[] = [
        { description: { contains: search } },
        { contact_name: { contains: search } },
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
      },
      orderBy: [
        { transaction_date: 'desc' },
        { created_at: 'desc' },
        { id: 'desc' },
      ],
    });

    return {
      transactions: list.map((tx) => this.serializeTransaction(tx)),
    };
  }

  async findOne(userId: string, businessId: string, bookId: string, id: string) {
    const { bId, bkId } = await this.verifyBookAccess(userId, businessId, bookId);

    let txId: bigint;
    try {
      txId = BigInt(id);
    } catch {
      throw new NotFoundException('Transaction not found or access denied');
    }

    const tx = await this.prisma.transactions.findFirst({
      where: {
        id: txId,
        business_id: bId,
        book_id: bkId,
        deleted_at: null,
      },
      include: {
        categories: true,
        users_transactions_user_idTousers: true,
        transaction_attachments: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    return this.serializeTransaction(tx);
  }

  async update(
    userId: string,
    businessId: string,
    bookId: string,
    id: string,
    dto: UpdateTransactionDto,
    files?: Array<Express.Multer.File>,
  ) {
    const { bId, bkId } = await this.verifyBookAccess(userId, businessId, bookId);

    let txId: bigint;
    try {
      txId = BigInt(id);
    } catch {
      throw new NotFoundException('Transaction not found or access denied');
    }

    const existingTx = await this.prisma.transactions.findFirst({
      where: {
        id: txId,
        business_id: bId,
        book_id: bkId,
        deleted_at: null,
      },
    });

    if (!existingTx) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    let parsedDecimal: Prisma.Decimal | undefined;
    if (dto.amount !== undefined) {
      const amountNum = parseFloat(dto.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new BadRequestException('amount must be greater than 0');
      }
      parsedDecimal = new Prisma.Decimal(dto.amount);
    }

    let dateObj: Date | undefined;
    if (dto.transaction_date !== undefined) {
      try {
        const trimmedDate = dto.transaction_date.split('T')[0];
        dateObj = new Date(trimmedDate + 'T12:00:00.000Z');
        if (isNaN(dateObj.getTime())) {
          throw new BadRequestException('Invalid transaction_date format');
        }
      } catch {
        throw new BadRequestException('Invalid transaction_date format');
      }
    }

    let updatedCatId: bigint | null | undefined = undefined;

    if (dto.category_id !== undefined) {
      if (
        dto.category_id === null ||
        dto.category_id === '' ||
        dto.category_id === 'null'
      ) {
        updatedCatId = null;
      } else {
        updatedCatId = await this.validateCategory(bId, dto.category_id);
      }
    }

    await this.prisma.transactions.update({
      where: { id: txId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(parsedDecimal !== undefined ? { amount: parsedDecimal } : {}),
        ...(dateObj !== undefined ? { transaction_date: dateObj } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.contact_name !== undefined ? { contact_name: dto.contact_name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(updatedCatId !== undefined ? { category_id: updatedCatId } : {}),
        updated_at: new Date(),
      },
    });

    if (files && files.length > 0) {
      await this.saveUploadedFiles(txId, files);
    }

    const reloaded = await this.prisma.transactions.findFirst({
      where: { id: txId },
      include: {
        categories: true,
        users_transactions_user_idTousers: true,
        transaction_attachments: true,
      },
    });

    return this.serializeTransaction(reloaded);
  }

  async addAttachments(
    userId: string,
    businessId: string,
    bookId: string,
    id: string,
    files: Array<Express.Multer.File>,
  ) {
    const { bId, bkId } = await this.verifyBookAccess(userId, businessId, bookId);

    let txId: bigint;
    try {
      txId = BigInt(id);
    } catch {
      throw new NotFoundException('Transaction not found or access denied');
    }

    const tx = await this.prisma.transactions.findFirst({
      where: {
        id: txId,
        business_id: bId,
        book_id: bkId,
        deleted_at: null,
      },
      include: {
        transaction_attachments: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    const currentCount = tx.transaction_attachments.length;
    if (currentCount + files.length > 5) {
      throw new BadRequestException(
        `Maximum 5 attachments allowed per transaction. Current: ${currentCount}, adding: ${files.length}`,
      );
    }

    await this.saveUploadedFiles(txId, files);

    const reloaded = await this.prisma.transactions.findFirst({
      where: { id: txId },
      include: {
        categories: true,
        users_transactions_user_idTousers: true,
        transaction_attachments: true,
      },
    });

    return this.serializeTransaction(reloaded);
  }

  async deleteAttachment(
    userId: string,
    businessId: string,
    bookId: string,
    id: string,
    attachmentId: string,
  ) {
    const { bId, bkId } = await this.verifyBookAccess(userId, businessId, bookId);

    let txId: bigint;
    let attId: bigint;
    try {
      txId = BigInt(id);
      attId = BigInt(attachmentId);
    } catch {
      throw new NotFoundException('Attachment not found or access denied');
    }

    const tx = await this.prisma.transactions.findFirst({
      where: {
        id: txId,
        business_id: bId,
        book_id: bkId,
        deleted_at: null,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    const att = await this.prisma.transaction_attachments.findFirst({
      where: {
        id: attId,
        transaction_id: txId,
      },
    });

    if (!att) {
      throw new NotFoundException('Attachment not found');
    }

    try {
      const cleanPath = att.file_path.replace(/^\/?(uploads\/)?/, '');
      const fullPath = path.join(process.cwd(), 'uploads', cleanPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (e) {
      console.warn('Failed to delete physical file:', e);
    }

    await this.prisma.transaction_attachments.delete({
      where: { id: attId },
    });

    if (tx.image_path === att.file_path) {
      const nextAtt = await this.prisma.transaction_attachments.findFirst({
        where: { transaction_id: txId },
        orderBy: { created_at: 'asc' },
      });
      await this.prisma.transactions.update({
        where: { id: txId },
        data: { image_path: nextAtt ? nextAtt.file_path : null },
      });
    }

    const reloaded = await this.prisma.transactions.findFirst({
      where: { id: txId },
      include: {
        categories: true,
        users_transactions_user_idTousers: true,
        transaction_attachments: true,
      },
    });

    return this.serializeTransaction(reloaded);
  }

  async remove(userId: string, businessId: string, bookId: string, id: string) {
    const { bId, bkId } = await this.verifyBookAccess(userId, businessId, bookId);

    let txId: bigint;
    try {
      txId = BigInt(id);
    } catch {
      throw new NotFoundException('Transaction not found or access denied');
    }

    const existingTx = await this.prisma.transactions.findFirst({
      where: {
        id: txId,
        business_id: bId,
        book_id: bkId,
        deleted_at: null,
      },
    });

    if (!existingTx) {
      throw new NotFoundException('Transaction not found or access denied');
    }

    await this.prisma.transactions.update({
      where: { id: txId },
      data: {
        deleted_at: new Date(),
      },
    });

    return { message: 'Transaction deleted successfully' };
  }

  private async saveUploadedFiles(txId: bigint, files: Array<Express.Multer.File>) {
    let firstPath: string | null = null;
    for (const file of files) {
      const relativePath = `attachments/${file.filename}`;
      if (!firstPath) firstPath = relativePath;
      await this.prisma.transaction_attachments.create({
        data: {
          transaction_id: txId,
          file_path: relativePath,
          original_name: file.originalname,
          mime_type: file.mimetype,
          file_size: file.size,
        },
      });
    }

    if (firstPath) {
      const tx = await this.prisma.transactions.findFirst({ where: { id: txId } });
      if (tx && !tx.image_path) {
        await this.prisma.transactions.update({
          where: { id: txId },
          data: { image_path: firstPath },
        });
      }
    }
  }

  async exportCsv(
    userId: string,
    businessId: string,
    bookId: string,
    queryParams?: any,
  ) {
    const { bId, bkId } = await this.verifyBookAccess(userId, businessId, bookId);

    const book = await this.prisma.books.findUnique({
      where: { id: bkId },
      select: { name: true },
    });

    const whereClause: Prisma.transactionsWhereInput = {
      business_id: bId,
      book_id: bkId,
      deleted_at: null,
    };

    if (queryParams?.type === 'income' || queryParams?.type === 'expense') {
      whereClause.type = queryParams.type;
    }

    if (
      queryParams?.category_id &&
      queryParams.category_id !== 'all' &&
      queryParams.category_id !== ''
    ) {
      try {
        whereClause.category_id = BigInt(queryParams.category_id);
      } catch {}
    }

    if (queryParams?.contact_name && queryParams.contact_name.trim() !== '') {
      whereClause.contact_name = {
        contains: queryParams.contact_name.trim(),
      };
    }

    if (
      queryParams?.member_id &&
      queryParams.member_id !== 'all' &&
      queryParams.member_id !== ''
    ) {
      try {
        whereClause.user_id = BigInt(queryParams.member_id);
      } catch {}
    }

    if (
      queryParams?.mode &&
      queryParams.mode.toLowerCase() !== 'all' &&
      queryParams.mode.trim() !== ''
    ) {
      whereClause.mode = queryParams.mode.trim();
    }

    const startDateStr = queryParams?.from_date || queryParams?.start_date;
    const endDateStr = queryParams?.to_date || queryParams?.end_date;

    if (startDateStr || endDateStr) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDateStr && startDateStr.trim() !== '') {
        const trimmedFrom = startDateStr.split('T')[0];
        dateFilter.gte = new Date(trimmedFrom + 'T00:00:00.000Z');
      }
      if (endDateStr && endDateStr.trim() !== '') {
        const trimmedTo = endDateStr.split('T')[0];
        dateFilter.lte = new Date(trimmedTo + 'T23:59:59.999Z');
      }
      whereClause.transaction_date = dateFilter;
    }

    const search = (queryParams?.search || queryParams?.q || '').trim();
    if (search !== '') {
      const searchConditions: Prisma.transactionsWhereInput[] = [
        { description: { contains: search } },
        { contact_name: { contains: search } },
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
      },
      orderBy: [
        { transaction_date: 'desc' },
        { created_at: 'desc' },
        { id: 'desc' },
      ],
    });

    const headers = [
      'Transaction Date',
      'Type',
      'Amount',
      'Contact Name',
      'Category',
      'Payment Mode',
      'Description',
      'Created At',
    ];

    const escapeCsv = (val: any) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = list.map((tx) => {
      const dateStr = tx.transaction_date
        ? tx.transaction_date.toISOString().split('T')[0]
        : '';
      const typeStr = tx.type === 'income' ? 'Cash In' : 'Cash Out';
      const amountStr = tx.amount != null ? tx.amount.toString() : '0';
      const contactStr = tx.contact_name || '';
      const catStr = tx.categories?.name || '';
      const modeStr = tx.mode || '';
      const descStr = tx.description || '';
      const createdAtStr = tx.created_at ? tx.created_at.toISOString() : '';

      return [
        dateStr,
        typeStr,
        amountStr,
        contactStr,
        catStr,
        modeStr,
        descStr,
        createdAtStr,
      ];
    });

    const csvContent =
      '\uFEFF' +
      [
        headers.map(escapeCsv).join(','),
        ...rows.map((r) => r.map(escapeCsv).join(',')),
      ].join('\r\n');

    const cleanBookName = (book?.name || 'book')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();
    const dateTag = new Date().toISOString().split('T')[0];
    const filename = `${cleanBookName}_transactions_${dateTag}.csv`;

    return {
      filename,
      csv: csvContent,
      count: list.length,
    };
  }

  async previewImportCsv(
    userId: string,
    businessId: string,
    bookId: string,
    payload: { rows?: any[]; csvContent?: string },
  ) {
    const { bId, bkId } = await this.verifyBookAccess(userId, businessId, bookId);

    let rawRows: any[] = [];
    if (Array.isArray(payload.rows)) {
      rawRows = payload.rows;
    } else if (typeof payload.csvContent === 'string' && payload.csvContent.trim()) {
      rawRows = this.parseCsvToObjects(payload.csvContent);
    } else {
      throw new BadRequestException('No CSV rows or content provided for import');
    }

    if (rawRows.length === 0) {
      throw new BadRequestException('CSV file is empty or contains only headers');
    }

    if (rawRows.length > 2000) {
      throw new BadRequestException('CSV exceeds maximum limit of 2,000 transactions per import');
    }

    // Fetch existing categories for business
    const categories = await this.prisma.categories.findMany({
      where: { business_id: bId },
      select: { id: true, name: true, type: true },
    });

    const categoryMap = new Map<string, { id: bigint; name: string }>();
    for (const cat of categories) {
      categoryMap.set(cat.name.trim().toLowerCase(), { id: cat.id, name: cat.name });
    }

    // Fetch existing transactions in book to check duplicates
    const existing = await this.prisma.transactions.findMany({
      where: { business_id: bId, book_id: bkId, deleted_at: null },
      select: {
        transaction_date: true,
        amount: true,
        type: true,
        description: true,
      },
    });

    const existingSet = new Set<string>();
    for (const tx of existing) {
      const d = tx.transaction_date.toISOString().split('T')[0];
      const amt = tx.amount != null ? parseFloat(tx.amount.toString()).toFixed(2) : '0.00';
      const key = `${d}|${tx.type}|${amt}|${(tx.description || '').trim().toLowerCase()}`;
      existingSet.add(key);
    }

    const seenInBatch = new Set<string>();
    const rowErrors: Array<{ row: number; errors: string[] }> = [];
    const validRows: Array<{
      rowNumber: number;
      date: string;
      type: 'income' | 'expense';
      amount: number;
      contactName: string | null;
      categoryId: string | null;
      categoryName: string | null;
      originalCategory?: string | null;
      hasUnmatchedCategory?: boolean;
      mode: string | null;
      description: string | null;
      isDuplicate: boolean;
    }> = [];

    const previewRows: any[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 1;
      const errors: string[] = [];

      // Parse Date & Time
      const rawDateStr = (row.date || row.Date || row.transactionDate || row['Transaction Date'] || '').toString().trim();
      const rawTimeStr = (row.time || row.Time || '').toString().trim();
      const parsedDate = this.parseFlexibleDate(rawDateStr, rawTimeStr);
      if (!parsedDate) {
        errors.push(`Invalid or missing date (found: "${rawDateStr}"). Expected YYYY-MM-DD, DD/MM/YYYY or DD MMM YYYY.`);
      }

      // Parse Type & Amount
      let rawType = (row.type || row.Type || row['Transaction Type'] || row['Cash In / Cash Out'] || row.flow || '').toString().trim();
      let rawAmount = (row.amount || row.Amount || row.Total || row.Value || row.amt || '').toString().trim();

      const rawCashIn = row.cashIn !== undefined ? row.cashIn : (row.cash_in !== undefined ? row.cash_in : (row['Cash In'] !== undefined ? row['Cash In'] : row['cash in']));
      const rawCashOut = row.cashOut !== undefined ? row.cashOut : (row.cash_out !== undefined ? row.cash_out : (row['Cash Out'] !== undefined ? row['Cash Out'] : row['cash out']));

      if ((rawCashIn !== undefined || rawCashOut !== undefined) && (!rawType || !rawAmount)) {
        const sIn = String(rawCashIn ?? '').trim();
        const sOut = String(rawCashOut ?? '').trim();
        const inAmt = this.parseAmount(sIn);
        const outAmt = this.parseAmount(sOut);

        if (inAmt != null && outAmt != null) {
          rawType = 'conflict';
          rawAmount = `In: ${sIn}, Out: ${sOut}`;
        } else if (inAmt != null) {
          rawType = 'income';
          rawAmount = sIn;
        } else if (outAmt != null) {
          rawType = 'expense';
          rawAmount = sOut;
        } else if (sIn) {
          rawType = 'income';
          rawAmount = sIn;
        } else if (sOut) {
          rawType = 'expense';
          rawAmount = sOut;
        }
      }

      let parsedType: 'income' | 'expense' | null = null;
      if (rawType === 'conflict') {
        errors.push(`Cannot specify both Cash In and Cash Out in the same row (${rawAmount}).`);
      } else {
        parsedType = this.parseTransactionType(rawType);
        if (!parsedType) {
          errors.push(`Invalid transaction type (found: "${rawType || ''}"). Expected "Cash In" (income) or "Cash Out" (expense).`);
        }
      }

      const parsedAmount = this.parseAmount(rawAmount);
      if (parsedAmount == null && rawType !== 'conflict') {
        errors.push(`Invalid or non-positive amount (found: "${rawAmount || ''}"). Must be a number greater than 0.`);
      }

      // Category Matching
      const rawCategory = (row.category || row.Category || row.categoryName || row['Category Name'] || '').toString().trim();
      let matchedCategory: { id: bigint; name: string } | null = null;
      let hasUnmatchedCategory = false;
      const warnings: string[] = [];

      if (rawCategory) {
        const found = categoryMap.get(rawCategory.toLowerCase());
        if (found) {
          matchedCategory = found;
        } else {
          // Unmatched category: Do not reject row. Import with category_id = null and record warning.
          hasUnmatchedCategory = true;
          warnings.push(`Category "${rawCategory}" not found in this business (will import as unassigned)`);
        }
      }

      // Contact & Mode & Description
      const contactName = (row.contactName || row.contact || row['Contact Name'] || row.Contact || row.party || row.Party || '').toString().trim() || null;
      const mode = (row.mode || row.Mode || row['Payment Mode'] || row.PaymentMode || '').toString().trim() || null;
      const description = (row.description || row.Description || row.Remarks || row.remarks || row.Remark || row.remark || row.memo || '').toString().trim() || null;

      // Duplicate Check
      let isDuplicate = false;
      if (parsedDate && parsedType && parsedAmount != null) {
        const dStr = parsedDate.toISOString().split('T')[0];
        const amtStr = parsedAmount.toFixed(2);
        const descKey = (description || '').toLowerCase();
        const batchKey = `${dStr}|${parsedType}|${amtStr}|${descKey}`;

        if (existingSet.has(batchKey) || seenInBatch.has(batchKey)) {
          isDuplicate = true;
        }
        seenInBatch.add(batchKey);
      }

      if (errors.length > 0) {
        rowErrors.push({ row: rowNum, errors });
      } else if (parsedDate && parsedType && parsedAmount != null) {
        validRows.push({
          rowNumber: rowNum,
          date: parsedDate.toISOString(),
          type: parsedType,
          amount: parsedAmount,
          contactName,
          categoryId: matchedCategory ? matchedCategory.id.toString() : null,
          categoryName: matchedCategory ? matchedCategory.name : null,
          originalCategory: rawCategory || null,
          hasUnmatchedCategory,
          mode,
          description,
          isDuplicate,
        });
      }

      if (i < 10) {
        previewRows.push({
          rowNumber: rowNum,
          rawDate: rawDateStr,
          parsedDate: parsedDate ? parsedDate.toISOString().split('T')[0] : null,
          type: parsedType || rawType || '',
          amount: parsedAmount != null ? parsedAmount : rawAmount,
          contactName,
          categoryName: matchedCategory ? matchedCategory.name : null,
          originalCategory: rawCategory || null,
          hasUnmatchedCategory,
          mode,
          description,
          isValid: errors.length === 0,
          isDuplicate,
          errors,
          warnings,
        });
      }
    }

    const duplicateCount = validRows.filter((r) => r.isDuplicate).length;
    const unmatchedCategoryCount = validRows.filter((r) => r.hasUnmatchedCategory).length;
    const unmatchedCategories = Array.from(
      new Set(
        validRows
          .filter((r) => r.hasUnmatchedCategory && r.originalCategory)
          .map((r) => r.originalCategory as string),
      ),
    );

    return {
      totalRows: rawRows.length,
      validCount: validRows.length,
      errorCount: rowErrors.length,
      duplicateCount,
      unmatchedCategoryCount,
      unmatchedCategories,
      rowErrors: rowErrors.slice(0, 50),
      previewRows,
      validRows,
    };
  }

  async importValidatedRows(
    userId: string,
    businessId: string,
    bookId: string,
    rows: any[],
  ) {
    const { bId, bkId, uId } = await this.verifyBookAccess(userId, businessId, bookId);

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('No transactions provided to import');
    }

    if (rows.length > 2000) {
      throw new BadRequestException('Exceeded maximum of 2,000 transactions per batch');
    }

    // Category cache for re-validation
    const categories = await this.prisma.categories.findMany({
      where: { business_id: bId },
      select: { id: true },
    });
    const categoryIds = new Set(categories.map((c) => c.id.toString()));

    const recordsToCreate: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const parsedDate = new Date(r.date);
      if (isNaN(parsedDate.getTime())) {
        throw new BadRequestException(`Row ${r.rowNumber || i + 1} has an invalid date.`);
      }

      if (r.type !== 'income' && r.type !== 'expense') {
        throw new BadRequestException(`Row ${r.rowNumber || i + 1} has an invalid type.`);
      }

      const amountNum = parseFloat(r.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new BadRequestException(`Row ${r.rowNumber || i + 1} has an invalid amount.`);
      }

      let catId: bigint | null = null;
      if (r.categoryId) {
        if (!categoryIds.has(r.categoryId.toString())) {
          throw new BadRequestException(`Row ${r.rowNumber || i + 1} category does not belong to this business.`);
        }
        catId = BigInt(r.categoryId);
      }

      recordsToCreate.push({
        business_id: bId,
        book_id: bkId,
        user_id: uId,
        category_id: catId,
        amount: new Prisma.Decimal(amountNum),
        type: r.type,
        mode: r.mode ? String(r.mode).trim() : null,
        contact_name: r.contactName ? String(r.contactName).trim() : null,
        description: r.description ? String(r.description).trim() : null,
        transaction_date: parsedDate,
        status: 'approved',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    const created = await this.prisma.$transaction(
      recordsToCreate.map((data) => this.prisma.transactions.create({ data })),
    );

    const unmatchedCount = rows.filter((r) => r.hasUnmatchedCategory).length;
    let message = `Successfully imported ${created.length} transaction${created.length === 1 ? '' : 's'}.`;
    if (unmatchedCount > 0) {
      message += ` (${unmatchedCount} imported with unassigned category)`;
    }

    return {
      success: true,
      importedCount: created.length,
      unmatchedCategoryCount: unmatchedCount,
      totalCount: rows.length,
      message,
    };
  }

  private parseFlexibleDate(dateStr: any, timeStr?: any): Date | null {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (!s) return null;

    const monthMap: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
      january: 1, february: 2, march: 3, april: 4, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    };

    let day = 0;
    let month = 0;
    let year = 0;

    const parts = s.split(/[\/\-\.\s,]+/);

    if (parts.length >= 3) {
      const p0 = parts[0].toLowerCase();
      const p1 = parts[1].toLowerCase();

      if (monthMap[p1]) {
        // e.g. "15 Jun 2026"
        day = parseInt(parts[0], 10);
        month = monthMap[p1];
        year = parseInt(parts[2], 10);
      } else if (monthMap[p0]) {
        // e.g. "Jun 15 2026"
        month = monthMap[p0];
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else if (/^\d{4}$/.test(parts[0])) {
        // e.g. "2026-10-14"
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        // e.g. "14/10/2026" or "10/14/2026"
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);

        if (month > 12 && day <= 12) {
          const t = day;
          day = month;
          month = t;
        }
      }
    }

    if (year > 0 && year < 100) year += 2000;

    if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
      const fallback = new Date(s);
      if (!isNaN(fallback.getTime()) && fallback.getFullYear() >= 1990 && fallback.getFullYear() <= 2100) {
        return fallback;
      }
      return null;
    }

    if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    let hours = 12;
    let minutes = 0;
    let seconds = 0;

    if (timeStr) {
      const tm = String(timeStr).trim();
      const match = tm.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        seconds = match[3] ? parseInt(match[3], 10) : 0;
        const ampm = (match[4] || '').toLowerCase();
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
      }
    }

    const d = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    if (!isNaN(d.getTime())) return d;

    return null;
  }

  private parseAmount(val: any): number | null {
    if (val == null) return null;
    const s = String(val).trim().replace(/[$,€£¥₹\s]/g, '').replace(/,/g, '');
    if (!s) return null;
    const num = parseFloat(s);
    if (isNaN(num) || !isFinite(num) || num <= 0) return null;
    return Math.round(num * 100) / 100;
  }

  private parseTransactionType(val: any): 'income' | 'expense' | null {
    if (val == null) return null;
    const s = String(val).trim().toLowerCase();
    if (['income', 'cash in', 'cash_in', 'in', 'credit', '+', 'cr', 'deposit'].includes(s)) {
      return 'income';
    }
    if (['expense', 'cash out', 'cash_out', 'out', 'debit', '-', 'dr', 'withdrawal', 'payment'].includes(s)) {
      return 'expense';
    }
    return null;
  }

  private parseCsvToObjects(csvText: string): any[] {
    let text = csvText;
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (insideQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentField += '"';
            i += 2;
            continue;
          } else {
            insideQuotes = false;
            i++;
            continue;
          }
        } else {
          currentField += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          insideQuotes = true;
          i++;
          continue;
        } else if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
          i++;
          continue;
        } else if (char === '\r') {
          if (nextChar === '\n') i++;
          currentRow.push(currentField.trim());
          if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i++;
          continue;
        } else if (char === '\n') {
          currentRow.push(currentField.trim());
          if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i++;
          continue;
        } else {
          currentField += char;
          i++;
          continue;
        }
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
    }

    if (rows.length < 2) return [];

    const rawHeaders = rows[0];
    const headers = rawHeaders.map((h) =>
      h.toLowerCase().trim().replace(/[\r\n\t_]/g, ' ').replace(/\s+/g, ' ')
    );
    const dataLines = rows.slice(1);

    const findIdx = (predicate: (h: string) => boolean) => headers.findIndex(predicate);

    // 1. Separate Cash In and Cash Out columns
    const cashInIdx = findIdx((h) => /^(cash\s*in|money\s*in|income|credit|cr|deposit)$/i.test(h));
    const cashOutIdx = findIdx((h) => /^(cash\s*out|money\s*out|expense|debit|dr|withdrawal)$/i.test(h));

    // 2. Explicit Type column (must NOT match separate Cash In / Cash Out columns)
    const typeIdx = findIdx((h) =>
      /^(type|transaction\s*type|tx\s*type|entry\s*type|flow|direction|action|txn\s*type|cash\s*in\s*\/\s*cash\s*out)$/i.test(h)
    );

    // 3. Explicit Amount column (must NOT match Cash In / Cash Out)
    const amountIdx = findIdx((h) =>
      /^(amount|transaction\s*amount|tx\s*amount|total|total\s*amount|sum|val|value|amt|net\s*amount|price)$/i.test(h)
    );

    // 4. Date & Time
    const dateIdx = findIdx((h) =>
      /^(date|transaction\s*date|tx\s*date|entry\s*date|date\s*&\s*time|datetime|timestamp|txn\s*date)$/i.test(h)
    );
    const timeIdx = findIdx((h) =>
      /^(time|transaction\s*time|tx\s*time|entry\s*time)$/i.test(h)
    );

    // 5. Contact Name / Party
    const contactIdx = findIdx((h) =>
      /^(contact|contact\s*name|party|party\s*name|customer|vendor|client|person|payee|payer)$/i.test(h)
    );

    // 6. Category
    const categoryIdx = findIdx((h) =>
      /^(category|category\s*name|tag|tags|classification)$/i.test(h)
    );

    // 7. Payment Mode
    const modeIdx = findIdx((h) =>
      /^(mode|payment\s*mode|payment\s*method|method|payment\s*type|account)$/i.test(h)
    );

    // 8. Description / Remarks
    const descIdx = findIdx((h) =>
      /^(description|desc|remark|remarks|note|notes|memo|details|narration|particulars)$/i.test(h)
    );

    const hasSeparateInOut = cashInIdx >= 0 || cashOutIdx >= 0;

    return dataLines.map((cols) => {
      const rawDate = dateIdx >= 0 && dateIdx < cols.length ? cols[dateIdx] : (cols[0] || '');
      const rawTime = timeIdx >= 0 && timeIdx < cols.length ? cols[timeIdx] : '';

      let rawType = '';
      let rawAmount = '';

      if (hasSeparateInOut) {
        const rawIn = cashInIdx >= 0 && cashInIdx < cols.length ? cols[cashInIdx].trim() : '';
        const rawOut = cashOutIdx >= 0 && cashOutIdx < cols.length ? cols[cashOutIdx].trim() : '';
        const inAmt = this.parseAmount(rawIn);
        const outAmt = this.parseAmount(rawOut);

        if (inAmt != null && outAmt != null) {
          rawType = 'conflict';
          rawAmount = `In: ${rawIn}, Out: ${rawOut}`;
        } else if (inAmt != null) {
          rawType = 'income';
          rawAmount = rawIn;
        } else if (outAmt != null) {
          rawType = 'expense';
          rawAmount = rawOut;
        } else if (rawIn) {
          rawType = 'income';
          rawAmount = rawIn;
        } else if (rawOut) {
          rawType = 'expense';
          rawAmount = rawOut;
        } else {
          rawType = '';
          rawAmount = '';
        }
      } else {
        rawType = typeIdx >= 0 && typeIdx < cols.length ? cols[typeIdx] : (cols[1] || '');
        rawAmount = amountIdx >= 0 && amountIdx < cols.length ? cols[amountIdx] : (cols[2] || '');
      }

      const contactName = contactIdx >= 0 && contactIdx < cols.length ? cols[contactIdx] : '';
      const categoryName = categoryIdx >= 0 && categoryIdx < cols.length ? cols[categoryIdx] : '';
      const mode = modeIdx >= 0 && modeIdx < cols.length ? cols[modeIdx] : '';
      const description = descIdx >= 0 && descIdx < cols.length ? cols[descIdx] : '';

      return {
        date: rawDate,
        time: rawTime,
        type: rawType,
        amount: rawAmount,
        contactName,
        categoryName,
        mode,
        description,
      };
    });
  }
}
