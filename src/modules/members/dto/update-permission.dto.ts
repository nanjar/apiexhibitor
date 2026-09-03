import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePermissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canScan?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canChat?: boolean;
}
