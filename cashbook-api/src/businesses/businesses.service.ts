import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBusinessDto) {
    const userBigIntId = BigInt(userId);
    const currency = dto.currency && dto.currency.trim() !== '' ? dto.currency.trim() : 'USD';

    const result = await this.prisma.$transaction(async (tx) => {
      const business = await tx.businesses.create({
        data: {
          name: dto.name.trim(),
          currency,
        },
      });

      const businessUser = await tx.business_user.create({
        data: {
          business_id: business.id,
          user_id: userBigIntId,
          role: 'owner',
        },
      });

      return {
        business,
        role: businessUser.role,
      };
    });

    return {
      id: result.business.id.toString(),
      name: result.business.name,
      currency: result.business.currency,
      role: result.role,
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
}
