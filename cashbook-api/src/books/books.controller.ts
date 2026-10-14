import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { BooksService } from './books.service';
import { TransactionsService } from '../transactions/transactions.service';
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
  constructor(
    private readonly booksService: BooksService,
    private readonly transactionsService: TransactionsService,
  ) {}

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

  @Get(':bookId/export-csv')
  async exportCsv(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Query() queryParams: any,
    @Res() res: any,
  ) {
    const result = await this.transactionsService.exportCsv(
      req.user.id,
      businessId,
      bookId,
      queryParams,
    );

    if (queryParams?.format === 'json' || req.headers?.accept?.includes('application/json')) {
      return res.json(result);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.csv);
  }

  @Post(':bookId/import-csv/preview')
  async previewImportCsv(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Body() body: { rows?: any[]; csvContent?: string },
  ) {
    return this.transactionsService.previewImportCsv(
      req.user.id,
      businessId,
      bookId,
      body,
    );
  }

  @Post(':bookId/import-csv')
  async importCsv(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Body() body: { rows: any[] },
  ) {
    return this.transactionsService.importValidatedRows(
      req.user.id,
      businessId,
      bookId,
      body.rows,
    );
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
