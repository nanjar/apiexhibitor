import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    autoLoadEntities: true,
    // Skema dikelola lewat migration apivisitor (repo terpisah) untuk
    // tabel exhibitor_app_* & exhibitor_member_status_sync - apiexhibitor
    // TIDAK punya migration sendiri untuk tabel-tabel itu, cukup baca
    // entity yang match. synchronize WAJIB false - satu DB dipakai bersama
    // apivisitor, auto-sync bisa merusak skema yang dikelola repo lain.
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  }),
);
