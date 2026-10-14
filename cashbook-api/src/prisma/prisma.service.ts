import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit
{
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      console.error('Prisma initial connection warning:', err instanceof Error ? err.message : err);
    }
  }
}
