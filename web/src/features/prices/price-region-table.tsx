import { ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';
import { Table, Td, Th, THead, Tr } from '@/components/ui';
import type { PriceRegion } from '@/lib/types';

const n = (x: number) => x.toLocaleString('id-ID');

/** Rekap wilayah di bawah filter aktif, beserta satuan Polri pembinanya; Detail membuka daftar pasar. */
export function PriceRegionTable({ rows }: { rows: PriceRegion[] }) {
  return (
    <Table minWidth={760}>
      <THead>
        <Th className="pl-5">Wilayah</Th>
        <Th>Satuan pembina</Th>
        <Th align="right">Desa</Th>
        <Th align="right">Pasar</Th>
        <Th align="right">Laporan</Th>
        <Th className="pr-5" />
      </THead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.kode}>
            <Td className="pl-5"><span className="font-medium">{r.nama}</span><span className="block font-mono text-xs text-muted">{r.kode}</span></Td>
            <Td>{r.satuan.length ? <span className="inline-flex items-center gap-1.5 text-sm"><Shield size={14} className="shrink-0 text-primary" />{r.satuan.join(', ')}</span> : <span className="text-sm text-muted">Belum terpetakan</span>}</Td>
            <Td align="right" numeric>{n(r.desa)}</Td>
            <Td align="right" numeric>{n(r.pasar)}</Td>
            <Td align="right" numeric>{n(r.laporan)}</Td>
            <Td align="right" className="pr-5">
              <Link href={`/harga-pangan/wilayah/${r.kode}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft">Detail <ArrowRight size={13} /></Link>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
