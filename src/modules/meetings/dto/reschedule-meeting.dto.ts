import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleMeetingDto {
  @ApiProperty({ description: 'Waktu mulai baru (ISO datetime)' })
  @IsDateString()
  startDatetime: string;

  @ApiProperty({ description: 'Waktu selesai baru (ISO datetime)' })
  @IsDateString()
  endDatetime: string;

  @ApiPropertyOptional({ description: 'Alasan reschedule (opsional)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
