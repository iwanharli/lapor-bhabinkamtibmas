import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { Subject } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const CHANNEL = 'tracking_live';

/**
 * Bus event lintas proses lewat Postgres LISTEN/NOTIFY: posisi yang diterima satu instance API
 * sampai ke layar Monitoring yang tersambung ke instance lain (PM2 cluster / beberapa server).
 * Satu koneksi pg khusus untuk LISTEN per proses; tersambung ulang otomatis bila putus.
 */
@Injectable()
export class LiveBus<T = unknown> implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(LiveBus.name);
  readonly events = new Subject<T>();
  private client?: Client;
  private closing = false;
  private retry?: ReturnType<typeof setTimeout>;

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  onModuleInit() {
    void this.connect();
  }

  async onApplicationShutdown() {
    this.closing = true;
    clearTimeout(this.retry);
    await this.client?.end().catch(() => undefined);
  }

  /** Siarkan ke semua instance (termasuk diri sendiri lewat LISTEN). Gagal kirim tidak menggagalkan permintaan. */
  async publish(event: T) {
    await this.prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(event)})`.catch((e) => this.logger.warn(`pg_notify gagal: ${e}`));
  }

  private async connect(delay = 0) {
    if (this.closing) return;
    if (delay) {
      this.retry = setTimeout(() => void this.connect(), delay);
      return;
    }
    // Parameter khusus Prisma (?schema=…) tidak dikenal pg.
    const url = new URL(this.config.getOrThrow<string>('DATABASE_URL'));
    url.searchParams.delete('schema');
    url.searchParams.delete('connection_limit');
    const client = new Client({ connectionString: url.toString() });
    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        this.events.next(JSON.parse(msg.payload) as T);
      } catch {
        // payload rusak diabaikan
      }
    });
    client.on('error', (e) => {
      this.logger.warn(`Koneksi LISTEN putus: ${e.message}`);
      void client.end().catch(() => undefined);
      if (this.client === client) this.client = undefined;
      void this.connect(3000);
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      this.client = client;
    } catch (e) {
      this.logger.warn(`LISTEN gagal, dicoba lagi: ${(e as Error).message}`);
      void client.end().catch(() => undefined);
      void this.connect(5000);
    }
  }
}
