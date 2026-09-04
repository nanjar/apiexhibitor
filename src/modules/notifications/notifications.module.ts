import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ExhibitorNotification } from './entities/exhibitor-notification.entity';
import { ExhibitorDeviceToken } from '../exhibitors/entities/exhibitor-device-token.entity';
import { FirebaseAdminService } from './firebase/firebase-admin.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExhibitorNotification, ExhibitorDeviceToken]),
    PassportModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebaseAdminService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
