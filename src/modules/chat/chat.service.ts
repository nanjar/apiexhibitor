import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventChat } from './entities/event-chat.entity';
import { EventChatMember } from './entities/event-chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

export type ChatTabType = 'visitor' | 'exhibitor';

/**
 * Chat = SHARED dengan visitor app - chat_message, events_chat,
 * events_chatmember_v2 semuanya native Postgres, ditulis LANGSUNG oleh
 * kedua app (bukan mirror hasil sync, TIDAK ada staging/push-job untuk
 * chat sama sekali - lihat keputusan Sept 2026).
 *
 * BEDA dari Meeting: events_chatmember_v2.company_id DIKONFIRMASI
 * reliable (tidak seperti meeting_member_v2.company_id) - jadi filter
 * "chat room company saya" langsung pakai company_id, tidak perlu lewat
 * exhibitor_have_company.
 *
 * guests_id pada baris usertype_id='EX' tetap exhibitor_contact.id (sama
 * seperti meeting_member_v2).
 *
 * 2 tab: 'visitor' (com_direction E2V/V2E) dan 'exhibitor' (E2E) -
 * konsisten dengan pola Meeting.
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(EventChat)
    private readonly chatRepo: Repository<EventChat>,
    @InjectRepository(EventChatMember)
    private readonly chatMemberRepo: Repository<EventChatMember>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(GuestsTicket)
    private readonly guestsRepo: Repository<GuestsTicket>,
    @InjectRepository(ExhibitorContact)
    private readonly contactRepo: Repository<ExhibitorContact>,
    @InjectRepository(ExhibitorCompany)
    private readonly companyRepo: Repository<ExhibitorCompany>,
  ) {}

  async listRooms(user: CurrentExhibitor, type: ChatTabType) {
    const directions = type === 'visitor' ? ['E2V', 'V2E'] : ['E2E'];

    const memberships = await this.chatMemberRepo.find({
      where: { eventsId: user.eventsId, usertypeId: 'EX', companyId: user.companyId },
    });
    if (memberships.length === 0) return [];

    const chatIds = [...new Set(memberships.map((m) => m.chatId))];
    const unreadByChat = new Map(memberships.map((m) => [m.chatId, m.unread ?? 0]));

    const rooms = await this.chatRepo
      .createQueryBuilder('c')
      .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('c.chatId IN (:...chatIds)', { chatIds })
      .andWhere('c.comDirection IN (:...directions)', { directions })
      .orderBy('c.lastUpdate', 'DESC')
      .getMany();

    if (rooms.length === 0) return [];
    const roomChatIds = rooms.map((r) => r.chatId);

    const counterparts = await this.resolveCounterparts(user, roomChatIds, type);

    return rooms.map((room) => ({
      chatId: room.chatId,
      lastSender: room.lastSender,
      lastMessage: room.lastMessage,
      lastUpdate: room.lastUpdate,
      unreadCount: unreadByChat.get(room.chatId) ?? 0,
      comDirection: room.comDirection,
      counterpart: counterparts.get(room.chatId) ?? { fullname: null, companyName: null },
    }));
  }

  async getMessages(user: CurrentExhibitor, chatId: number) {
    await this.assertMember(user, chatId);
    return this.messageRepo.find({
      where: { eventsId: user.eventsId, chatId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async sendMessage(user: CurrentExhibitor, chatId: number, text: string) {
    if (!user.canChat) {
      throw new ForbiddenException('Kamu tidak punya izin chat untuk booth ini');
    }
    const membership = await this.assertMember(user, chatId);

    return this.messageRepo.manager.transaction(async (manager) => {
      const message = manager.getRepository(ChatMessage).create({
        eventsId: user.eventsId,
        chatId,
        senderMemberId: user.exhibitorId,
        senderName: user.fullname,
        senderType: 'EX',
        message: text,
        isRead: false,
      });
      await manager.getRepository(ChatMessage).save(message);

      // Update snapshot events_chat - SAMA seperti pola visitor app.
      // CATATAN yang sudah dikenal (bukan bug baru): snapshot ini bisa
      // ketimpa pull-sync events_chat berikutnya (5 menit) - trade-off
      // yang sudah diterima di sisi visitor app juga, konsisten di sini.
      await manager.getRepository(EventChat).update(
        { eventsId: user.eventsId, chatId },
        {
          lastSender: user.fullname,
          lastMessage: text,
          lastUpdate: new Date(),
          totalPost: () => 'COALESCE("totalPost", 0) + 1',
        } as any,
      );

      // Tambah unread untuk member LAIN di room ini (exclude diri sendiri,
      // pakai chatmemberId karena beberapa staff exhibitor company yang
      // sama mungkin share satu baris usertype_id=EX per company - exclude
      // berdasar chatmemberId membership sendiri, bukan exhibitorId).
      await manager
        .createQueryBuilder()
        .update(EventChatMember)
        .set({ unread: () => 'COALESCE(unread, 0) + 1' } as any)
        .where('eventsId = :eventsId AND chatId = :chatId AND chatmemberId != :chatmemberId', {
          eventsId: user.eventsId,
          chatId,
          chatmemberId: membership.chatmemberId,
        })
        .execute();

      // TODO: push notification (FCM) - sengaja belum diimplementasi,
      // Chat dibangun dulu tanpa notifikasi push (keputusan Sept 2026).
      // Device token exhibitor sudah tercatat di exhibitor_device_token
      // sejak login, tinggal sambungkan begitu FCM diaktifkan.

      return message;
    });
  }

  private async assertMember(user: CurrentExhibitor, chatId: number): Promise<EventChatMember> {
    const membership = await this.chatMemberRepo.findOne({
      where: {
        eventsId: user.eventsId,
        chatId,
        usertypeId: 'EX',
        companyId: user.companyId,
      },
    });
    if (!membership) {
      throw new NotFoundException('Chat room tidak ditemukan atau bukan untuk company kamu');
    }
    return membership;
  }

  private async resolveCounterparts(
    user: CurrentExhibitor,
    chatIds: number[],
    type: ChatTabType,
  ): Promise<Map<number, { fullname: string | null; companyName: string | null }>> {
    const map = new Map<number, { fullname: string | null; companyName: string | null }>();

    if (type === 'visitor') {
      const viRows = await this.chatMemberRepo
        .createQueryBuilder('m')
        .where('m.eventsId = :eventsId', { eventsId: user.eventsId })
        .andWhere('m.chatId IN (:...ids)', { ids: chatIds })
        .andWhere('m.usertypeId = :usertypeId', { usertypeId: 'VI' })
        .getMany();

      const guestIds = [...new Set(viRows.map((r) => r.guestsId))];
      const guests = guestIds.length
        ? await this.guestsRepo
            .createQueryBuilder('g')
            .where('g.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('g.guestsId IN (:...ids)', { ids: guestIds })
            .getMany()
        : [];

      for (const row of viRows) {
        const guest = guests.find((g) => g.guestsId === row.guestsId);
        map.set(row.chatId, { fullname: guest?.fullname ?? null, companyName: null });
      }
      return map;
    }

    // type === 'exhibitor': lawan bicara = baris EX LAIN (company_id beda
    // dari company saya) untuk chat_id yang sama.
    const otherExRows = await this.chatMemberRepo
      .createQueryBuilder('m')
      .where('m.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('m.chatId IN (:...ids)', { ids: chatIds })
      .andWhere('m.usertypeId = :usertypeId', { usertypeId: 'EX' })
      .andWhere('(m.companyId IS NULL OR m.companyId != :companyId)', { companyId: user.companyId })
      .getMany();

    const otherExhibitorIds = [...new Set(otherExRows.map((r) => r.guestsId))];
    const otherCompanyIds = [
      ...new Set(otherExRows.filter((r) => r.companyId != null).map((r) => r.companyId as number)),
    ];

    const [otherContacts, otherCompanies] = await Promise.all([
      otherExhibitorIds.length
        ? this.contactRepo
            .createQueryBuilder('c')
            .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('c.id IN (:...ids)', { ids: otherExhibitorIds })
            .getMany()
        : Promise.resolve([]),
      otherCompanyIds.length
        ? this.companyRepo
            .createQueryBuilder('c')
            .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('c.id IN (:...ids)', { ids: otherCompanyIds })
            .getMany()
        : Promise.resolve([]),
    ]);

    for (const row of otherExRows) {
      const contact = otherContacts.find((c) => c.id === row.guestsId);
      const company = row.companyId != null ? otherCompanies.find((c) => c.id === row.companyId) : null;
      map.set(row.chatId, {
        fullname: contact?.fullname ?? null,
        companyName: company?.companyName ?? null,
      });
    }
    return map;
  }
}
