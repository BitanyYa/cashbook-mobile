import {
  Body,
  Controller,
  Delete,
  Get,
  Res,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

const attachmentMulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = join(process.cwd(), 'uploads', 'attachments');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
};

@Controller('businesses/:businessId/books/:bookId/transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 5, attachmentMulterOptions))
  async create(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Body() createTransactionDto: CreateTransactionDto,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    return this.transactionsService.create(
      req.user.id,
      businessId,
      bookId,
      createTransactionDto,
      files,
    );
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Query('search') search?: string,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('category_id') category_id?: string,
    @Query('contact_name') contact_name?: string,
    @Query('member_id') member_id?: string,
    @Query('mode') mode?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('status') status?: string,
  ) {
    return this.transactionsService.findAll(
      req.user.id,
      businessId,
      bookId,
      {
        search,
        q,
        type,
        category_id,
        contact_name,
        member_id,
        mode,
        from_date,
        to_date,
        start_date,
        end_date,
        status,
      },
    );
  }


  @Get('export-csv')
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

    // If client requested JSON format, return as JSON
    if (queryParams?.format === 'json' || req.headers?.accept?.includes('application/json')) {
      return res.json(result);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.csv);
  }

  @Post('import-csv/preview')
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

  @Post('import-csv')
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
  @UseInterceptors(FilesInterceptor('files', 5, attachmentMulterOptions))
  async update(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    return this.transactionsService.update(
      req.user.id,
      businessId,
      bookId,
      id,
      updateTransactionDto,
      files,
    );
  }

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files', 5, attachmentMulterOptions))
  async addAttachments(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    return this.transactionsService.addAttachments(
      req.user.id,
      businessId,
      bookId,
      id,
      files,
    );
  }

  @Delete(':id/attachments/:attachmentId')
  async deleteAttachment(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('bookId') bookId: string,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.transactionsService.deleteAttachment(
      req.user.id,
      businessId,
      bookId,
      id,
      attachmentId,
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
