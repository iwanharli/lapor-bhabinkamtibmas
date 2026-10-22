import { History } from 'lucide-react';
import Link from 'next/link';
import { Avatar, Badge, EmptyState, Table, Td, Th, THead, Tr } from '@/components/ui';
import { personName, relatif, ROLE_LABEL, tanggalJam } from '@/lib/format';
import { ACTION_META, actionLabel } from './actions';

export interface AuditRow {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  at: string;
  actor: { id: string; nrp: string; nama: string; pangkat: string | null; role: string; unit: { nama: string } } | null;
}

const ENTITY_LINK: Record<string, (id: string) => string> = {
  report: (id) => `/laporan/${id}`,
  user: (id) => `/admin/pengguna/${id}`,
};
const ENTITY_LABEL: Record<string, string> = {
  report: 'Laporan', user: 'Pengguna', unit: 'Unit', village: 'Desa', attachment: 'Lampiran', device: 'Perangkat',
  reports: 'Data laporan', prices: 'Data harga', users: 'Data pengguna', performance: 'Data kinerja', commodity: 'Komoditas', form_schema: 'Formulir',
};

/** Ringkasan isi meta yang relevan untuk dibaca manusia. */
function metaText(a: AuditRow) {
  const m = a.meta ?? {};
  if (typeof m.note === 'string') return `“${m.note}”`;
  if (typeof m.rows === 'number') return `${m.rows.toLocaleString('id-ID')} baris`;
  if (typeof m.count === 'number') return `${m.count} pengguna`;
  if (typeof m.reason === 'string') return m.reason === 'bad_password' ? 'sandi salah' : 'akun tidak dikenal / nonaktif';
  if (typeof m.nrp === 'string') return `NRP ${m.nrp}`;
  if (Array.isArray(m.fields)) return `kolom: ${(m.fields as string[]).join(', ')}`;
  if (typeof m.client === 'string') return m.client === 'mobile' ? 'aplikasi mobile' : 'dashboard web';
  return '';
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) return <EmptyState icon={<History size={22} />} tone="neutral" title="Tidak ada aktivitas" className="py-16">Coba ubah filter atau periode.</EmptyState>;
  return (
    <Table minWidth={900}>
      <THead>
        <Th className="pl-5">Waktu</Th>
        <Th>Pelaku</Th>
        <Th>Aktivitas</Th>
        <Th>Objek</Th>
        <Th className="pr-5">Keterangan</Th>
      </THead>
      <tbody>
        {rows.map((a) => {
          const link = a.entity && a.entityId ? ENTITY_LINK[a.entity]?.(a.entityId) : undefined;
          return (
            <Tr key={a.id}>
              <Td nowrap className="pl-5">
                <span className="block">{relatif(a.at)}</span>
                <span className="block text-xs text-muted">{tanggalJam(a.at)}</span>
              </Td>
              <Td>
                {a.actor ? (
                  <span className="flex items-center gap-2.5">
                    <Avatar nama={a.actor.nama} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate">{personName(a.actor)}</span>
                      <span className="block truncate text-xs text-muted">{ROLE_LABEL[a.actor.role] ?? a.actor.role} · {a.actor.unit.nama}</span>
                    </span>
                  </span>
                ) : (
                  <span className="text-muted">Sistem / tidak dikenal</span>
                )}
              </Td>
              <Td><Badge tone={ACTION_META[a.action]?.tone ?? 'neutral'}>{actionLabel(a.action)}</Badge></Td>
              <Td>
                {a.entity ? (
                  link ? <Link href={link} className="font-medium text-primary hover:underline">{ENTITY_LABEL[a.entity] ?? a.entity}</Link> : <span>{ENTITY_LABEL[a.entity] ?? a.entity}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
                {a.entityId && <span className="block max-w-[180px] truncate font-mono text-[11px] text-muted" title={a.entityId}>{a.entityId}</span>}
              </Td>
              <Td className="pr-5 text-sm text-muted">
                <span className="line-clamp-2 max-w-sm">{metaText(a) || '—'}</span>
                {a.ip && <span className="block font-mono text-[11px]">{a.ip}</span>}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
