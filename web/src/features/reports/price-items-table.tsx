import { Badge, cn, Table, Td, Th, THead, Tr } from '@/components/ui';
import { rupiah } from '@/lib/format';
import type { LatestPrice, ReportPriceItem } from '@/lib/types';

const STOK: Record<ReportPriceItem['stok'], { label: string; tone: 'success' | 'warn' | 'danger' }> = {
  AMAN: { label: 'Aman', tone: 'success' },
  MENIPIS: { label: 'Menipis', tone: 'warn' },
  KOSONG: { label: 'Kosong', tone: 'danger' },
};

/** Selisih harga terhadap rata-rata wilayah; di atas ±10% disorot agar verifikator memeriksa ulang. */
function Deviation({ harga, avg }: { harga: number; avg?: number | null }) {
  if (!avg) return <span className="text-muted">—</span>;
  const pct = Math.round(((harga - avg) / avg) * 1000) / 10;
  const off = Math.abs(pct) >= 10;
  return (
    <span className={cn('whitespace-nowrap tabular-nums text-xs font-semibold', off ? 'rounded-full bg-danger-soft px-2 py-0.5 text-danger' : 'text-muted')}>
      {pct > 0 ? '+' : ''}
      {pct.toLocaleString('id-ID')}%
    </span>
  );
}

export function PriceItemsTable({ items, averages }: { items: ReportPriceItem[]; averages?: LatestPrice[] }) {
  const avg = new Map(averages?.map((a) => [a.commodity_id, a.rata2]));
  return (
    <Table>
      <THead>
        <Th className="pl-5">Komoditas</Th>
        <Th align="right">Harga dilaporkan</Th>
        <Th align="right">Rata-rata wilayah</Th>
        <Th align="right">Selisih</Th>
        <Th className="pr-5">Stok</Th>
      </THead>
      <tbody>
        {items.map((i) => (
          <Tr key={i.commodity.id}>
            <Td className="pl-5 font-medium">{i.commodity.nama}</Td>
            <Td align="right" nowrap numeric className="font-semibold">{rupiah(i.harga)}<span className="font-normal text-muted">/{i.satuan}</span></Td>
            <Td align="right" nowrap numeric muted>{avg.get(i.commodity.id) ? rupiah(avg.get(i.commodity.id)) : '—'}</Td>
            <Td align="right"><Deviation harga={i.harga} avg={avg.get(i.commodity.id)} /></Td>
            <Td className="pr-5"><Badge tone={STOK[i.stok].tone}>{STOK[i.stok].label}</Badge></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
