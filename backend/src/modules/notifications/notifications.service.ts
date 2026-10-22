import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';

export const NOTIF = {
  REPORT_PRIORITY: 'REPORT_PRIORITY',
  REPORT_LOCATION: 'REPORT_LOCATION',
  VILLAGES_UPDATED: 'VILLAGES_UPDATED',
} as const;

/**
 * Notifikasi dalam aplikasi. Penerima laporan dihitung dari unit induk pelapor:
 * prioritas → Pimpinan & Admin Unit di Polsek/Polres/Polda (tanpa Mabes agar tidak banjir secara nasional);
 * lokasi perlu dicek → Pimpinan & Admin Unit di Polsek/Polres.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /** Buat notifikasi untuk laporan terkirim (prioritas / lokasi janggal). Idempoten; kegagalan hanya dicatat. */
  async onReportsSubmitted(reportIds: string[]) {
    if (!reportIds.length) return 0;
    try {
      const [priority, location] = await Promise.all([
        this.fanOut(reportIds, NOTIF.REPORT_PRIORITY, Prisma.sql`r.priority`, ['POLSEK', 'POLRES', 'POLDA'],
          Prisma.sql`'Deteksi dini urgensi tinggi · ' || v.nama`,
          Prisma.sql`coalesce(r.data->>'kategori_kerawanan', 'Kerawanan') || ' — ' || left(coalesce(r.data->>'uraian', ''), 160) || ' (' || concat_ws(' ', u.pangkat, u.nama) || ')'`),
        this.fanOut(reportIds, NOTIF.REPORT_LOCATION, Prisma.sql`(r.is_mock_location OR r.inside_village = false)`, ['POLSEK', 'POLRES'],
          Prisma.sql`'Lokasi laporan perlu dicek · ' || v.nama`,
          Prisma.sql`r.nomor || ' — ' || CASE WHEN r.is_mock_location THEN 'lokasi palsu terdeteksi' ELSE 'di luar desa binaan' END || ' (' || concat_ws(' ', u.pangkat, u.nama) || ')'`),
      ]);
      return priority + location;
    } catch (e) {
      this.logger.error(e);
      return 0;
    }
  }

  private fanOut(reportIds: string[], type: string, when: Prisma.Sql, levels: string[], title: Prisma.Sql, body: Prisma.Sql) {
    return this.prisma.$executeRaw`
      WITH RECURSIVE r AS (
        SELECT r.* FROM reports r WHERE r.id = ANY(${reportIds}::uuid[]) AND r.status = 'SUBMITTED' AND ${when}
      ), anc AS (
        SELECT r.id AS report_id, un.id AS unit_id, un.parent_id, un.level FROM r JOIN units un ON un.id = r.unit_id
        UNION ALL
        SELECT anc.report_id, p.id, p.parent_id, p.level FROM anc JOIN units p ON p.id = anc.parent_id
      )
      INSERT INTO notifications (user_id, type, title, body, link, entity_id, created_at)
      SELECT DISTINCT ON (rcpt.id, r.id) rcpt.id, ${type}, ${title}, ${body}, '/laporan/' || r.id, r.id, coalesce(r.submitted_at, now())
      FROM r
      JOIN anc ON anc.report_id = r.id AND anc.level::text = ANY(${levels}::text[])
      JOIN users rcpt ON rcpt.unit_id = anc.unit_id AND rcpt.active AND rcpt.role IN ('PIMPINAN', 'ADMIN_UNIT')
      JOIN villages v ON v.id = r.village_id
      JOIN users u ON u.id = r.user_id
      ON CONFLICT (user_id, type, entity_id) DO NOTHING`;
  }

  /** Bhabin diberi tahu bila desa binaannya diubah admin. */
  async onVillagesUpdated(userId: string, villageNames: string[]) {
    await this.prisma.notification.create({
      data: {
        userId, type: NOTIF.VILLAGES_UPDATED, title: 'Desa binaan diperbarui',
        body: villageNames.length ? `Desa binaan Anda sekarang: ${villageNames.join(', ')}` : 'Anda belum memiliki desa binaan.', link: '/bhabin',
      },
    }).catch((e) => this.logger.error(e));
  }

  async list(me: AuthUser, q: { unread?: boolean; page: number; limit: number }) {
    const where: Prisma.NotificationWhereInput = { userId: me.id, ...(q.unread && { readAt: null }) };
    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: q.limit, skip: (q.page - 1) * q.limit }),
      this.prisma.notification.count({ where }),
      this.unreadCount(me),
    ]);
    // Bhabin membuka laporan di tampilan lapangan.
    const fix = (link: string | null) => (me.role === 'BHABIN' && link?.startsWith('/laporan/') ? `/bhabin${link}` : link);
    return { data: data.map((n) => ({ ...n, link: fix(n.link) })), meta: { page: q.page, limit: q.limit, total }, unread };
  }

  unreadCount(me: AuthUser) {
    return this.prisma.notification.count({ where: { userId: me.id, readAt: null } });
  }

  async markRead(me: AuthUser, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId: me.id, readAt: null }, data: { readAt: new Date() } });
    return { unread: await this.unreadCount(me) };
  }

  async markAllRead(me: AuthUser) {
    const res = await this.prisma.notification.updateMany({ where: { userId: me.id, readAt: null }, data: { readAt: new Date() } });
    return { updated: res.count, unread: 0 };
  }
}
