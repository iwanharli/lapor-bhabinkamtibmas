'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Alert, Button, ButtonLink, Checkbox, ErrorText, Field, FormGrid, Input, Select } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { ROLE_LABEL } from '@/lib/format';
import type { UnitOption } from '@/lib/types';
import { ASSIGNABLE_ROLES, unitOptions } from '@/lib/units';
import { TempPassword } from './temp-password';

export interface UserFormValue {
  id?: string;
  nrp: string;
  nama: string;
  pangkat: string;
  jabatan: string;
  role: string;
  unitId: string;
  phone: string;
  active: boolean;
}

const EMPTY: UserFormValue = { nrp: '', nama: '', pangkat: '', jabatan: '', role: 'BHABIN', unitId: '', phone: '', active: true };

/** Peran yang semestinya ditempatkan di Polsek; dipakai hanya sebagai petunjuk. */
const POLSEK_ROLES = ['BHABIN', 'VERIFIKATOR'];

function validate(v: UserFormValue) {
  if (!/^\d{4,20}$/.test(v.nrp.trim())) return 'NRP harus berupa angka 4–20 digit.';
  if (v.nama.trim().length < 2) return 'Nama wajib diisi.';
  if (!v.unitId) return 'Pilih unit.';
  return null;
}

export function UserForm({
  units,
  initial,
  canAssignSuperadmin,
  onDone,
}: {
  units: UnitOption[];
  initial?: UserFormValue;
  canAssignSuperadmin: boolean;
  /** Bila diisi (mis. di dalam modal), tampilkan tombol Batal/Tutup yang memanggil ini. */
  onDone?: () => void;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [v, setV] = useState<UserFormValue>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [created, setCreated] = useState<{ id: string; password: string } | null>(null);

  const options = useMemo(() => unitOptions(units), [units]);
  const roles = canAssignSuperadmin ? [...ASSIGNABLE_ROLES, 'SUPERADMIN'] : ASSIGNABLE_ROLES;
  const unitLevel = units.find((u) => u.id === v.unitId)?.level;
  const unitHint = POLSEK_ROLES.includes(v.role) && unitLevel && unitLevel !== 'POLSEK' ? `${ROLE_LABEL[v.role]} biasanya ditempatkan di Polsek.` : undefined;

  const set = <K extends keyof UserFormValue>(k: K, val: UserFormValue[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setSaved(false);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validate(v);
    if (invalid) return setError(invalid);
    setError('');

    const payload = {
      nama: v.nama.trim(),
      pangkat: v.pangkat.trim() || undefined,
      jabatan: v.jabatan.trim() || undefined,
      role: v.role,
      unitId: v.unitId,
      phone: v.phone.trim() || undefined,
    };
    setBusy(true);
    try {
      if (isEdit) {
        await callApi(`/admin/users/${initial!.id}`, { method: 'PATCH', body: { ...payload, active: v.active } });
        setSaved(true);
        router.refresh();
      } else {
        const res = await callApi<{ user: { id: string }; temporaryPassword: string }>('/admin/users', {
          method: 'POST',
          body: { ...payload, nrp: v.nrp.trim() },
        });
        setCreated({ id: res.user.id, password: res.temporaryPassword });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4 p-5">
        <p className="font-semibold text-success">Pengguna {v.nama} berhasil dibuat.</p>
        <TempPassword password={created.password} nrp={v.nrp} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/admin/pengguna/${created.id}`}>{v.role === 'BHABIN' ? 'Lanjut atur desa binaan' : 'Buka detail pengguna'}</ButtonLink>
          <Button variant="secondary" onClick={() => { setCreated(null); setV({ ...EMPTY, unitId: v.unitId, role: v.role }); }}>
            Tambah pengguna lain
          </Button>
          {onDone && <Button variant="ghost" onClick={onDone}>Tutup</Button>}
        </div>
      </div>
    );
  }

  return (
    <FormGrid onSubmit={submit} className="p-5">
      <Field label="NRP" required hint={isEdit ? 'NRP tidak dapat diubah.' : undefined}>
        {(id) => <Input id={id} inputMode="numeric" value={v.nrp} disabled={isEdit} onChange={(e) => set('nrp', e.target.value)} />}
      </Field>
      <Field label="Nama lengkap" required hint="Tanpa pangkat">
        {(id) => <Input id={id} value={v.nama} onChange={(e) => set('nama', e.target.value)} />}
      </Field>
      <Field label="Pangkat">
        {(id) => <Input id={id} value={v.pangkat} onChange={(e) => set('pangkat', e.target.value)} placeholder="mis. Bripka" />}
      </Field>
      <Field label="Jabatan">
        {(id) => <Input id={id} value={v.jabatan} onChange={(e) => set('jabatan', e.target.value)} />}
      </Field>
      <Field label="Peran" required>
        {(id) => (
          <Select id={id} value={v.role} onChange={(e) => set('role', e.target.value)}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Unit" required hint={unitHint}>
        {(id) => (
          <Select id={id} value={v.unitId} onChange={(e) => set('unitId', e.target.value)}>
            <option value="">— Pilih unit —</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
        )}
      </Field>
      <Field label="No. HP">
        {(id) => <Input id={id} inputMode="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} />}
      </Field>
      {isEdit && (
        <Field label="Status akun" hint={!v.active ? 'Akun nonaktif tidak dapat login; semua sesinya dicabut.' : undefined}>
          {(id) => <Checkbox id={id} label="Aktif" className="py-2" checked={v.active} onChange={(e) => set('active', e.target.checked)} />}
        </Field>
      )}

      {isEdit && initial?.role === 'BHABIN' && v.unitId !== initial.unitId && (
        <Alert tone="warn" className="sm:col-span-2">Unit berubah: periksa kembali desa binaan setelah menyimpan.</Alert>
      )}
      <div className="sm:col-span-2"><ErrorText>{error}</ErrorText></div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="lg" loading={busy} loadingText="Menyimpan…">{isEdit ? 'Simpan perubahan' : 'Tambah pengguna'}</Button>
        {onDone && !isEdit && <Button variant="secondary" size="lg" onClick={onDone} disabled={busy}>Batal</Button>}
        {saved && <span className="text-sm text-success">Tersimpan ✓</span>}
      </div>
    </FormGrid>
  );
}
