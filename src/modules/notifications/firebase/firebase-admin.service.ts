import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import type { App } from 'firebase-admin/app';

/**
 * Wrapper tipis di atas Firebase Admin SDK, KHUSUS buat FCM (push
 * notification) — bukan Firestore/Realtime Database. Chat data tetap di
 * Postgres (lihat ChatGateway/ChatService), Firebase di sini cuma dipakai
 * buat "kirim popup notif ke HP exhibitor". SAMA PERSIS polanya dengan
 * apivisitor (copy dari sana) - pakai project Firebase yang sama, file
 * service account yang sama (FIREBASE_SERVICE_ACCOUNT_PATH).
 *
 * Sengaja didesain "fail open": kalau FIREBASE_SERVICE_ACCOUNT_PATH kosong
 * atau file-nya invalid, service ini nonaktif diam-diam (log warning sekali
 * pas startup) — TIDAK bikin seluruh aplikasi gagal start. Push notification
 * itu enhancement, bukan critical path; notifikasi bell & chat tetap harus
 * jalan walau FCM belum di-setup.
 */
@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: App | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (!serviceAccountPath) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_PATH belum di-set — push notification NONAKTIF (chat tetap jalan normal via WebSocket).',
      );
      return;
    }
    if (!fs.existsSync(serviceAccountPath)) {
      this.logger.warn(
        `File service account Firebase gak ketemu di "${serviceAccountPath}" — push notification NONAKTIF.`,
      );
      return;
    }

    try {
      const { initializeApp, cert } = await import('firebase-admin/app');
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      this.app = initializeApp({ credential: cert(serviceAccount) });
      this.logger.log('Firebase Admin SDK (FCM) berhasil di-inisialisasi.');
    } catch (err) {
      this.logger.warn(
        `Gagal inisialisasi Firebase Admin SDK, push notification NONAKTIF: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  get isEnabled(): boolean {
    return this.app !== null;
  }

  /**
   * Kirim push notification ke banyak device token sekaligus. Token yang
   * invalid/expired (device uninstall app, dsb) otomatis di-skip — caller
   * bisa cek `invalidTokens` buat bersihin token itu dari database.
   */
  async sendToTokens(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<{ successCount: number; invalidTokens: string[] }> {
    if (!this.app || !tokens.length) {
      return { successCount: 0, invalidTokens: [] };
    }

    const { getMessaging } = await import('firebase-admin/messaging');
    const messaging = getMessaging(this.app);

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((res, i) => {
      if (!res.success) {
        const code = res.error?.code;
        // Token yang emang udah gak valid lagi (device uninstall, dsb) —
        // bukan error transient (network/rate-limit) yang boleh diretry.
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[i]);
        }
      }
    });

    return { successCount: response.successCount, invalidTokens };
  }
}
