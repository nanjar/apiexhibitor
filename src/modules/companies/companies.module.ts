import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { VenueModule } from '../venue/venue.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExhibitorCompany, ExhibitorContact]),
    VenueModule,
    PassportModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
