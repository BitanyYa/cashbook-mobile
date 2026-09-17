import { CategoriesModule } from './categories/categories.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { BooksModule } from './books/books.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    CategoriesModule,
    PrismaModule,
    AuthModule,
    BusinessesModule,
    BooksModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
