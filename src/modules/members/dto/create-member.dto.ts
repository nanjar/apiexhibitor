import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Selalu bikin akun user_level='OPR' - permission-nya FIXED (cuma scan QR,
 * tidak bisa chat), makanya gak ada field canScan/canChat di sini seperti
 * di InviteMemberDto. Lihat MembersService.createNewMember().
 */
export class CreateMemberDto {
  @ApiProperty({ description: 'Nama lengkap - orang belum pernah terdaftar sama sekali' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullname: string;

  @ApiProperty({ description: 'Nomor HP (tanpa kode negara)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @ApiPropertyOptional({ default: '62' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobTitle?: string;
}
