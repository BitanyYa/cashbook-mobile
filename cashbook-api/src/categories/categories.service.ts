import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryType, CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeCategory(cat: any) {
    if (!cat) return null;
    return {
      id: cat.id ? cat.id.toString() : '',
      businessId: cat.business_id ? cat.business_id.toString() : '',
      name: cat.name || '',
      type: cat.type || 'income',
      createdAt: cat.created_at || null,
      updatedAt: cat.updated_at || null,
    };
  }

  private async verifyBusinessAccess(userId: string, businessId: string) {
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

    const business = await this.prisma.businesses.findFirst({
      where: {
        id: bId,
        deleted_at: null,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found or access denied');
    }

    return { bId, uId };
  }

  async create(userId: string, businessId: string, dto: CreateCategoryDto) {
    const { bId } = await this.verifyBusinessAccess(userId, businessId);

    const trimmedName = (dto.name || '').trim();
    if (!trimmedName) {
      throw new BadRequestException('Category name cannot be empty');
    }

    const catType = dto.type || CategoryType.INCOME;

    const cat = await this.prisma.categories.create({
      data: {
        business_id: bId,
        name: trimmedName,
        type: catType,
      },
    });

    return this.serializeCategory(cat);
  }

  async findAll(userId: string, businessId: string, type?: string) {
    const { bId } = await this.verifyBusinessAccess(userId, businessId);

    const whereClause: any = {
      business_id: bId,
    };

    if (type === 'income' || type === 'expense') {
      whereClause.type = type;
    }

    const list = await this.prisma.categories.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });

    return {
      categories: list.map((c) => this.serializeCategory(c)),
    };
  }

  async findOne(userId: string, businessId: string, id: string) {
    const { bId } = await this.verifyBusinessAccess(userId, businessId);

    let catId: bigint;
    try {
      catId = BigInt(id);
    } catch {
      throw new NotFoundException('Category not found or access denied');
    }

    const cat = await this.prisma.categories.findFirst({
      where: {
        id: catId,
        business_id: bId,
      },
    });

    if (!cat) {
      throw new NotFoundException('Category not found or access denied');
    }

    return this.serializeCategory(cat);
  }

  async remove(userId: string, businessId: string, id: string) {
    const { bId } = await this.verifyBusinessAccess(userId, businessId);

    let catId: bigint;
    try {
      catId = BigInt(id);
    } catch {
      throw new NotFoundException('Category not found or access denied');
    }

    const cat = await this.prisma.categories.findFirst({
      where: {
        id: catId,
        business_id: bId,
      },
    });

    if (!cat) {
      throw new NotFoundException('Category not found or access denied');
    }

    // 1. Unlink transactions attached to this category (set category_id = null)
    await this.prisma.transactions.updateMany({
      where: {
        business_id: bId,
        category_id: catId,
      },
      data: {
        category_id: null,
      },
    });

    // 2. Delete category record
    await this.prisma.categories.delete({
      where: { id: catId },
    });

    return { message: 'Category deleted successfully' };
  }
}
