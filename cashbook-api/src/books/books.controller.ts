import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('businesses/:businessId/books')
@UseGuards(JwtAuthGuard)
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('businessId') businessId: string,
    @Body() createBookDto: CreateBookDto,
  ) {
    return this.booksService.create(req.user.id, businessId, createBookDto);
  }

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Param('businessId') businessId: string,
  ) {
    return this.booksService.findAllForBusiness(req.user.id, businessId);
  }

  @Get(':bookId')
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
  ) {
    return this.booksService.findOneForBusiness(
      req.user.id,
      businessId,
      bookId,
    );
  }
}
