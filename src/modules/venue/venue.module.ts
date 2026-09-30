import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExhcompanySpace } from './entities/exhcompany-space.entity';
import { VenueSpace } from './entities/venue-space.entity';
import { LocationAddress } from './entities/location-address.entity';
import { BoothResolverService } from './booth-resolver.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExhcompanySpace, VenueSpace, LocationAddress])],
  providers: [BoothResolverService],
  exports: [BoothResolverService],
})
export class VenueModule {}
