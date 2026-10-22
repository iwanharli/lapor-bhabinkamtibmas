'use client';

import { CheckCircle2, FileUp, Upload, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Alert, Badge, Button, ErrorText, Field, Modal, ModalBody, Table, Td, Th, THead, Tr } from '@/components/ui';
import { UnitCombobox } from '../units/unit-combobox';
import { callApi } from '@/lib/api/client';

interface PreviewRow {
  row: number;
  kode: string;
  nama: string;
  kecamatan: string;
  action: 'baru' | 'perbarui';
  errors: string[];
}

/** Impor desa + batas wilayah dari GeoJSON (mis. ekspor BIG/BPS/Kemendagri) ke satu Polsek. */
export function GeojsonImportButton() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [polsekId, setPolsekId] = useState('');
  const [file, setFile] = useState('');
  const [features, setFeatures] = useState<unknown[]>([]);
  const [preview, setPreview] = useState<{ valid: boolean; total: number; errorCount: number; rows: PreviewRow[] } | null>(null);
  const [done, setDone] = useState<{ imported: number; created: number; updated: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setFile('');
    setFeatures([]);
    setPreview(null);
    setDone(null);
    setError('');
    if (input.current) input.current.value = '';
  }

  async function check(f: unknown[], pid = polsekId) {
    setBusy(true);
    setError('');
    try {
      setPreview(await callApi('/admin/villages/import', { method: 'POST', body: { polsekId: pid, dryRun: true, features: f } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(f?: File) {
    if (!f) return;
    reset();
    setFile(f.name);
    try {
      const json = JSON.parse(await f.text());
      const list = json.type === 'FeatureCollection' ? json.features : json.type === 'Feature' ? [json] : null;
      if (!Array.isArray(list)) return setError('File harus GeoJSON FeatureCollection.');
      setFeatures(list);
      if (polsekId) await check(list);
      else setError('Pilih Polsek terlebih dahulu; berkas akan diperiksa setelah Polsek dipilih.');
    } catch {
      setError('File tidak terbaca sebagai JSON/GeoJSON.');
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      setDone(await callApi('/admin/villages/import', { method: 'POST', body: { polsekId, features } }));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" icon={<FileUp size={16} />} onClick={() => { reset(); setOpen(true); }}>Impor GeoJSON</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!busy}
        size="lg"
        title="Impor desa & batas wilayah"
        description="GeoJSON FeatureCollection berisi poligon desa. Properti: kode_wilayah, nama, kecamatan, kabupaten, provinsi. Desa yang sudah ada (kode sama) diperbarui."
        footer={
          done ? (
            <Button onClick={() => setOpen(false)}>Selesai</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
              <Button onClick={save} disabled={!preview?.valid} loading={busy && !!preview} loadingText="Menyimpan…">Impor {preview?.total ?? ''} desa</Button>
            </>
          )
        }
      >
        <ModalBody>
          {done ? (
            <Alert tone="success" title="Impor selesai">{done.created} desa baru, {done.updated} desa diperbarui beserta batas wilayahnya.</Alert>
          ) : (
            <>
              <Field label="Polsek tujuan" required>
                {(id) => (
                  <UnitCombobox id={id} value={polsekId} levels={['POLSEK']} placeholder="Cari Polsek…"
                    onChange={(pid) => { setPolsekId(pid); setError(''); if (features.length && pid) check(features, pid); }} />
                )}
              </Field>
              <input ref={input} type="file" accept=".geojson,.json,application/geo+json,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <button type="button" onClick={() => input.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-6 py-6 text-sm text-muted hover:border-primary hover:bg-primary-soft/40">
                <Upload size={22} className="text-primary" />
                {file ? <span><strong className="text-ink">{file}</strong> · {features.length} fitur · klik untuk ganti</span> : 'Pilih file .geojson'}
              </button>
              {busy && !preview && <p className="text-sm text-muted">Memvalidasi…</p>}
              {preview && (
                <>
                  {preview.valid ? <Badge tone="success">Semua {preview.total} fitur valid</Badge> : <Badge tone="danger">{preview.errorCount} dari {preview.total} fitur perlu diperbaiki</Badge>}
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
                    <Table>
                      <THead>
                        <Th>#</Th>
                        <Th>Kode</Th>
                        <Th>Desa</Th>
                        <Th>Status</Th>
                      </THead>
                      <tbody>
                        {preview.rows.map((r) => (
                          <Tr key={r.row} className={r.errors.length ? 'bg-danger-soft/40' : undefined}>
                            <Td muted numeric>{r.row}</Td>
                            <Td className="font-mono text-xs">{r.kode || '—'}</Td>
                            <Td>{r.nama || '—'}<span className="block text-xs text-muted">{r.kecamatan}</span></Td>
                            <Td>
                              {r.errors.length ? (
                                <span className="flex items-start gap-1.5 text-xs text-danger"><XCircle size={14} className="mt-0.5 shrink-0" />{r.errors.join('; ')}</span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-success"><CheckCircle2 size={14} />{r.action === 'baru' ? 'Desa baru' : 'Perbarui'}</span>
                              )}
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </>
              )}
              <ErrorText>{error}</ErrorText>
            </>
          )}
        </ModalBody>
      </Modal>
    </>
  );
}
