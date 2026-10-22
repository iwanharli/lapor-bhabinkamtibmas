'use client';

import { MapPinPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, ErrorText, Field, Modal, ModalBody, Select } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { UnitCombobox } from '../units/unit-combobox';

interface Region { kode: string; nama: string; level: number; desa: number }
interface KemendagriVillage { id: string; kodeWilayah: string; nama: string; polsekId: string | null; polsek: string | null; bhabin: number; batas: boolean; assignable: boolean }

/** Pilihan wilayah satu tingkat; dimuat ulang saat induk berubah. */
function useRegions(parent: string | null) {
  const [rows, setRows] = useState<Region[]>([]);
  useEffect(() => {
    setRows([]);
    if (parent === null) return;
    callApi<Region[]>(parent ? `/regions?parent=${parent}` : '/regions').then(setRows).catch(() => setRows([]));
  }, [parent]);
  return rows;
}

/**
 * Tetapkan desa dari data Kemendagri (seed:wilayah) ke satu Polsek:
 * pilih Provinsi › Kabupaten/Kota › Kecamatan, centang desa, simpan.
 */
export function AssignVillagesButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [polsekId, setPolsekId] = useState('');
  const [prov, setProv] = useState('');
  const [kab, setKab] = useState('');
  const [kec, setKec] = useState('');
  const [villages, setVillages] = useState<KemendagriVillage[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<number | null>(null);

  const provinces = useRegions(open ? '' : null);
  const kabs = useRegions(prov || null);
  const kecs = useRegions(kab || null);

  useEffect(() => {
    setVillages([]);
    setPicked(new Set());
    if (!kec) return;
    callApi<KemendagriVillage[]>(`/admin/villages/by-kecamatan/${kec}`).then(setVillages).catch((e) => setError((e as Error).message));
  }, [kec]);

  const selectable = villages.filter((v) => v.assignable && v.polsekId !== polsekId);
  const allPicked = selectable.length > 0 && selectable.every((v) => picked.has(v.id));
  const toggle = (id: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  function show() {
    setPolsekId('');
    setProv('');
    setKab('');
    setKec('');
    setError('');
    setDone(null);
    setOpen(true);
  }

  async function save() {
    if (!polsekId) return setError('Pilih Polsek pembina.');
    if (!picked.size) return setError('Centang minimal satu desa.');
    setBusy(true);
    setError('');
    try {
      const res = await callApi<{ assigned: number }>('/admin/villages/assign', { method: 'POST', body: { polsekId, villageIds: [...picked] } });
      setDone(res.assigned);
      setPicked(new Set());
      setVillages(await callApi<KemendagriVillage[]>(`/admin/villages/by-kecamatan/${kec}`));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button icon={<MapPinPlus size={16} />} onClick={show}>Tetapkan desa</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!busy}
        size="lg"
        title="Tetapkan desa ke Polsek"
        description="Pilih desa dari data wilayah Kemendagri 2025 lalu tetapkan Polsek pembinanya. Batas wilayah ikut terpasang."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Tutup</Button>
            <Button onClick={save} disabled={!picked.size || !polsekId} loading={busy} loadingText="Menyimpan…">Tetapkan {picked.size || ''} desa</Button>
          </>
        }
      >
        <ModalBody>
          <Field label="Polsek pembina" required>
            {(id) => <UnitCombobox id={id} value={polsekId} levels={['POLSEK']} placeholder="Cari Polsek…" onChange={(pid) => setPolsekId(pid)} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Provinsi">
              {(id) => (
                <Select id={id} value={prov} onChange={(e) => { setProv(e.target.value); setKab(''); setKec(''); }}>
                  <option value="">— Pilih —</option>
                  {provinces.map((r) => <option key={r.kode} value={r.kode}>{r.nama}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Kabupaten/kota">
              {(id) => (
                <Select id={id} value={kab} disabled={!prov} onChange={(e) => { setKab(e.target.value); setKec(''); }}>
                  <option value="">— Pilih —</option>
                  {kabs.map((r) => <option key={r.kode} value={r.kode}>{r.nama}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Kecamatan">
              {(id) => (
                <Select id={id} value={kec} disabled={!kab} onChange={(e) => setKec(e.target.value)}>
                  <option value="">— Pilih —</option>
                  {kecs.map((r) => <option key={r.kode} value={r.kode}>{r.nama}{r.desa ? '' : ' (data desa belum diimpor)'}</option>)}
                </Select>
              )}
            </Field>
          </div>

          {kec && (
            villages.length === 0 ? (
              <Alert tone="warn">Data desa kecamatan ini belum diimpor. Jalankan <code>npm run seed:wilayah -- --desa={prov}</code> di server.</Alert>
            ) : (
              <div className="rounded-xl border border-line">
                <label className="flex items-center gap-3 border-b border-line bg-bg/60 px-4 py-2.5 text-sm font-medium">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={allPicked} disabled={!selectable.length}
                    onChange={() => setPicked(allPicked ? new Set() : new Set(selectable.map((v) => v.id)))} />
                  Pilih semua yang tersedia ({selectable.length} dari {villages.length} desa)
                </label>
                <ul className="max-h-72 divide-y divide-line overflow-auto">
                  {villages.map((v) => {
                    const here = !!polsekId && v.polsekId === polsekId;
                    const disabled = !v.assignable || here;
                    return (
                      <li key={v.id}>
                        <label className={`flex items-center gap-3 px-4 py-2 text-sm ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-bg'}`}>
                          <input type="checkbox" className="h-4 w-4 accent-primary" disabled={disabled} checked={here || picked.has(v.id)} onChange={() => toggle(v.id)} />
                          <span className="flex-1">
                            {v.nama} <span className="font-mono text-xs text-muted">{v.kodeWilayah}</span>
                          </span>
                          {here ? <Badge tone="success">sudah di Polsek ini</Badge>
                            : v.polsek ? <Badge tone={v.assignable ? 'warn' : 'neutral'}>{v.polsek}{v.bhabin ? ` · ${v.bhabin} Bhabin` : ''}</Badge>
                            : <Badge>belum ada Polsek</Badge>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )
          )}
          {done !== null && <Alert tone="success">{done} desa ditetapkan ke Polsek.</Alert>}
          <ErrorText>{error}</ErrorText>
        </ModalBody>
      </Modal>
    </>
  );
}
