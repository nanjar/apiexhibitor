import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MeetingActionDto {
  @ApiPropertyOptional({ description: 'Catatan opsional (mis. alasan tolak)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
