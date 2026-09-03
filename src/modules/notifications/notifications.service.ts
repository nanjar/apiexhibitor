import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExhibitorNotification } from './entities/exhibitor-notification.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(ExhibitorNotification)
    private readonly notificationRepo: Repository<ExhibitorNotification>,
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
}
