import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('businesses/:businessId/books/:bookId/transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async create(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(
      req.user.id,
      businessId,
      bookId,
      createTransactionDto,
    );
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
  ) {
    return this.transactionsService.findAll(
      req.user.id,
      businessId,
      bookId,
    );
  }

  @Get(':id')
  async findOne(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Param('id') id: string,
  ) {
    return this.transactionsService.findOne(
      req.user.id,
      businessId,
      bookId,
      id,
    );
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(
      req.user.id,
      businessId,
      bookId,
      id,
      updateTransactionDto,
    );
  }

  @Delete(':id')
  async remove(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Param('id') id: string,
  ) {
    return this.transactionsService.remove(
      req.user.id,
      businessId,
      bookId,
      id,
    );
  }
}
