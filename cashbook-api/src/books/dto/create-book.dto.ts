import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBookDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  currency?: string;
}
