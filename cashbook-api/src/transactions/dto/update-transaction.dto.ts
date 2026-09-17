import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive decimal number with up to 2 decimal places',
  })
  amount?: string;

  @IsOptional()
  @IsEnum(TransactionType, {
    message: 'type must be either income or expense',
  })
  type?: TransactionType;

  @IsOptional()
  @IsString()
  transaction_date?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  contact_name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
