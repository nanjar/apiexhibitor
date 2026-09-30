import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Event key 6-digit (events.ev_token)', example: '482913' })
  @IsString()
  @IsNotEmpty()
  eventKey: string;

  @ApiProperty({
    description:
      'Kode negara nomor HP, mis. "62" - WAJIB dikirim terpisah dari phone. exhibitor_contact menyimpan country_code & phone di kolom berbeda, jadi tanpa ini pencarian bisa gagal match walau nomornya benar terdaftar.',
    example: '62',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  countryCode: string;

  @ApiProperty({
    description: 'Nomor HP terdaftar sebagai staff booth, TANPA kode negara (mis. "81234567890" atau "081234567890")',
    example: '81234567890',
  })
  @IsString()
  @Length(8, 20)
  phone: string;

  @ApiPropertyOptional({
    description: 'FCM device token/registration id, buat push notification. Dikirim tiap login supaya tokennya tetap fresh.',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ enum: ['ios', 'android', 'web'] })
  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: string;
}
