import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Event key 6-digit (events.ev_token)', example: '482913' })
  @IsString()
  @IsNotEmpty()
  eventKey: string;

  @ApiProperty({ description: 'Nomor HP terdaftar sebagai staff booth', example: '081234567890' })
  @IsString()
  @Length(8, 20)
  phone: string;
}
