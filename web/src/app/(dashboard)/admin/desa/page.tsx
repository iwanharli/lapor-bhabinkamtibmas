import Link from 'next/link';
import { Building2, Map as MapIcon, MapPinned, MapPinOff, UsersRound } from 'lucide-react';
import { Badge, Card, CellStack, cn, EmptyState, PageHeader, Pagination, SearchInput, Stack, StatCard, Table, Td, Th, THead, Tr, UrlSelect } from '@/components/ui';
import { boundaryHref } from '@/features/villages/links';
import { VillageBoundaryView } from '@/features/villages/village-boundary-view';
import { GeojsonImportButton } from '@/features/villages/geojson-import';
import type { PolsekManual, PolsekRow, PolsekWithoutRegion, RegionNode, VillageRow, VillageStats } from '@/features/villages/types';
import { AddPolsekButton, PolsekCoordinateButton } from '@/features/villages/polsek-forms';
import { VillageExplorer } from '@/features/villages/village-explorer';
import { VillageFormButton } from '@/features/villages/village-form';
import { AssignPolsekRegionButton, RemovePolsekRegionButton } from '@/features/villages/assign-polsek-region';
import { AssignVillagesButton } from '@/features/villages/assign-villages';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { apiGet } from '@/lib/api/server';
import type { Paged, UnitSummary } from '@/lib/types';
import { withParams } from '@/lib/url';

const SIZES = [20, 50, 100];
type Search = { tab?: string; kode?: string; koordinat?: string; jenis?: string; q?: string; polsekId?: string; batas?: string; page?: string; limit?: string };
const TAB_POLSEK = 'polsek-tanpa-wilayah';
const TAB_MANUAL = 'penetapan-manual';
const TAB_MAP = 'peta-batas';
const TAB_DATA = 'data-polsek';

