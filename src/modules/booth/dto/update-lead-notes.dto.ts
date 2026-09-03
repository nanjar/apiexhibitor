import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateLeadNotesDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  notes: string;
}
