'use client';

import { MapPinPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, ErrorText, Field, Modal, ModalBody, Select } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import type { PolsekWithoutRegion } from './types';

type PolsekRef = Pick<PolsekWithoutRegion, 'id' | 'nama' | 'polres' | 'polda'> & { kawasan?: boolean };

interface Region { kode: string; nama: string }

/** Pilihan wilayah satu tingkat; dimuat ulang saat induk berubah. */
function useRegions(parent: string | null) {
  const [rows, setRows] = useState<Region[]>([]);
  useEffect(() => {
    let live = true;
    setRows([]);
    if (parent === null) return;
    callApi<Region[]>(parent ? `/regions?parent=${parent}` : '/regions').then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [parent]);
  return rows;
}

/** Tetapkan satu atau beberapa kecamatan Polsek secara manual; setelah itu Polsek keluar dari daftar dan muncul di pohon wilayah. */
export function AssignPolsekRegionButton({ polsek, existing = [], label = 'Tetapkan wilayah' }: { polsek: PolsekRef; existing?: string[]; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prov, setProv] = useState('');
  const [kab, setKab] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const provinces = useRegions(open ? '' : null);
  const kabs = useRegions(prov || null);
  const kecs = useRegions(kab || null);

  function show() {
    setProv('');
    setKab('');
    setPicked(new Set());
    setError('');
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await callApi(`/admin/villages/polsek-tanpa-wilayah/${polsek.id}/wilayah`, { method: 'POST', body: { kecamatanKodes: [...picked] } });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" icon={<MapPinPlus size={14} />} onClick={show}>{label}</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!busy}
        title={`Tetapkan wilayah ${polsek.nama}`}
        description={`${polsek.polres} · ${polsek.polda}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
            <Button onClick={save} disabled={!picked.size} loading={busy} loadingText="Menyimpan…">Simpan{picked.size ? ` ${picked.size} kecamatan` : ''}</Button>
          </>
        }
      >
        <ModalBody>
          {polsek.kawasan && <Alert tone="warn">Ini satuan kawasan. Pilih kecamatan tempat kawasannya berada, bila memang perlu.</Alert>}
          <Field label="Provinsi" required>
            {(id) => (
              <Select id={id} value={prov} onChange={(e) => { setProv(e.target.value); setKab(''); setPicked(new Set()); }}>
                <option value="">— Pilih —</option>
                {provinces.map((r) => <option key={r.kode} value={r.kode}>{r.nama}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Kabupaten/kota" required>
            {(id) => (
              <Select id={id} value={kab} disabled={!prov} onChange={(e) => { setKab(e.target.value); setPicked(new Set()); }}>
                <option value="">— Pilih —</option>
                {kabs.map((r) => <option key={r.kode} value={r.kode}>{r.nama}</option>)}
              </Select>
            )}
          </Field>
          {kab && (
            <div className="rounded-xl border border-line">
              <p className="border-b border-line bg-bg/60 px-4 py-2.5 text-sm font-medium">Kecamatan (boleh lebih dari satu)</p>
              <ul className="max-h-64 divide-y divide-line overflow-auto">
                {kecs.map((r) => {
                  const has = existing.includes(r.kode);
                  return (
                    <li key={r.kode}>
                      <label className={`flex items-center gap-3 px-4 py-2 text-sm ${has ? 'opacity-60' : 'cursor-pointer hover:bg-bg'}`}>
                        <input type="checkbox" className="h-4 w-4 accent-primary" disabled={has} checked={has || picked.has(r.kode)} onChange={() => setPicked((s) => {
                          const n = new Set(s);
                          if (n.has(r.kode)) n.delete(r.kode);
                          else n.add(r.kode);
                          return n;
                        })} />
                        <span>{r.nama}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <ErrorText>{error}</ErrorText>
        </ModalBody>
      </Modal>
    </>
  );
}

/** Lepas satu kecamatan dari penetapan manual. */
export function RemovePolsekRegionButton({ polsekId, polsekNama, kode, nama }: { polsekId: string; polsekNama: string; kode: string; nama: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm(`Lepas kecamatan ${nama} dari ${polsekNama}?`)) return;
    setBusy(true);
    try {
      await callApi(`/admin/villages/polsek-tanpa-wilayah/${polsekId}/wilayah/${kode}`, { method: 'DELETE' });
      router.refresh();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" aria-label={`Lepas ${nama}`} disabled={busy} onClick={remove} className="grid h-5 w-5 place-items-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-50">
      <X size={13} />
    </button>
  );
}
