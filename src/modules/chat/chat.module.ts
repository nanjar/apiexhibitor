import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { EventChat } from './entities/event-chat.entity';
import { EventChatMember } from './entities/event-chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventChat,
      EventChatMember,
      ChatMessage,
      GuestsTicket,
      ExhibitorContact,
      ExhibitorCompany,
    ]),
    PassportModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
