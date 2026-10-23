import { MapPinned, MapPinOff, Shapes, UsersRound } from 'lucide-react';
import { Badge, Card, CellStack, EmptyState, PageHeader, Pagination, SearchInput, Stack, StatCard, Table, Td, Th, THead, Tr, UrlSelect } from '@/components/ui';
import { BoundaryMap } from '@/features/villages/boundary-map';
import { GeojsonImportButton } from '@/features/villages/geojson-import';
import type { VillageGeoJson, VillageRow, VillageStats } from '@/features/villages/types';
import { VillageFormButton } from '@/features/villages/village-form';
import { AssignVillagesButton } from '@/features/villages/assign-villages';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { apiGet } from '@/lib/api/server';
import type { Paged, UnitSummary } from '@/lib/types';
import { withParams } from '@/lib/url';

const SIZES = [20, 50, 100];
type Search = { q?: string; polsekId?: string; batas?: string; page?: string; limit?: string };

export default async function DesaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const [list, geo, summary] = await Promise.all([
    apiGet<Paged<VillageRow> & { stats: VillageStats }>(withParams('/admin/villages', { q: sp.q, polsekId: sp.polsekId, batas: sp.batas, page: String(page), limit: String(limit) })),
    apiGet<VillageGeoJson>(withParams('/villages/geojson', { polsekId: sp.polsekId })),
    apiGet<UnitSummary>('/units/summary'),
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <StatCard title="Desa terdaftar" description="Dalam cakupan unit Anda" icon={<MapPinned size={20} />} value={stats.total} footer={`${summary.polsek} Polsek`} />
          <StatCard title="Punya batas wilayah" description="Poligon untuk cek lokasi" icon={<Shapes size={20} />} tone="success" value={stats.dengan_batas}
            footer={`${stats.total ? Math.round((stats.dengan_batas / stats.total) * 100) : 0}% desa`} />
          <StatCard alert={stats.total - stats.dengan_batas > 0} title="Belum ada batas" description="Lokasi laporan tidak bisa diperiksa" icon={<MapPinOff size={20} />} tone="success"
            value={stats.total - stats.dengan_batas} footer={stats.total - stats.dengan_batas ? 'impor GeoJSON untuk melengkapi' : 'semua lengkap'} />
          <StatCard alert={stats.tanpa_bhabin > 0} title="Tanpa Bhabin" description="Desa belum dibina siapa pun" icon={<UsersRound size={20} />} tone="success"
            value={stats.tanpa_bhabin} footer={stats.tanpa_bhabin ? 'atur di halaman Pengguna' : 'semua desa terbina'} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
              <SearchInput placeholder="Cari nama desa, kecamatan, atau kode…" className="flex-1" />
              <UrlUnitFilter param="polsekId" levels={['POLSEK']} emptyLabel="Semua Polsek" />
              <UrlSelect param="batas" label="Batas wilayah" options={[{ value: '', label: 'Semua' }, { value: 'ada', label: 'Ada batas' }, { value: 'belum', label: 'Belum ada batas' }]} />
            </div>
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
          </Card>

          <Card title="Peta batas desa" subtitle={`${(geo.total ?? geo.features.length).toLocaleString('id-ID')} desa berbatas`} className="flex flex-col self-start xl:sticky xl:top-20" bodyClassName="h-[460px]">
            {geo.features.length ? <BoundaryMap data={geo} />
              : geo.truncated ? <EmptyState icon={<Shapes size={22} />} tone="neutral" title="Terlalu banyak desa untuk digambar" className="h-full">Pilih Polsek di filter untuk melihat batas desanya di peta.</EmptyState>
              : <EmptyState icon={<Shapes size={22} />} tone="neutral" title="Belum ada batas wilayah" className="h-full">Impor GeoJSON untuk menampilkan peta.</EmptyState>}
          </Card>
        </div>
      </Stack>
    </>
  );
}
