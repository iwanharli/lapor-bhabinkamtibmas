'use client';

import { MapPin, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, ErrorText, Field, Input, Modal, ModalBody, Select } from '@/components/ui';
import { callApi } from '@/lib/api/client';

interface SavedPoint { kecamatan: string | null }

/** "-6.2, 106.8" (mis. salinan Google Maps) → angka; kosong bila formatnya salah. */
function parsePoint(text: string) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

const POINT_HINT = 'Format: lintang, bujur — mis. -6.23477, 106.80428 (bisa disalin dari Google Maps).';

/** Ubah atau isi koordinat kantor Polsek. */
export function PolsekCoordinateButton({ polsek }: { polsek: { id: string; nama: string; lat: number | null; lng: number | null } }) {
  const router = useRouter();
  const has = polsek.lat != null && polsek.lng != null;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedPoint | null>(null);
  const point = parsePoint(text);

  function show() {
    setText(has ? `${polsek.lat}, ${polsek.lng}` : '');
    setError('');
    setSaved(null);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      setSaved(await callApi<SavedPoint>(`/admin/villages/polsek/${polsek.id}/koordinat`, { method: 'PUT', body: point! }));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" icon={<MapPin size={14} />} onClick={show}>{has ? 'Ubah koordinat' : 'Isi koordinat'}</Button>
      <Modal open={open} onClose={() => setOpen(false)} dismissible={!busy} title={`Koordinat ${polsek.nama}`} description="Titik kantor Polsek."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Tutup</Button><Button onClick={save} disabled={!point} loading={busy} loadingText="Menyimpan…">Simpan</Button></>}>
        <ModalBody>
          <Field label="Koordinat" required hint={POINT_HINT}>
            {(id) => <Input id={id} value={text} onChange={(e) => { setText(e.target.value); setSaved(null); }} placeholder="-6.23477, 106.80428" />}
          </Field>
          {saved && <Alert tone={saved.kecamatan ? 'success' : 'warn'}>{saved.kecamatan ? `Tersimpan. Titik berada di Kecamatan ${saved.kecamatan}.` : 'Tersimpan, tetapi titik tidak berada di kecamatan dalam cakupan Polres ini, jadi wilayahnya tidak berubah.'}</Alert>}
          <ErrorText>{error}</ErrorText>
        </ModalBody>
      </Modal>
    </>
  );
}

interface Satuan { id: string; name: string }

function useSatuan(parent: string | null) {
  const [rows, setRows] = useState<Satuan[]>([]);
  useEffect(() => {
    let live = true;
    setRows([]);
    if (parent === null) return;
    callApi<Satuan[]>(`/admin/villages/polri-units${parent ? `?parent=${parent}` : ''}`).then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [parent]);
  return rows;
}

/** Tambah Polsek baru: masuk ke struktur unit sekaligus data satuan nasional. */
export function AddPolsekButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [polda, setPolda] = useState('');
  const [polres, setPolres] = useState('');
  const [nama, setNama] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const poldas = useSatuan(open ? '' : null);
  const polreses = useSatuan(polda || null);
  const point = parsePoint(text);
  const valid = !!polres && nama.trim().length >= 3 && (!text.trim() || !!point);

  function show() {
    setPolda('');
    setPolres('');
    setNama('');
    setText('');
    setError('');
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await callApi('/admin/villages/polsek', { method: 'POST', body: { polresId: polres, nama: nama.trim(), ...(point ?? {}) } });
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
      <Button icon={<Plus size={16} />} onClick={show}>Tambah Polsek</Button>
      <Modal open={open} onClose={() => setOpen(false)} dismissible={!busy} title="Tambah Polsek" description="Polsek baru langsung muncul di halaman Unit."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Batal</Button><Button onClick={save} disabled={!valid} loading={busy} loadingText="Menyimpan…">Simpan</Button></>}>
        <ModalBody>
          <Field label="Polda" required>
            {(id) => <Select id={id} value={polda} onChange={(e) => { setPolda(e.target.value); setPolres(''); }}><option value="">— Pilih —</option>{poldas.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>}
          </Field>
          <Field label="Polres" required>
            {(id) => <Select id={id} value={polres} disabled={!polda} onChange={(e) => setPolres(e.target.value)}><option value="">— Pilih —</option>{polreses.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>}
          </Field>
          <Field label="Nama Polsek" required>
            {(id) => <Input id={id} value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Polsek Contoh" />}
          </Field>
          <Field label="Koordinat" hint={`Opsional. ${POINT_HINT}`}>
            {(id) => <Input id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="-6.23477, 106.80428" />}
          </Field>
          <ErrorText>{error}</ErrorText>
        </ModalBody>
      </Modal>
    </>
  );
}
