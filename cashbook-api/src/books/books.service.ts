import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookDto } from './dto/create-book.dto';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyBusinessMember(userId: string, businessId: string) {
    let businessBigIntId: bigint;
    try {
      businessBigIntId = BigInt(businessId);
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

    return { bu, businessBigIntId, userBigIntId };
  }

  async create(userId: string, businessId: string, dto: CreateBookDto) {
    const { bu, businessBigIntId } = await this.verifyBusinessMember(
      userId,
      businessId,
    );

    const currency =
      dto.currency && dto.currency.trim() !== ''
        ? dto.currency.trim()
        : bu.businesses.currency && bu.businesses.currency.trim() !== ''
        ? bu.businesses.currency.trim()
        : 'ETB';

    const book = await this.prisma.books.create({
      data: {
        business_id: businessBigIntId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        currency,
      },
    });

    return {
      id: book.id.toString(),
      businessId: book.business_id.toString(),
      name: book.name,
      description: book.description,
      currency: book.currency,
      createdAt: book.created_at,
      updatedAt: book.updated_at,
    };
  }

  async findAllForBusiness(userId: string, businessId: string) {
    const { businessBigIntId } = await this.verifyBusinessMember(
      userId,
      businessId,
    );

    const records = await this.prisma.books.findMany({
      where: {
        business_id: businessBigIntId,
        deleted_at: null,
      },
      orderBy: {
        id: 'desc',
      },
    });

    const books = records.map((book) => ({
      id: book.id.toString(),
      businessId: book.business_id.toString(),
      name: book.name,
      description: book.description,
      currency: book.currency,
      createdAt: book.created_at,
      updatedAt: book.updated_at,
    }));

    return { books };
  }

  async findOneForBusiness(
    userId: string,
    businessId: string,
    bookId: string,
  ) {
    const { businessBigIntId } = await this.verifyBusinessMember(
      userId,
      businessId,
    );

    let bookBigIntId: bigint;
    try {
      bookBigIntId = BigInt(bookId);
    } catch {
      throw new NotFoundException('Book not found or access denied');
    }

    const book = await this.prisma.books.findFirst({
      where: {
        id: bookBigIntId,
        business_id: businessBigIntId,
        deleted_at: null,
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found or access denied');
    }

    return {
      id: book.id.toString(),
      businessId: book.business_id.toString(),
      name: book.name,
      description: book.description,
      currency: book.currency,
      createdAt: book.created_at,
      updatedAt: book.updated_at,
    };
  }
}
