import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorMemberStatus } from '../exhibitors/entities/exhibitor-member-status.entity';
import { ExhibitorMemberAction } from '../exhibitors/entities/exhibitor-member-action.entity';
import { ExhibitorDeviceToken } from '../exhibitors/entities/exhibitor-device-token.entity';
import { ExhibitorHaveCompany } from '../exhibitors/entities/exhibitor-have-company.entity';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhcompanySpace } from '../venue/entities/exhcompany-space.entity';
import { VenueSpace } from '../venue/entities/venue-space.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      ExhibitorContact,
      ExhibitorMemberStatus,
      ExhibitorMemberAction,
      ExhibitorDeviceToken,
      ExhibitorHaveCompany,
      ExhibitorCompany,
      ExhcompanySpace,
      VenueSpace,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