export default async function DesaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const orphanTab = sp.tab === TAB_POLSEK;
  const manualTab = sp.tab === TAB_MANUAL;
  const mapTab = sp.tab === TAB_MAP;
  const dataTab = sp.tab === TAB_DATA;
  const kode = mapTab && sp.kode && /^[\d.]{2,13}$/.test(sp.kode) ? sp.kode : undefined;
  const filtered = !orphanTab && !manualTab && !mapTab && !dataTab && !!(sp.q || sp.polsekId || sp.batas);
  const [list, summary, roots, orphans, manual, polseks] = await Promise.all([
    apiGet<Paged<VillageRow> & { stats: VillageStats }>(withParams('/admin/villages', orphanTab || manualTab || mapTab || dataTab ? { limit: '1' } : { q: sp.q, polsekId: sp.polsekId, batas: sp.batas, page: String(page), limit: String(limit) })),
    apiGet<UnitSummary>('/units/summary'),
    filtered || orphanTab || manualTab || mapTab || dataTab ? [] : apiGet<RegionNode[]>('/admin/villages/tree'),
    apiGet<Paged<PolsekWithoutRegion> & { stats: { total: number; kawasan: number } }>(
      withParams('/admin/villages/polsek-tanpa-wilayah', orphanTab ? { q: sp.q, jenis: sp.jenis, page: String(page), limit: String(limit) } : { limit: '1' })),
    apiGet<PolsekManual[]>('/admin/villages/polsek-manual'),
    dataTab ? apiGet<Paged<PolsekRow>>(withParams('/admin/villages/polsek', { q: sp.q, koordinat: sp.koordinat, page: String(page), limit: String(limit) })) : null,
  ]);
  const { data, meta, stats } = list;

  return (
    <>
      <PageHeader
        title="Desa & Kelurahan"
        subtitle="Wilayah binaan Bhabinkamtibmas beserta batasnya — dipakai untuk memeriksa lokasi laporan"
        actions={<><AssignVillagesButton /><GeojsonImportButton /><VillageFormButton /></>}
      />
      <Stack>
        {!mapTab && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <StatCard title="Desa terdaftar" description="Dalam cakupan unit Anda" icon={<MapPinned size={20} />} value={stats.total} footer={`${summary.polsek} Polsek`} />
          <StatCard warn={stats.total - stats.dengan_polsek > 0} title="Desa punya Polsek" description="Sudah ditetapkan ke Polsek pembina" icon={<Building2 size={20} />} tone="success" value={stats.dengan_polsek}
            footer={`${stats.total ? ((stats.dengan_polsek / stats.total) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : 0}% desa`} />
          <StatCard warn={stats.kecamatan_tanpa_polsek > 0} title="Kecamatan tanpa Polsek" description="Belum ada Polsek yang terpetakan" icon={<MapPinOff size={20} />} tone="success" value={stats.kecamatan_tanpa_polsek}
            footer={stats.kecamatan_tanpa_polsek ? 'perlu daftar wilayah hukum resmi' : 'semua tercakup'} />
          <StatCard warn={stats.tanpa_bhabin > 0} title="Tanpa Bhabin" description="Desa belum dibina siapa pun" icon={<UsersRound size={20} />} tone="success"
            value={stats.tanpa_bhabin} footer={stats.tanpa_bhabin ? 'atur di halaman Pengguna' : 'semua desa terbina'} />
        </div>}

        <nav aria-label="Bagian halaman desa" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
          {[
            { href: '/admin/desa', label: 'Struktur wilayah', on: !orphanTab && !manualTab && !mapTab && !dataTab },
            { href: `/admin/desa?tab=${TAB_DATA}`, label: 'Data Polsek', on: dataTab },
            { href: `/admin/desa?tab=${TAB_POLSEK}`, label: 'Polsek tanpa wilayah', on: orphanTab, count: orphans.stats.total, warn: true },
            { href: `/admin/desa?tab=${TAB_MANUAL}`, label: 'Penetapan manual', on: manualTab, count: manual.length },
          ].map((t) => (
            <Link key={t.href} href={t.href} aria-current={t.on ? 'page' : undefined} className={cn('inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition', t.on ? 'bg-primary text-white' : 'text-muted hover:text-ink')}>
              {t.label}
              {t.count != null && <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', t.on ? 'bg-white/20 text-white' : t.warn ? 'bg-warn-soft text-warn' : 'bg-bg text-muted')}>{t.count}</span>}
            </Link>
          ))}
          </div>
          <Link href={boundaryHref()} aria-current={mapTab ? 'page' : undefined} className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ring-1 transition', mapTab ? 'bg-primary text-white ring-primary' : 'bg-surface text-ink ring-line hover:text-primary')}>
            <MapIcon size={16} /> Peta batas desa
          </Link>
        </nav>

        {mapTab ? <VillageBoundaryView key={kode ?? ''} kode={kode} /> : dataTab && polseks ? (
          <Card>
            <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
              <SearchInput placeholder="Cari Polsek, Polres, atau Polda…" className="flex-1" />
              <UrlSelect param="koordinat" label="Koordinat" options={[{ value: '', label: 'Semua koordinat' }, { value: 'ada', label: 'Ada koordinat' }, { value: 'belum', label: 'Belum ada koordinat' }]} />
              <AddPolsekButton />
            </div>
            {polseks.data.length === 0 ? (
              <EmptyState icon={<Building2 size={22} />} tone="neutral" title="Tidak ada Polsek" className="py-14">Tidak ada Polsek untuk pencarian ini.</EmptyState>
            ) : (
              <Table minWidth={860}>
                <THead>
                  <Th className="pl-5">Polsek</Th>
                  <Th>Polres / Polda</Th>
                  <Th>Kecamatan</Th>
                  <Th>Koordinat</Th>
                  <Th className="pr-5" />
                </THead>
                <tbody>
                  {polseks.data.map((o) => (
                    <Tr key={o.id}>
                      <Td className="pl-5 font-medium">{o.nama}{o.manual && <Badge tone="info" className="ml-2">Diubah admin</Badge>}</Td>
                      <Td><CellStack primary={o.polres} secondary={o.polda} /></Td>
                      <Td>{o.kecamatan.length ? o.kecamatan.join(', ') : <Badge tone="warn">Belum ada wilayah</Badge>}</Td>
                      <Td className="font-mono text-xs text-muted">{o.lat != null && o.lng != null ? `${o.lat}, ${o.lng}` : <Badge tone="warn">Belum ada</Badge>}</Td>
                      <Td align="right" className="pr-5"><PolsekCoordinateButton polsek={o} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Pagination page={page} limit={limit} total={polseks.meta.total} sizes={SIZES} noun="Polsek"
              hrefFor={(p, l) => withParams('/admin/desa', sp, { page: p > 1 ? String(p) : undefined, limit: l !== 20 ? String(l) : undefined })} />
          </Card>
        ) : manualTab ? (
          <Card>
            {manual.length === 0 ? (
              <EmptyState icon={<Building2 size={22} />} tone="neutral" title="Belum ada penetapan manual" className="py-14">Tetapkan wilayah dari tab Polsek tanpa wilayah.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {manual.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4">
                    <div className="min-w-48 flex-1">
                      <p className="font-medium">{m.nama}</p>
                      <p className="text-xs text-muted">{m.polres} · {m.polda}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.wilayah.map((w) => (
                          <span key={w.kode} title={w.chain} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary">
                            {w.nama}
                            <RemovePolsekRegionButton polsekId={m.id} polsekNama={m.nama} kode={w.kode} nama={w.nama} />
                          </span>
                        ))}
                      </div>
                    </div>
                    <AssignPolsekRegionButton polsek={m} existing={m.wilayah.map((w) => w.kode)} label="Tambah kecamatan" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : orphanTab ? (
          <Card>
            <div className="border-b border-line bg-warn-soft/40 px-4 py-3 text-sm">
              <strong className="tabular-nums">{orphans.stats.total}</strong> Polsek belum terhubung ke wilayah Kemendagri: <strong className="tabular-nums">{orphans.stats.kawasan}</strong> satuan kawasan dan <strong className="tabular-nums">{orphans.stats.total - orphans.stats.kawasan}</strong> Polsek biasa. Polsek ini tidak muncul di pohon wilayah sampai kecamatannya ditetapkan.
            </div>
            <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
              <SearchInput placeholder="Cari Polsek, Polres, atau Polda…" className="flex-1" />
              <UrlSelect param="jenis" label="Jenis" options={[{ value: '', label: 'Semua jenis' }, { value: 'biasa', label: 'Polsek biasa' }, { value: 'kawasan', label: 'Satuan kawasan' }]} />
            </div>
            {orphans.data.length === 0 ? (
              <EmptyState icon={<Building2 size={22} />} tone="neutral" title="Tidak ada Polsek" className="py-14">Tidak ada Polsek tanpa wilayah untuk pencarian ini.</EmptyState>
            ) : (
              <Table minWidth={720}>
                <THead>
                  <Th className="pl-5">Polsek</Th>
                  <Th>Polres</Th>
                  <Th>Polda</Th>
                  <Th>Jenis</Th>
                  <Th>Koordinat</Th>
                  <Th className="pr-5" />
                </THead>
                <tbody>
                  {orphans.data.map((o) => (
                    <Tr key={o.id}>
                      <Td className="pl-5 font-medium">{o.nama}</Td>
                      <Td>{o.polres}</Td>
                      <Td>{o.polda}</Td>
                      <Td>{o.kawasan ? <Badge tone="info">Kawasan</Badge> : <Badge tone="warn">Perlu ditinjau</Badge>}</Td>
                      <Td className="font-mono text-xs text-muted">{o.lat != null && o.lng != null ? `${o.lat}, ${o.lng}` : '—'}</Td>
                      <Td align="right" className="pr-5"><span className="inline-flex gap-2"><PolsekCoordinateButton polsek={o} /><AssignPolsekRegionButton polsek={o} /></span></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Pagination page={page} limit={limit} total={orphans.meta.total} sizes={SIZES} noun="Polsek"
              hrefFor={(p, l) => withParams('/admin/desa', sp, { page: p > 1 ? String(p) : undefined, limit: l !== 20 ? String(l) : undefined })} />
          </Card>
        ) : (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
            <SearchInput placeholder="Cari nama desa, kecamatan, atau kode…" className="flex-1" />
            <UrlUnitFilter param="polsekId" levels={['POLSEK']} emptyLabel="Semua Polsek" />
            <UrlSelect param="batas" label="Batas wilayah" options={[{ value: '', label: 'Semua' }, { value: 'ada', label: 'Ada batas' }, { value: 'belum', label: 'Belum ada batas' }]} />
          </div>
          {!filtered ? <VillageExplorer roots={roots} /> : (
            <>
            {data.length === 0 ? (
              <EmptyState icon={<MapPinned size={22} />} tone="neutral" title="Belum ada desa" className="py-14">Tambah desa satu per satu atau impor dari GeoJSON.</EmptyState>
            ) : (
              <Table minWidth={720}>
                <THead>
                  <Th className="pl-5">Desa</Th>
                  <Th>Polsek</Th>
                  <Th>Batas</Th>
                  <Th align="right">Bhabin</Th>
                  <Th align="right">Laporan 30 hari</Th>
                  <Th className="pr-5" />
                </THead>
                <tbody>
                  {data.map((v) => (
                    <Tr key={v.id}>
                      <Td className="pl-5">
                        <CellStack primary={<span className="font-medium">{v.nama}</span>} secondary={<><span className="font-mono">{v.kodeWilayah}</span> · {v.kecamatan}, {v.kabupaten}</>} />
                      </Td>
                      <Td>{v.polsek ?? <span className="text-muted">—</span>}</Td>
                      <Td>{v.hasGeometry ? <Badge tone="success">{v.luasKm2?.toLocaleString('id-ID')} km²</Badge> : <Badge tone="warn">Belum ada</Badge>}</Td>
                      <Td align="right" numeric className={v.bhabin ? undefined : 'font-medium text-danger'}>{v.bhabin}</Td>
                      <Td align="right" numeric>{v.laporan}</Td>
                      <Td align="right" className="pr-5"><VillageFormButton village={v} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Pagination page={page} limit={limit} total={meta.total} sizes={SIZES} noun="desa"
              hrefFor={(p, l) => withParams('/admin/desa', sp, { page: p > 1 ? String(p) : undefined, limit: l !== 20 ? String(l) : undefined })} />
            </>
          )}
        </Card>
        )}
      </Stack>
    </>
  );
}
