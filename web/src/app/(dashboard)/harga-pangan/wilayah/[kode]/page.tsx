import { ArrowLeft, ArrowRight, Shield, Store } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, EmptyState, PageHeader, Stack, Table, Td, Th, THead, Tr } from '@/components/ui';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { tanggal } from '@/lib/format';
import type { PriceMarket } from '@/lib/types';
import { withParams } from '@/lib/url';

export const metadata = { title: 'Pasar per wilayah' };

export default async function PriceRegionPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  if (!/^[\d.]{2,13}$/.test(kode)) notFound();
  const me = await getSessionUser();
  const { wilayah, markets } = await apiGet<{ wilayah: { nama: string; chain: string; satuan: string[] } | null; markets: PriceMarket[] }>(`/analytics/prices/markets?kode=${kode}`);
  if (!wilayah) notFound();

  return (
    <>
      <Link href="/harga-pangan" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> Harga Pangan</Link>
      <PageHeader title={wilayah.nama} subtitle={wilayah.chain || 'Provinsi'} />
      <Stack>
        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-4">
          <Shield size={17} className="text-primary" />
          <span className="text-sm text-muted">Satuan pembina:</span>
          {wilayah.satuan.length ? wilayah.satuan.map((s) => <Badge key={s} tone="info">{s}</Badge>) : <span className="text-sm text-muted">Belum terpetakan</span>}
        </section>
        <Card title="Daftar pasar" subtitle={`${markets.length.toLocaleString('id-ID')} pasar dari isian Bhabin, 30 hari terakhir`} bodyClassName="p-0">
          {markets.length === 0 ? (
            <EmptyState icon={<Store size={24} />} tone="neutral" title="Belum ada pasar">Belum ada laporan harga di wilayah ini dalam 30 hari terakhir.</EmptyState>
          ) : (
            <Table minWidth={800}>
              <THead>
                <Th className="pl-5">Pasar</Th>
                <Th>Lokasi</Th>
                <Th>Bhabin terakhir</Th>
                <Th align="right">Komoditas</Th>
                <Th align="right">Laporan</Th>
                <Th>Terakhir</Th>
                <Th className="pr-5" />
              </THead>
              <tbody>
                {markets.map((m) => (
                  <Tr key={`${m.village_id}-${m.nama}`}>
                    <Td className="pl-5"><span className="font-medium">{m.nama}</span><span className="block text-xs text-muted">{m.jenis}</span></Td>
                    <Td><span className="text-sm">{m.desa}</span><span className="block text-xs text-muted">Kec. {m.kecamatan}</span></Td>
                    <Td className="text-sm">{m.bhabin}</Td>
                    <Td align="right" numeric>{m.komoditas}</Td>
                    <Td align="right" numeric>{m.laporan}</Td>
                    <Td className="text-sm">{tanggal(m.terakhir, me?.unit.timezone)}</Td>
                    <Td align="right" className="pr-5">
                      <Link href={withParams('/harga-pangan/pasar', { desa: m.village_id, nama: m.nama })} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft">Detail <ArrowRight size={13} /></Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Stack>
    </>
  );
}
