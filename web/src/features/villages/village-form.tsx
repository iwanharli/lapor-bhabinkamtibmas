'use client';

import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ErrorText, Field, FormGrid, Input, Modal } from '@/components/ui';
import { UnitCombobox } from '../units/unit-combobox';
import { callApi } from '@/lib/api/client';
import type { VillageRow } from './types';

/** Tombol + modal tambah/ubah desa. Batas wilayah diatur lewat impor GeoJSON. */
export function VillageFormButton({ village }: { village?: VillageRow }) {
  const router = useRouter();
  const empty = { kodeWilayah: '', nama: '', kecamatan: '', kabupaten: '', provinsi: '', polsekId: '' };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!village;

  function show() {
    setV(village ? { kodeWilayah: village.kodeWilayah, nama: village.nama, kecamatan: village.kecamatan, kabupaten: village.kabupaten, provinsi: village.provinsi, polsekId: village.polsekId ?? '' } : empty);
    setError('');
    setOpen(true);
  }
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !/^\d{2}(\.\d{2}){2}\.\d{4}$/.test(v.kodeWilayah)) return setError('Kode wilayah harus format 32.01.01.2001 (Kemendagri).');
    if ([v.nama, v.kecamatan, v.kabupaten, v.provinsi].some((x) => x.trim().length < 2)) return setError('Nama, kecamatan, kabupaten, dan provinsi wajib diisi.');
    setBusy(true);
    setError('');
    try {
      const { kodeWilayah, ...rest } = v;
      if (isEdit) await callApi(`/admin/villages/${village!.id}`, { method: 'PATCH', body: rest });
      else await callApi('/admin/villages', { method: 'POST', body: { kodeWilayah, ...rest } });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={show} className="relative z-10">Ubah</Button>
      ) : (
        <Button icon={<Plus size={18} />} onClick={show}>Tambah desa</Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!busy}
        title={isEdit ? `Ubah ${village!.nama}` : 'Tambah desa / kelurahan'}
        description={isEdit ? undefined : 'Batas wilayah dapat diunggah kemudian lewat Impor GeoJSON.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
            <Button type="submit" form="village-form" loading={busy} loadingText="Menyimpan…">Simpan</Button>
          </>
        }
      >
        <FormGrid id="village-form" onSubmit={submit} className="px-6 py-5">
          <Field label="Kode wilayah" required hint={isEdit ? 'Tidak dapat diubah' : 'Kode Kemendagri, mis. 32.01.01.2001'}>
            {(id) => <Input id={id} className="font-mono" value={v.kodeWilayah} disabled={isEdit} onChange={set('kodeWilayah')} placeholder="32.01.01.2001" />}
          </Field>
          <Field label="Nama desa / kelurahan" required>{(id) => <Input id={id} value={v.nama} onChange={set('nama')} autoFocus={!isEdit} />}</Field>
          <Field label="Kecamatan" required>{(id) => <Input id={id} value={v.kecamatan} onChange={set('kecamatan')} />}</Field>
          <Field label="Kabupaten / kota" required>{(id) => <Input id={id} value={v.kabupaten} onChange={set('kabupaten')} />}</Field>
          <Field label="Provinsi" required>{(id) => <Input id={id} value={v.provinsi} onChange={set('provinsi')} />}</Field>
          <Field label="Polsek" required hint="Polsek yang membawahi desa ini">
            {(id) => (
              <UnitCombobox id={id} value={v.polsekId} levels={['POLSEK']} placeholder="Cari Polsek…" onChange={(polsekId) => setV((p) => ({ ...p, polsekId }))} />
            )}
          </Field>
          <div className="sm:col-span-2"><ErrorText>{error}</ErrorText></div>
        </FormGrid>
      </Modal>
    </>
  );
}
