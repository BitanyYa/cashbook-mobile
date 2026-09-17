import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { transactions_type } from '@prisma/client';

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount: string;

  @IsEnum(transactions_type, {
    message: 'type must be either income or expense',
  })
  type: transactions_type;

  @IsString()
  @IsNotEmpty()
  transaction_date: string;

  @IsString()
  @IsOptional()
  mode?: string;

  @IsString()
  @IsOptional()
  category_id?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  contact_name?: string;
}
