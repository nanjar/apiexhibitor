import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ManualLeadDto {
  @ApiProperty({ description: 'Bebas ketik - belum tentu visitor terdaftar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullname: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(25)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Minat produk - list exhibitor_product.id milik company ini',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  productInterestIds?: number[];
}
