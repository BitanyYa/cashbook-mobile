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
}
