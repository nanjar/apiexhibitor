import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ description: 'exhibitor_contact.id yang mau diundang (harus sudah terhubung ke company ini via exhibitor_have_company)' })
  @IsInt()
  exhibitorId: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canScan?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canChat?: boolean;
}
