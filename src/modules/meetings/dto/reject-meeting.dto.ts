import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectMeetingDto {
  @ApiPropertyOptional({ description: 'Alasan tolak (opsional)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
