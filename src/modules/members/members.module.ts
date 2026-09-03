import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorHaveCompany } from '../exhibitors/entities/exhibitor-have-company.entity';
import { ExhibitorMemberStatus } from '../exhibitors/entities/exhibitor-member-status.entity';
import { ExhibitorMemberAction } from '../exhibitors/entities/exhibitor-member-action.entity';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExhibitorContact,
      ExhibitorHaveCompany,
      ExhibitorMemberStatus,
      ExhibitorMemberAction,
    ]),
    PassportModule,
  ],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
