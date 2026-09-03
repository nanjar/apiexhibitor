import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

/**
 * "Pilih company" sebenarnya "pilih booth" - di lapangan satu company
 * bisa punya beberapa booth (venue_id + space_id berbeda), jadi kombinasi
 * companyId+venueId+spaceId itu yang menentukan sesi ini ngelola booth
 * yang mana.
 */
export class SelectBoothDto {
  @ApiProperty({ description: 'Identity token dari hasil POST /auth/login' })
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiProperty()
  @IsInt()
  companyId: number;

  @ApiProperty()
  @IsInt()
  venueId: number;

  @ApiProperty()
  @IsInt()
  spaceId: number;
}
