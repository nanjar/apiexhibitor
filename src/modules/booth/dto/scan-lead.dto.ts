import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ScanLeadDto {
  @ApiProperty({ description: 'Token dari QR code visitor (guests_ticket.token)' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ enum: ['SCAN', 'EVENT_GUEST'], default: 'SCAN' })
  @IsIn(['SCAN', 'EVENT_GUEST'])
  source: 'SCAN' | 'EVENT_GUEST';

  @ApiPropertyOptional({
    description: 'Minat produk - list exhibitor_product.id milik company ini',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  productInterestIds?: number[];
}
