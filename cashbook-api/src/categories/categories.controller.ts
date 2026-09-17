import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('businesses/:businessId/categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async create(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(
      req.user.id,
      businessId,
      createCategoryDto,
    );
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Query('type') type?: string,
  ) {
    return this.categoriesService.findAll(
      req.user.id,
      businessId,
      type,
    );
  }

  @Get(':id')
  async findOne(
    @Req() req: any,
    @Param('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.categoriesService.findOne(
      req.user.id,
      businessId,
      id,
    );
  }
}
