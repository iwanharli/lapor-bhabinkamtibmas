'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ErrorText, Field, Input, Modal, ModalBody, Select } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { CHILD_LEVEL_LABEL } from '@/lib/units';
import { tzLabel } from '@/lib/format';
import { UnitCombobox } from '../units/unit-combobox';
import { TIMEZONE_OPTIONS } from './timezone-button';

type ParentUnit = { id: string; level: string; timezone?: string };

/** Tombol + modal tambah unit. `parent` mengunci unit induk (dipakai di baris pohon unit); tanpa itu induk dicari. */
export function AddUnitButton({ parent: fixedParent, compact }: { parent?: ParentUnit; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState<ParentUnit | null>(null);
  const parentId = parent?.id ?? '';
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [timezone, setTimezone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const parentLevel = parent?.level;

  function show() {
    setParent(fixedParent ?? null);
    setKode('');
    setNama('');
    setTimezone('');
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
      await callApi('/units', { method: 'POST', body: { parentId, kode, nama: nama.trim(), ...(timezone && { timezone }) } });
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
      {compact ? (
        <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={show} className="relative z-10">
          Tambah {CHILD_LEVEL_LABEL[fixedParent?.level ?? ''] ?? 'turunan'}
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
                // Polsek tidak bisa punya turunan, jadi tidak ditawarkan sebagai induk.
                <UnitCombobox id={id} value={parentId} disabled={!!fixedParent} levels={['MABES', 'POLDA', 'POLRES']} placeholder="Cari Polda/Polres…"
                  onChange={(_, u) => setParent(u ? { id: u.id, level: u.level, timezone: u.timezone } : null)} />
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
            <Field label="Zona waktu" hint="Kosongkan untuk mengikuti unit induk">
              {(id) => (
                <Select id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="">Ikuti induk ({tzLabel(parent?.timezone)})</option>
                  {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              )}
            </Field>
            <ErrorText>{error}</ErrorText>
          </ModalBody>
        </form>
      </Modal>
    </>
  );
}
