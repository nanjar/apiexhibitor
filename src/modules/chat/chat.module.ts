import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { EventChat } from './entities/event-chat.entity';
import { EventChatMember } from './entities/event-chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhibitorNotification } from '../notifications/entities/exhibitor-notification.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './gateway/chat.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventChat,
      EventChatMember,
      ChatMessage,
      GuestsTicket,
      ExhibitorContact,
      ExhibitorCompany,
      ExhibitorNotification,
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
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
