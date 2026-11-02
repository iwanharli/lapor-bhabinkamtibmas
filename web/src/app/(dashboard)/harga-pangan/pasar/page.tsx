import { ArrowLeft, CalendarClock, MapPin, Store, UserRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, cn, EmptyState, PageHeader, Stack, Table, Td, Th, THead, Tr } from '@/components/ui';
import { apiGetOrNotFound, getSessionUser } from '@/lib/api/server';
import { rupiah, tanggal, tanggalJam } from '@/lib/format';
import type { PriceMarketDetail } from '@/lib/types';
import { withParams } from '@/lib/url';

export const metadata = { title: 'Detail pasar' };

const STOCK: Record<string, { label: string; tone: 'success' | 'warn' | 'danger' }> = {
  AMAN: { label: 'Aman', tone: 'success' }, MENIPIS: { label: 'Menipis', tone: 'warn' }, KOSONG: { label: 'Kosong', tone: 'danger' },
};

/** Garis harga kecil dari seluruh laporan pasar ini. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-muted">1 laporan</span>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${26 - ((v - min) / span) * 22}`).join(' ');
  return <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-28 text-primary" aria-hidden><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

export default async function PriceMarketPage({ searchParams }: { searchParams: Promise<{ desa?: string; nama?: string }> }) {
  const sp = await searchParams;
  if (!sp.desa || !sp.nama) notFound();
  const d = await apiGetOrNotFound<PriceMarketDetail>(withParams('/analytics/prices/market', { desa: sp.desa, nama: sp.nama }));
  if (!d) notFound();
  const me = await getSessionUser();
  const tz = me?.unit.timezone;

  // Per toko: harga terakhir tiap komoditas (riwayat sudah urut waktu, jadi catatan terbaru menimpa yang lama).
  const byShop = new Map<string, { nama: string; pemilik: string | null; terakhir: string; items: Map<string, { nama: string; satuan: string; harga: number; stok: string }> }>();
  for (const k of d.komoditas) {
    for (const x of k.riwayat) {
      if (!x.kios) continue;
      const key = x.kios.toLowerCase();
      const shop = byShop.get(key) ?? { nama: x.kios, pemilik: null, terakhir: x.t, items: new Map() };
      if (x.t >= shop.terakhir) shop.terakhir = x.t;
      shop.pemilik = x.pemilik ?? shop.pemilik;
      shop.items.set(k.nama, { nama: k.nama, satuan: k.satuan, harga: x.h, stok: x.s });
      byShop.set(key, shop);
    }
  }
  const shops = [...byShop.values()].map((x) => ({ ...x, items: [...x.items.values()] })).sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

  return (
    <>
      <Link href={`/harga-pangan/wilayah/${d.info.kode_wilayah.slice(0, 8)}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> Pasar di kecamatan ini</Link>
      <PageHeader title={d.info.nama} subtitle={d.info.jenis} />
      <Stack>
        <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: MapPin, label: 'Lokasi', value: d.info.desa, sub: d.info.chain },
            { icon: UserRound, label: 'Bhabin terakhir', value: d.info.bhabin },
            { icon: CalendarClock, label: 'Laporan terakhir', value: tanggal(d.info.terakhir, tz), sub: `${d.info.laporan} laporan, 90 hari` },
            { icon: Store, label: 'Kios tercatat', value: d.info.kios.length ? d.info.kios.join(', ') : 'Tidak dicatat' },
          ].map((x) => (
            <div key={x.label} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><x.icon size={17} /></span>
              <div className="min-w-0"><p className="text-xs text-muted">{x.label}</p><p className="text-sm font-medium">{x.value}</p>{x.sub && <p className="text-xs text-muted">{x.sub}</p>}</div>
            </div>
          ))}
        </section>
        <Card title="Detail komoditas" subtitle="Harga dari laporan Bhabin di pasar ini, 90 hari terakhir" bodyClassName="p-0">
          <Table minWidth={860}>
            <THead>
              <Th className="pl-5">Komoditas</Th>
              <Th align="right">Harga terakhir</Th>
              <Th align="right">Perubahan</Th>
              <Th align="right">Terendah – tertinggi</Th>
              <Th>Riwayat</Th>
              <Th>Stok terakhir</Th>
              <Th className="pr-5">Tanggal</Th>
            </THead>
            <tbody>
              {d.komoditas.map((k) => {
                const values = k.riwayat.map((x) => x.h);
                const last = k.riwayat[k.riwayat.length - 1];
                const prev = k.riwayat[k.riwayat.length - 2];
                const change = prev ? ((last.h - prev.h) / prev.h) * 100 : null;
                const stock = STOCK[last.s];
                return (
                  <Tr key={k.commodity_id}>
                    <Td className="pl-5 font-medium">{k.nama}</Td>
                    <Td align="right" numeric><strong>{rupiah(last.h)}</strong><span className="text-xs text-muted">/{k.satuan}</span></Td>
                    <Td align="right" numeric className={cn('text-sm', change == null || !change ? 'text-muted' : change > 0 ? 'text-danger' : 'text-success')}>{change == null ? '—' : `${change > 0 ? '+' : ''}${change.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`}</Td>
                    <Td align="right" numeric className="text-sm text-muted">{rupiah(Math.min(...values))} – {rupiah(Math.max(...values))}</Td>
                    <Td><Spark values={values} /></Td>
                    <Td>{stock ? <Badge tone={stock.tone}>{stock.label}</Badge> : '—'}</Td>
                    <Td className="pr-5 text-sm">{tanggal(last.t, tz)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <Card title="Toko / kios per komoditas" subtitle="Harga terakhir tiap toko, dari isian Bhabin 90 hari terakhir" bodyClassName="p-0">
          {shops.length === 0 ? (
            <EmptyState icon={<Store size={24} />} tone="neutral" title="Belum ada nama toko">Bhabin belum mengisi nama kios pada laporan di pasar ini.</EmptyState>
          ) : (
            <ul className="grid divide-y divide-line lg:grid-cols-2 lg:divide-y-0 lg:gap-px lg:bg-line">
              {shops.map((shop) => (
                <li key={shop.nama} className="bg-surface px-5 py-4">
                  <p className="flex items-center gap-2 font-semibold"><Store size={16} className="shrink-0 text-primary" /> {shop.nama}</p>
                  <p className="mt-0.5 text-xs text-muted">{shop.pemilik ? `Pemilik ${shop.pemilik} · ` : ''}Terakhir dicatat {tanggal(shop.terakhir, tz)} · {shop.items.length} komoditas</p>
                  <ul className="mt-2.5 space-y-1 text-sm">
                    {shop.items.map((i) => (
                      <li key={i.nama} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{i.nama}</span>
                        {STOCK[i.stok] && i.stok !== 'AMAN' && <Badge tone={STOCK[i.stok].tone}>{STOCK[i.stok].label}</Badge>}
                        <strong className="tabular-nums">{rupiah(i.harga)}</strong><span className="text-xs text-muted">/{i.satuan}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Riwayat pencatatan Bhabin" subtitle={`${d.riwayat.length} laporan terakhir di pasar ini`} bodyClassName="p-0">
          <Table minWidth={760}>
            <THead>
              <Th className="pl-5">Waktu</Th>
              <Th>Bhabin</Th>
              <Th>Toko / kios</Th>
              <Th align="right">Komoditas</Th>
              <Th>Lokasi</Th>
              <Th className="pr-5">Laporan</Th>
            </THead>
            <tbody>
              {d.riwayat.map((h) => (
                <Tr key={h.id}>
                  <Td className="pl-5 text-sm">{tanggalJam(h.waktu, tz)}</Td>
                  <Td><span className="text-sm font-medium">{h.bhabin}</span><span className="block font-mono text-xs text-muted">NRP {h.nrp}</span></Td>
                  <Td className="text-sm">{h.kios ?? <span className="text-muted">Tidak diisi</span>}</Td>
                  <Td align="right" numeric>{h.komoditas}</Td>
                  <Td>{h.mock ? <Badge tone="danger">Lokasi palsu</Badge> : h.inside === false ? <Badge tone="warn">Di luar desa</Badge> : <Badge tone="success">Sesuai desa</Badge>}</Td>
                  <Td className="pr-5"><Link href={`/laporan/${h.id}`} className="font-mono text-xs text-primary hover:underline">{h.nomor}</Link></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Stack>
    </>
  );
}
