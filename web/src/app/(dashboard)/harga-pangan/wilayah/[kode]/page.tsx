import { ArrowLeft, ArrowRight, Shield, Store } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, EmptyState, PageHeader, Stack, Table, Td, Th, THead, Tr } from '@/components/ui';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { tanggal } from '@/lib/format';
import type { MarketPoint, PriceMarket } from '@/lib/types';
import { MarketMap } from '@/features/prices/market-map';
import { withParams } from '@/lib/url';

export const metadata = { title: 'Pasar per wilayah' };

export default async function PriceRegionPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  if (!/^[\d.]{2,13}$/.test(kode)) notFound();
  const me = await getSessionUser();
  const { wilayah, markets, titik } = await apiGet<{ wilayah: { nama: string; chain: string; satuan: string[] } | null; markets: PriceMarket[]; titik: MarketPoint[] }>(`/analytics/prices/markets?kode=${kode}`);
  if (!wilayah) notFound();
  // Pasar tradisional lebih dulu: sasaran utama pemantauan harga.
  const belum = titik.filter((m) => !m.laporan).sort((a, b) => Number(a.kategori === 'pasar_modern') - Number(b.kategori === 'pasar_modern') || a.nama.localeCompare(b.nama, 'id'));
  const dipantau = titik.length - belum.length;

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
        {titik.length > 0 && (
          <Card title="Peta pasar" subtitle={`${titik.length.toLocaleString('id-ID')} pasar terdaftar · ${dipantau.toLocaleString('id-ID')} sudah ada laporan harga 30 hari terakhir (emas), sisanya belum dipantau (putih)`} bodyClassName="p-0 overflow-hidden">
            <MarketMap points={titik} />
          </Card>
        )}
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
        {belum.length > 0 && (
          <Card title="Pasar belum dipantau" subtitle={`${belum.length.toLocaleString('id-ID')} pasar terdaftar tanpa laporan harga 30 hari terakhir`} bodyClassName="p-0">
            <ul className="grid max-h-96 divide-y divide-line overflow-y-auto sm:grid-cols-2 sm:divide-y-0">
              {belum.map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">{m.nama}<Badge tone="neutral">{m.kategori === 'pasar_modern' ? 'Modern' : 'Tradisional'}</Badge></p>
                  <p className="text-xs text-muted">{[m.desa, m.alamat].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Stack>
    </>
  );
}
