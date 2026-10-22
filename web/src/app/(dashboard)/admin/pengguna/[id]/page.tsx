import { notFound } from 'next/navigation';
import { BackLink, Card, SplitLayout } from '@/components/ui';
import { AccountActions } from '@/features/admin/account-actions';
import { UserForm } from '@/features/admin/user-form';
import { UserHeader } from '@/features/admin/user-header';
import { VillagePicker } from '@/features/admin/village-picker';
import { apiGet, apiGetOrNotFound, getSessionUser } from '@/lib/api/server';
import { personName } from '@/lib/format';
import type { DeviceRow, UnitOption, UserDetail, VillageOption } from '@/lib/types';

export default async function DetailPenggunaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiGetOrNotFound<UserDetail>(`/admin/users/${id}`);
  if (!u) notFound();

  const isBhabin = u.role === 'BHABIN';
  const [me, units, devices, villages] = await Promise.all([
    getSessionUser(),
    apiGet<UnitOption[]>('/units'),
    apiGet<DeviceRow[]>(`/admin/users/${id}/devices`),
    isBhabin ? apiGet<VillageOption[]>('/villages') : Promise.resolve([]),
  ]);

  return (
    <>
      <BackLink href="/admin/pengguna" />
      <div className="mb-4"><UserHeader user={u} tz={me?.unit.timezone} /></div>

      <SplitLayout
        asideSticky
        aside={
          <Card title="Akun & perangkat">
            <AccountActions userId={u.id} nrp={u.nrp} nama={personName(u)} devices={devices} tz={me?.unit.timezone} />
          </Card>
        }
      >
        <Card title="Data pengguna">
          <UserForm
            units={units}
            canAssignSuperadmin={me?.role === 'SUPERADMIN'}
            initial={{
              id: u.id, nrp: u.nrp, nama: u.nama, pangkat: u.pangkat ?? '', jabatan: u.jabatan ?? '',
              role: u.role, unitId: u.unitId, phone: u.phone ?? '', active: u.active,
            }}
          />
        </Card>
        {isBhabin && (
          <Card title="Desa binaan" subtitle={`Pilih desa di wilayah ${u.unit.nama} · ${u.villages.length} desa saat ini`}>
            <VillagePicker userId={u.id} villages={villages.filter((v) => v.polsekId === u.unitId)} selected={u.villages.map((v) => v.village.id)} />
          </Card>
        )}
      </SplitLayout>
    </>
  );
}
