import Link from 'next/link';
import { Table, Td, Th, THead, Tr } from '@/components/ui';
import { rupiah } from '@/lib/format';
import type { LatestPrice } from '@/lib/types';
import { PriceChange } from './price-change';

const perUnit = (p: LatestPrice) => (p.rata2 ? `${rupiah(p.rata2)}/${p.satuan}` : '—');

/** Lengkap untuk halaman harga pangan; baris dapat dipilih lewat URL. */
export function LatestPriceTable({ prices, selectedId, hrefFor }: { prices: LatestPrice[]; selectedId?: number; hrefFor: (commodityId: number) => string }) {
  return (
    <Table minWidth={760}>
      <THead>
        <Th>Komoditas</Th>
        <Th align="right">Rata-rata</Th>
        <Th align="right">Perubahan</Th>
        <Th align="right">Rentang</Th>
        <Th align="right">Sampel</Th>
        <Th>Stok menipis/kosong</Th>
      </THead>
      <tbody>
        {prices.map((p) => {
          const active = p.commodity_id === selectedId;
          return (
            <Tr key={p.commodity_id} active={active}>
              <Td>
                <Link href={hrefFor(p.commodity_id)} scroll={false} className="font-medium text-primary hover:underline">{p.nama}</Link>
              </Td>
              <Td align="right" nowrap numeric>{perUnit(p)}</Td>
              <Td align="right"><PriceChange now={p.rata2} prev={p.rata2_sebelumnya} /></Td>
              <Td align="right" nowrap numeric muted>{p.minimum ? `${rupiah(p.minimum)} – ${rupiah(p.maksimum)}` : '—'}</Td>
              <Td align="right" numeric>{p.sampel}</Td>
              <Td>
                {p.stok_menipis + p.stok_kosong === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  <>
                    <span className="text-warn">{p.stok_menipis} menipis</span>
                    {p.stok_kosong > 0 && <span className="text-danger"> · {p.stok_kosong} kosong</span>}
                  </>
                )}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
