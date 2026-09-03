import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class ScanLeadDto {
  @ApiProperty({ description: 'guests_id hasil scan QR/badge visitor' })
  @IsInt()
  guestsId: number;

  @ApiProperty({ enum: ['SCAN', 'EVENT_GUEST'], default: 'SCAN' })
  @IsIn(['SCAN', 'EVENT_GUEST'])
  source: 'SCAN' | 'EVENT_GUEST';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
