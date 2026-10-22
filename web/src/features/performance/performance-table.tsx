import { ArrowDown, MapPinOff, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { Avatar, Badge, cn, EmptyState, Table, Td, Th, THead, Tr } from '@/components/ui';
import { CATEGORY_COLOR } from '@/features/map/categories';
import { CATEGORY_LABEL, personName, relatif, tanggalJam } from '@/lib/format';
import { attendance, CATEGORY_KEYS, type BhabinPerformance } from './types';

export type SortKey = 'total' | 'hari' | 'setuju' | 'nama';

function SortHeader({ k, active, hrefFor, children, align }: { k: SortKey; active: SortKey; hrefFor: (k: SortKey) => string; children: React.ReactNode; align?: 'right' }) {
  return (
    <Th align={align}>
      <Link href={hrefFor(k)} scroll={false} className={cn('inline-flex items-center gap-1 hover:text-ink', active === k && 'text-primary')}>
        {children}
        {active === k && <ArrowDown size={12} />}
      </Link>
    </Th>
  );
}

/** Komposisi kategori laporan sebagai satu batang bertumpuk. */
function CategoryMix({ b }: { b: BhabinPerformance }) {
  if (!b.total) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex h-2 w-32 overflow-hidden rounded-full bg-line" title={CATEGORY_KEYS.filter((k) => b[k]).map((k) => `${CATEGORY_LABEL[k.toUpperCase()]}: ${b[k]}`).join('\n')}>
      {CATEGORY_KEYS.map((k) => b[k] ? <span key={k} style={{ width: `${(b[k] / b.total) * 100}%`, background: CATEGORY_COLOR[k.toUpperCase()] }} /> : null)}
    </div>
  );
}

export function PerformanceTable({ rows, days, sort, hrefFor }: { rows: BhabinPerformance[]; days: number; sort: SortKey; hrefFor: (k: SortKey) => string }) {
  if (!rows.length) return <EmptyState icon={<UsersRound size={22} />} tone="neutral" title="Belum ada Bhabin aktif">Tambahkan Bhabin di menu Pengguna.</EmptyState>;
  return (
    <Table minWidth={1040}>
      <THead>
        <SortHeader k="nama" active={sort} hrefFor={hrefFor}>Bhabinkamtibmas</SortHeader>
        <SortHeader k="total" active={sort} hrefFor={hrefFor} align="right">Laporan</SortHeader>
        <SortHeader k="hari" active={sort} hrefFor={hrefFor}>Hari aktif melapor</SortHeader>
        <Th>Komposisi kategori</Th>
        <SortHeader k="setuju" active={sort} hrefFor={hrefFor} align="right">Disetujui</SortHeader>
        <Th align="right">Revisi / ditolak</Th>
        <Th className="pr-5">Terakhir melapor</Th>
      </THead>
      <tbody>
        {rows.map((b) => {
          const pct = Math.min(Math.round((b.hari_aktif / days) * 100), 100);
          const att = attendance(pct);
          const decided = b.disetujui + b.revisi + b.ditolak;
          const approval = decided ? Math.round((b.disetujui / decided) * 100) : null;
          return (
            <Tr key={b.id} className="group relative">
              <Td className="min-w-[260px] pl-5">
                <Link href={`/laporan?q=${encodeURIComponent(b.nama)}&rentang=semua`} className="flex items-center gap-3 after:absolute after:inset-0" title="Lihat laporan Bhabin ini">
                  <Avatar nama={b.nama} />
                  <span className="min-w-0">
                    <span className="block font-medium group-hover:text-primary">{personName(b)}</span>
                    <span className="block whitespace-nowrap text-xs text-muted">{b.unit} · {b.desa} desa binaan</span>
                  </span>
                </Link>
              </Td>
              <Td align="right" numeric className="text-base font-semibold">{b.total}</Td>
              <Td>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-24 rounded-full bg-line"><div className={cn('h-2 rounded-full', att.bar)} style={{ width: `${pct}%` }} /></div>
                  <span className="w-20 text-xs tabular-nums text-muted">{b.hari_aktif}/{days} hari</span>
                  <Badge tone={att.tone}>{att.label}</Badge>
                </div>
              </Td>
              <Td><CategoryMix b={b} /></Td>
              <Td align="right" numeric>
                {approval == null ? <span className="text-muted">—</span> : <span className={cn(approval < 60 && 'text-danger', approval >= 85 && 'text-success')}>{approval}%</span>}
              </Td>
              <Td align="right" numeric className="text-muted">
                {b.revisi} / {b.ditolak}
                {b.lokasi_janggal > 0 && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-warn" title={`${b.lokasi_janggal} laporan dengan lokasi perlu dicek`}><MapPinOff size={13} />{b.lokasi_janggal}</span>
                )}
              </Td>
              <Td nowrap className="pr-5">
                {b.terakhir_sepanjang ? (
                  <span title={tanggalJam(b.terakhir_sepanjang, b.timezone)} className={cn(Date.now() - Date.parse(b.terakhir_sepanjang) > 7 * 86_400_000 && 'font-medium text-danger')}>
                    {relatif(b.terakhir_sepanjang, b.timezone)}
                  </span>
                ) : (
                  <span className="font-medium text-danger">Belum pernah</span>
                )}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
