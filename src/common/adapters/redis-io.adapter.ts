import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

/**
 * Redis pub/sub adapter untuk Socket.IO - dikerjakan Sept 2026 (fase
 * "selanjutnya" yang sempat ditunda). Room Socket.IO defaultnya
 * in-memory PER SERVER; apiexhibitor & apivisitor itu proses Node.js
 * terpisah, jadi tanpa adapter ini broadcast chat:message TIDAK sampai
 * lintas server (exhibitor gak dapat update instan dari visitor,
 * begitu juga sebaliknya).
 *
 * Dengan adapter ini, KEDUA app publish/subscribe ke Redis instance
 * yang SAMA (REDIS_HOST/PORT/PASSWORD/DB dari .env) - begitu satu
 * server emit ke sebuah room, semua server lain yang subscribe ke
 * Redis yang sama ikut nerima broadcast-nya juga.
 *
 * "Fail open" konsisten dengan pola FirebaseAdminService - kalau
 * REDIS_HOST kosong atau connect gagal, adapter default (in-memory,
 * per-server) tetap dipakai, TIDAK bikin app gagal start. Nanti kalau
 * Redis down di tengah jalan, cross-server broadcast berhenti tapi
 * dalam-server tetap jalan normal.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const host = this.configService.get<string>('REDIS_HOST');
    if (!host) {
      this.logger.warn(
        'REDIS_HOST belum di-set - Socket.IO pakai in-memory adapter (broadcast TIDAK lintas server).',
      );
      return;
    }

    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;
    const db = this.configService.get<number>('REDIS_DB', 0);

    try {
      const pubClient: RedisClientType = createClient({
        socket: { host, port },
        password,
        database: db,
      });
      const subClient: RedisClientType = pubClient.duplicate();

      pubClient.on('error', (err) => this.logger.warn(`Redis pubClient error: ${err.message}`));
      subClient.on('error', (err) => this.logger.warn(`Redis subClient error: ${err.message}`));

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log(`Redis adapter Socket.IO terhubung (${host}:${port}, db ${db}).`);
    } catch (err) {
      this.logger.warn(
        `Gagal connect Redis (${host}:${port}) - fallback ke in-memory adapter. ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
