import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum CategoryType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export class CreateCategoryDto {
  @IsNotEmpty({ message: 'Category name is required' })
  @IsString({ message: 'Category name must be a string' })
  @MaxLength(100, { message: 'Category name cannot exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsEnum(CategoryType, { message: 'type must be either income or expense' })
  type?: CategoryType;
}
