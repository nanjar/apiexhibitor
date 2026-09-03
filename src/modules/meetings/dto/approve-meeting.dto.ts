import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveMeetingDto {
  @ApiProperty({
    enum: ['Hot', 'Warm', 'Cold'],
    description: 'Temperature lead - WAJIB diisi saat approve (dikonfirmasi Sept 2026: ini yang jadi temperature lead di My Booth)',
  })
  @IsString()
  @IsIn(['Hot', 'Warm', 'Cold'])
  score: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
