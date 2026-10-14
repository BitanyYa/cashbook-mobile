import {
  Body,
  Controller,
  Get,
  Query,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('businesses')
@UseGuards(JwtAuthGuard)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createBusinessDto: CreateBusinessDto,
  ) {
    return this.businessesService.create(req.user.id, createBusinessDto);
  }

  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.businessesService.findAllForUser(req.user.id);
  }

  @Get(':id')
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.businessesService.findOneForUser(id, req.user.id);
  }

  @Get(':id/members')
  async getMembers(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.businessesService.getMembersForBusiness(id, req.user.id);
  }

  @Get(':id/contact-names')
  async getContactNames(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('q') query?: string,
  ) {
    return this.businessesService.getContactNamesForBusiness(id, req.user.id, query);
  }

  @Get(':id/contact-transactions')
  async getContactTransactions(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('contact_name') contactName: string,
    @Query('book_id') bookId?: string,
    @Query('type') type?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('search') search?: string,
  ) {
    return this.businessesService.getContactTransactionsForBusiness(id, req.user.id, {
      contact_name: contactName,
      book_id: bookId,
      type,
      from_date: fromDate,
      to_date: toDate,
      search,
    });
  }

}
