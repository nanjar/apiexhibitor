import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ScanLeadDto {
  @ApiProperty({ description: 'Token dari QR code visitor (guests_ticket.token)' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ enum: ['SCAN', 'EVENT_GUEST'], default: 'SCAN' })
  @IsIn(['SCAN', 'EVENT_GUEST'])
  source: 'SCAN' | 'EVENT_GUEST';
}
