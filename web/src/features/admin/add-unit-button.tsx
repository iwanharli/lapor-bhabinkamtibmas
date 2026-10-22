'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, ErrorText, Field, Input, Modal, ModalBody, Select } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import type { UnitOption } from '@/lib/types';
import { CHILD_LEVEL_LABEL, unitOptions } from '@/lib/units';

/** Tombol + modal tambah unit. `parentId` mengunci unit induk (dipakai di baris pohon unit). */
export function AddUnitButton({ units, parentId: fixedParent, compact }: { units: UnitOption[]; parentId?: string; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState('');
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Polsek tidak bisa punya turunan, jadi tidak ditawarkan sebagai induk.
  const parents = useMemo(() => unitOptions(units).filter((o) => o.level !== 'POLSEK'), [units]);
  const parentLevel = units.find((u) => u.id === parentId)?.level;

  function show() {
    setParentId(fixedParent ?? parents[0]?.id ?? '');
    setKode('');
    setNama('');
    setError('');
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parentId) return setError('Pilih unit induk.');
    if (nama.trim().length < 2) return setError('Nama unit wajib diisi.');
    if (!/^[A-Z0-9-]{2,32}$/.test(kode)) return setError('Kode 2–32 karakter: huruf besar, angka, atau tanda hubung.');
    setBusy(true);
    setError('');
    try {
      await callApi('/units', { method: 'POST', body: { parentId, kode, nama: nama.trim() } });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (parents.length === 0) return null;

  return (
    <>
      {compact ? (
        <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={show} className="relative z-10">
          Tambah {CHILD_LEVEL_LABEL[units.find((u) => u.id === fixedParent)?.level ?? ''] ?? 'turunan'}
        </Button>
      ) : (
        <Button icon={<Plus size={18} />} onClick={show}>Tambah unit</Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!busy}
        size="sm"
        title="Tambah unit"
        description={parentLevel ? `Unit baru akan berupa ${CHILD_LEVEL_LABEL[parentLevel]}.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
            <Button type="submit" form="add-unit-form" loading={busy} loadingText="Menyimpan…">Simpan</Button>
          </>
        }
      >
        <form id="add-unit-form" onSubmit={submit}>
          <ModalBody>
            <Field label="Unit induk" required>
              {(id) => (
                <Select id={id} value={parentId} disabled={!!fixedParent} onChange={(e) => setParentId(e.target.value)}>
                  {parents.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Nama unit" required>
              {(id) => <Input id={id} autoFocus value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Polsek Cibinong" />}
            </Field>
            <Field label="Kode unit" required hint="Dipakai di nomor laporan; tidak dapat diubah setelah dipakai.">
              {(id) => (
                <Input id={id} className="font-mono" value={kode} placeholder="mis. POLSEK-CIBINONG"
                  onChange={(e) => setKode(e.target.value.toUpperCase().replace(/\s+/g, '-'))} />
              )}
            </Field>
            <ErrorText>{error}</ErrorText>
          </ModalBody>
        </form>
      </Modal>
    </>
  );
}
