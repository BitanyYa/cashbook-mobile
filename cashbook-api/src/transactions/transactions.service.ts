import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeTransaction(tx: any) {
    return {
      id: tx.id.toString(),
      businessId: tx.business_id.toString(),
      bookId: tx.book_id.toString(),
      categoryId: tx.category_id ? tx.category_id.toString() : null,
      userId: tx.user_id.toString(),
      amount: tx.amount.toString(),
      type: tx.type,
      mode: tx.mode,
      status: tx.status,
      description: tx.description,
      contactName: tx.contact_name,
      transactionDate: tx.transaction_date,
      createdAt: tx.created_at,
      updatedAt: tx.updated_at,
    };
  }

  private async verifyBookAccess(userId: string, businessId: string, bookId: string) {
    const bId = BigInt(businessId);
    const bkId = BigInt(bookId);
    const uId = BigInt(userId);

    const membership = await this.prisma.business_user.findFirst({
      where: {
        business_id: bId,
        user_id: uId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Book not found or access denied');
    }

    const business = await this.prisma.businesses.findFirst({
      where: {
        id: bId,
        deleted_at: null,
      },
    });

    if (!business) {
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

  async create(userId: string, businessId: string, bookId: string, dto: CreateTransactionDto) {
    const { bId, bkId, uId } = await this.verifyBookAccess(userId, businessId, bookId);

    const amountNum = parseFloat(dto.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('amount must be greater than 0');
    }

    let dateObj: Date;
    try {
      const trimmedDate = dto.transaction_date.split('T')[0];
      dateObj = new Date(`${trimmedDate}T12:00:00.000Z`);
      if (isNaN(dateObj.getTime())) {
        throw new BadRequestException('Invalid transaction_date format');
      }
    } catch {
      throw new BadRequestException('Invalid transaction_date format');
    }

    const tx = await this.prisma.transactions.create({
      data: {
        business_id: bId,
        book_id: bkId,
        user_id: uId,
        amount: new Prisma.Decimal(dto.amount),
        type: dto.type,
        transaction_date: dateObj,
        mode: dto.mode || null,
        description: dto.description || null,
        contact_name: dto.contact_name || null,
        status: 'pending',
      },
    });

    return this.serializeTransaction(tx);
  }

  async findAll(userId: string, businessId: string, bookId: string) {
    const { bId, bkId } = await this.verifyBookAccess(userId, businessId, bookId);

    const list = await this.prisma.transactions.findMany({
      where: {
        business_id: bId,
        book_id: bkId,
        deleted_at: null,
      },
      orderBy: [{ transaction_date: 'desc' }, { created_at: 'desc' }],
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
        dateObj = new Date(`${trimmedDate}T12:00:00.000Z`);
        if (isNaN(dateObj.getTime())) {
          throw new BadRequestException('Invalid transaction_date format');
        }
      } catch {
        throw new BadRequestException('Invalid transaction_date format');
      }
    }

    const updated = await this.prisma.transactions.update({
      where: { id: txId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(parsedDecimal !== undefined ? { amount: parsedDecimal } : {}),
        ...(dateObj !== undefined ? { transaction_date: dateObj } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.contact_name !== undefined ? { contact_name: dto.contact_name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        updated_at: new Date(),
      },
    });

    return this.serializeTransaction(updated);
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
}
