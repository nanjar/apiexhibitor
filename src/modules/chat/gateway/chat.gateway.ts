import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../../auth/auth.service';
import { ChatService } from '../chat.service';
import { CurrentExhibitor } from '../../../common/decorators/current-exhibitor.decorator';

interface AuthedSocket extends Socket {
  data: { user?: CurrentExhibitor };
}

const TYPING_AUTO_CLEAR_MS = 5000;

/**
 * Mirror dari ChatGateway apivisitor - pola & nama event SAMA PERSIS
 * (chat:join, chat:send, chat:message, chat:typing) supaya konsisten
 * kalau ada client yang perlu handle kedua sisi.
 *
 * KETERBATASAN SAAT INI: apiexhibitor & apivisitor proses Node.js
 * TERPISAH (port beda, server Socket.IO independen masing-masing).
 * Room Socket.IO itu in-memory PER SERVER - jadi kalau visitor kirim
 * pesan lewat apivisitor, broadcast real-time-nya CUMA sampai ke socket
 * yang connect ke apivisitor, TIDAK otomatis sampai ke socket yang
 * connect ke apiexhibitor (dan sebaliknya).
 *
 * RENCANA FASE SELANJUTNYA (dikonfirmasi Sept 2026): infrastruktur Redis
 * SUDAH ADA di stack ini (dipakai untuk keperluan lain) - jadi pasang
 * @socket.io/redis-adapter di KEDUA app (apivisitor & apiexhibitor),
 * connect ke Redis instance yang sama, supaya broadcast lintas server
 * beneran real-time. Belum dikerjakan sekarang - staff exhibitor yang
 * connect ke apiexhibitor tetap dapat update instan sesama mereka;
 * pesan dari/ke visitor sementara masih via polling REST.
 *
 * Yang TETAP jalan real-time: sesama staff exhibitor yang connect ke
 * apiexhibitor (kalau ada 2 staff company yang sama online bareng).
 * Yang TIDAK real-time (perlu refresh/reconnect manual client): pesan
 * dari visitor ke exhibitor, atau exhibitor ke visitor, gak ada
 * broadcast instan lintas app - client exhibitor perlu polling REST
 * (GET /chat/rooms/:chatId/messages) untuk lihat pesan baru dari visitor
 * sampai Redis adapter di atas dipasang.
 */
@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly typingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      if ((payload as any).stage) {
        // identityToken (belum select-company-booth) - tolak, sama seperti
        // fix keamanan JwtStrategy di REST.
        throw new Error('Identity token belum lengkap');
      }
      client.data.user = {
        exhibitorId: payload.sub,
        eventsId: payload.eventsId,
        companyId: payload.companyId,
        venueId: payload.venueId,
        spaceId: payload.spaceId,
        fullname: payload.fullname,
        phone: payload.phone,
        isOwner: payload.isOwner,
        canScan: payload.canScan,
        canChat: payload.canChat,
      };
    } catch {
      this.logger.warn(`Socket ${client.id} gagal autentikasi, disconnect`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthedSocket) {
    for (const key of this.typingTimers.keys()) {
      if (key.startsWith(`${client.id}:`)) {
        clearTimeout(this.typingTimers.get(key));
        this.typingTimers.delete(key);
      }
    }
  }

  @SubscribeMessage('chat:join')
  async handleJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { chatId: number }) {
    await client.join(this.roomKey(client.data.user!.eventsId, body.chatId));
  }

  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { chatId: number; message: string },
  ) {
    const user = client.data.user!;
    this.clearTyping(client, user.eventsId, body.chatId);

    const saved = await this.chatService.sendMessage(user, body.chatId, body.message);
    // Broadcast ke room di server INI SAJA (lihat catatan keterbatasan di
    // atas kelas) - staff exhibitor lain yang connect ke apiexhibitor dapat
    // update instan, visitor TIDAK (beda server).
    this.server.to(this.roomKey(user.eventsId, body.chatId)).emit('chat:message', saved);
    return saved;
  }

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { chatId: number; isTyping: boolean },
  ) {
    const user = client.data.user!;
    const timerKey = `${client.id}:${body.chatId}`;

    client.to(this.roomKey(user.eventsId, body.chatId)).emit('chat:typing', {
      chatId: body.chatId,
      exhibitorId: user.exhibitorId,
      fullname: user.fullname,
      isTyping: body.isTyping,
    });

    const existingTimer = this.typingTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    if (body.isTyping) {
      const timer = setTimeout(() => {
        client.to(this.roomKey(user.eventsId, body.chatId)).emit('chat:typing', {
          chatId: body.chatId,
          exhibitorId: user.exhibitorId,
          fullname: user.fullname,
          isTyping: false,
        });
        this.typingTimers.delete(timerKey);
      }, TYPING_AUTO_CLEAR_MS);
      this.typingTimers.set(timerKey, timer);
    } else {
      this.typingTimers.delete(timerKey);
    }
  }

  private clearTyping(client: AuthedSocket, eventsId: number, chatId: number) {
    const timerKey = `${client.id}:${chatId}`;
    const timer = this.typingTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.typingTimers.delete(timerKey);
      client.to(this.roomKey(eventsId, chatId)).emit('chat:typing', {
        chatId,
        exhibitorId: client.data.user!.exhibitorId,
        fullname: client.data.user!.fullname,
        isTyping: false,
      });
    }
  }

  // SAMA PERSIS format roomKey apivisitor - kalau nanti Redis adapter
  // dipasang buat cross-server, room key udah konsisten dari awal.
  private roomKey(eventsId: number, chatId: number) {
    return `event:${eventsId}:chat:${chatId}`;
  }
}
