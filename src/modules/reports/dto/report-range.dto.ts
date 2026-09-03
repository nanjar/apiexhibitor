import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class ReportRangeDto {
  @ApiPropertyOptional({ description: 'ISO date, default 30 hari ke belakang' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, default hari ini' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
