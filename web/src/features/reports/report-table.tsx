import { ChevronRight, FileSearch, MapPinOff, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, Table, Td, Th, THead, Tr } from '@/components/ui';
import { CATEGORY_LABEL, personName, tzLabel, tzOf } from '@/lib/format';
import type { ReportListItem } from '@/lib/types';
import { CategoryIcon } from './category-icon';
import { PriorityBadge, StatusBadge } from './status-badge';

const dateOnly = (d: string, tz: string) => new Date(d).toLocaleDateString('id-ID', { timeZone: tzOf(tz), day: '2-digit', month: 'short', year: 'numeric' });
const timeOnly = (d: string, tz: string) => new Date(d).toLocaleTimeString('id-ID', { timeZone: tzOf(tz), hour: '2-digit', minute: '2-digit' }) + ' ' + tzLabel(tz);
const initials = (nama: string) => nama.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function ReportTable({ rows }: { rows: ReportListItem[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState icon={<FileSearch size={24} />} tone="neutral" title="Tidak ada laporan" className="py-16">
        Coba ubah kata kunci, kategori, rentang tanggal, atau status.
      </EmptyState>
    );
  }
  return (
    <>
      <ReportCards rows={rows} />
      <div className="hidden md:block">
    <Table minWidth={900}>
      <THead>
        <Th className="pl-5">Laporan</Th>
        <Th>Bhabinkamtibmas</Th>
        <Th>Desa</Th>
        <Th>Waktu kegiatan</Th>
        <Th>Status</Th>
        <Th />
      </THead>
      <tbody>
        {rows.map((r) => {
          const href = `/laporan/${r.id}`;
          const flagged = r.isMockLocation || r.insideVillage === false;
          return (
            <Tr key={r.id} className="group relative">
              <Td className="pl-5">
                <Link href={href} className="flex items-center gap-3 after:absolute after:inset-0">
                  <CategoryIcon category={r.category} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-medium group-hover:text-primary">
                      {CATEGORY_LABEL[r.category]}
                      {r.priority && <PriorityBadge />}
                    </span>
                    <span className="block font-mono text-xs text-muted">{r.nomor}</span>
                  </span>
                </Link>
              </Td>
              <Td>
                <span className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-accent/15 text-xs font-semibold text-primary">
                    {initials(r.user.nama)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{personName(r.user)}</span>
                    <span className="block truncate text-xs text-muted">{r.unit.nama}</span>
                  </span>
                </span>
              </Td>
              <Td>
                <span className="block">{r.village.nama}</span>
                <span className="block text-xs text-muted">{r.village.kecamatan}</span>
              </Td>
              <Td nowrap>
                <span className="block">{dateOnly(r.occurredAt, r.unit.timezone)}</span>
                <span className="block text-xs text-muted">{timeOnly(r.occurredAt, r.unit.timezone)}</span>
              </Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td align="right" className="pr-5">
                <span className="inline-flex items-center gap-2 text-muted">
                  {flagged && (
                    <span title={r.isMockLocation ? 'Terdeteksi lokasi palsu' : 'Di luar desa binaan'} className="text-warn"><MapPinOff size={16} /></span>
                  )}
                  {r._count.attachments > 0 && <span title={`${r._count.attachments} lampiran`}><Paperclip size={15} /></span>}
                  <ChevronRight size={18} className="transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </span>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
      </div>
    </>
  );
}

/** Daftar berbentuk kartu untuk layar kecil. */
function ReportCards({ rows }: { rows: ReportListItem[] }) {
  return (
    <ul className="divide-y divide-line md:hidden">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/laporan/${r.id}`} className="flex gap-3 px-4 py-3.5 active:bg-bg">
            <CategoryIcon category={r.category} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="flex flex-wrap items-center gap-1.5 font-medium">
                  {CATEGORY_LABEL[r.category]}
                  {r.priority && <PriorityBadge />}
                </p>
                <StatusBadge status={r.status} />
              </div>
              <p className="truncate font-mono text-xs text-muted">{r.nomor}</p>
              <p className="mt-1.5 truncate text-sm">{personName(r.user)} · {r.village.nama}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                {dateOnly(r.occurredAt, r.unit.timezone)}, {timeOnly(r.occurredAt, r.unit.timezone)}
                {(r.isMockLocation || r.insideVillage === false) && <MapPinOff size={13} className="text-warn" />}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
