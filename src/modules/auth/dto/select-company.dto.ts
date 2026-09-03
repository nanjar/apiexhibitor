import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class SelectCompanyDto {
  @ApiProperty({ description: 'Identity token dari hasil POST /auth/login' })
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiProperty({ description: 'Company id yang dipilih (harus ada di daftar companies hasil login)' })
  @IsInt()
  companyId: number;
}
