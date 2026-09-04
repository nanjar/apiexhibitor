import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ExhibitorNotification } from './entities/exhibitor-notification.entity';
import { ExhibitorDeviceToken } from '../exhibitors/entities/exhibitor-device-token.entity';
import { FirebaseAdminService } from './firebase/firebase-admin.service';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(ExhibitorNotification)
    private readonly notificationRepo: Repository<ExhibitorNotification>,
    @InjectRepository(ExhibitorDeviceToken)
    private readonly deviceTokenRepo: Repository<ExhibitorDeviceToken>,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  async list(user: CurrentExhibitor) {
    return this.notificationRepo.find({
      where: { eventsId: user.eventsId, exhibitorId: user.exhibitorId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async unreadCount(user: CurrentExhibitor) {
    const count = await this.notificationRepo.count({
      where: { eventsId: user.eventsId, exhibitorId: user.exhibitorId, isRead: false },
    });
    return { unreadCount: count };
  }

  async markRead(user: CurrentExhibitor, id: number) {
    const notif = await this.notificationRepo.findOne({
      where: { id, eventsId: user.eventsId, exhibitorId: user.exhibitorId },
    });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');
    notif.isRead = true;
    await this.notificationRepo.save(notif);
    return { id, isRead: true };
  }

  async markAllRead(user: CurrentExhibitor) {
    await this.notificationRepo.update(
      { eventsId: user.eventsId, exhibitorId: user.exhibitorId, isRead: false },
      { isRead: true },
    );
    return { ok: true };
  }

  /**
   * Satu pintu masuk: bikin baris exhibitor_notification (bell) DAN kirim
   * FCM push ke semua device token exhibitor itu SEKALIGUS. Dipakai dari
   * ChatService (E2E) supaya gak ada 2 tempat beda yang masing-masing
   * punya logic kirim-notifikasi sendiri-sendiri.
   *
   * "Fail open" - kalau FCM gagal/nonaktif, baris notifikasi bell TETAP
   * kebuat (push itu enhancement, notifikasi bell tetap harus jalan).
   * Token yang udah invalid (device uninstall dsb) otomatis dihapus dari
   * exhibitor_device_token.
   */
  async createAndPush(
    eventsId: number,
    exhibitorId: number,
    type: 'MEETING_REQUEST' | 'CHAT_MESSAGE',
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    await this.notificationRepo.save(
      this.notificationRepo.create({
        eventsId,
        exhibitorId,
        type,
        title,
        body,
        data: data ?? null,
        isRead: false,
        createdAt: new Date(),
      }),
    );

    if (!this.firebaseAdmin.isEnabled) return;

    const deviceTokens = await this.deviceTokenRepo.find({ where: { eventsId, exhibitorId } });
    if (deviceTokens.length === 0) return;

    try {
      const result = await this.firebaseAdmin.sendToTokens(
        deviceTokens.map((d) => d.deviceId),
        { title, body, data: data ? this.stringifyData(data) : undefined },
      );
      if (result.invalidTokens.length > 0) {
        await this.deviceTokenRepo.delete({
          eventsId,
          exhibitorId,
          deviceId: In(result.invalidTokens),
        });
      }
    } catch (err) {
      this.logger.warn(
        `Gagal kirim FCM ke exhibitor ${exhibitorId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // FCM data payload harus semua value string.
  private stringifyData(data: Record<string, any>): Record<string, string> {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
  }
}
