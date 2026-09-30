import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLeadNotesDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  notes: string;

  @ApiPropertyOptional({
    description: 'Minat produk - list exhibitor_product.id milik company ini (replace, bukan append)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  productInterestIds?: number[];
}
