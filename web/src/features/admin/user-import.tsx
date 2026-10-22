'use client';

import { CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Alert, Badge, Button, buttonClass, Card, cn, ErrorText, Table, Td, Th, THead, Tr } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { csvToObjects, downloadCsv } from '@/lib/csv';
import { ROLE_LABEL } from '@/lib/format';

const COLUMNS = ['nrp', 'nama', 'pangkat', 'jabatan', 'peran', 'kode_unit', 'no_hp', 'desa'];

interface PreviewRow {
  row: number;
  nrp: string;
  nama: string;
  role?: string;
  unit?: string;
  villages: string[];
  errors: string[];
}
interface Preview {
  valid: boolean;
  total: number;
  errorCount: number;
  rows: PreviewRow[];
}
interface Created {
  created: number;
  users: { nrp: string; nama: string; temporaryPassword: string }[];
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold', done ? 'bg-success text-white' : 'bg-primary-soft text-primary')}>
        {done ? <CheckCircle2 size={16} /> : n}
      </span>
      <div className="min-w-0 flex-1 pb-2">
        <p className="mb-2 font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** Impor pengguna massal dari CSV: templat → unggah → pratinjau & validasi server → simpan → unduh sandi sementara. */
export function UserImport({ unitExample, villageExample }: { unitExample: string; villageExample: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null);
  const [error, setError] = useState('');

  function template() {
    downloadCsv('templat_impor_pengguna.csv', COLUMNS, [
      ['90001234', 'Andi Pratama', 'Bripda', 'Bhabinkamtibmas Desa Sukamaju', 'Bhabinkamtibmas', unitExample, '081200000000', villageExample],
      ['90005678', 'Siti Rahma', 'Aipda', 'Kanit Binmas', 'Verifikator', unitExample, '', ''],
    ]);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError('');
    setPreview(null);
    setCreated(null);
    setFileName(f.name);
    const objs = csvToObjects(await f.text());
    const missing = ['nrp', 'nama', 'peran', 'kode_unit'].filter((c) => !(objs[0] && c in objs[0]));
    if (!objs.length) return setError('File kosong atau tidak terbaca sebagai CSV.');
    if (missing.length) return setError(`Kolom wajib tidak ditemukan: ${missing.join(', ')}. Gunakan templat.`);
    const clean = objs.map((o) => Object.fromEntries(COLUMNS.map((c) => [c, o[c] ?? ''])));
    setRows(clean);
    await runPreview(clean);
  }

  async function runPreview(data = rows) {
    setBusy('preview');
    setError('');
    try {
      setPreview(await callApi<Preview>('/admin/users/import', { method: 'POST', body: { dryRun: true, rows: data } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy('save');
    setError('');
    try {
      setCreated(await callApi<Created>('/admin/users/import', { method: 'POST', body: { rows } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setRows([]);
    setPreview(null);
    setCreated(null);
    setFileName('');
    setError('');
    if (input.current) input.current.value = '';
  }

  if (created) {
    return (
      <Card>
        <div className="space-y-4 p-6">
          <Alert tone="success" title={`${created.created} pengguna berhasil diimpor`}>
            Unduh daftar sandi sementara sekarang — sandi <strong>tidak dapat dilihat lagi</strong> setelah halaman ini ditutup. Setiap pengguna wajib mengganti sandi saat login pertama.
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Download size={16} />} onClick={() => downloadCsv('sandi_sementara_pengguna.csv', ['NRP', 'Nama', 'Sandi sementara'], created.users.map((u) => [u.nrp, u.nama, u.temporaryPassword]))}>
              Unduh daftar sandi sementara
            </Button>
            <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={reset}>Impor file lain</Button>
            <Link href="/admin/pengguna" className={buttonClass({ variant: 'ghost' })}>Ke daftar pengguna</Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-5 p-6">
          <Step n={1} title="Unduh templat & isi data" done={!!fileName}>
            <p className="mb-3 text-sm text-muted">
              Kolom wajib: <code>nrp</code>, <code>nama</code>, <code>peran</code>, <code>kode_unit</code>. Kolom <code>desa</code> berisi kode wilayah desa binaan (khusus Bhabin), pisahkan dengan <code>|</code>.
              Peran: Bhabinkamtibmas, Verifikator, Pimpinan, Admin Unit, Auditor. Maksimal 1.000 baris.
            </p>
            <Button variant="secondary" icon={<FileSpreadsheet size={16} />} onClick={template}>Unduh templat CSV</Button>
          </Step>
          <Step n={2} title="Pilih file CSV" done={!!preview}>
            <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFile(e.dataTransfer.files?.[0]);
              }}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-6 py-8 text-sm text-muted transition hover:border-primary hover:bg-primary-soft/40"
            >
              <Upload size={24} className="text-primary" />
              {fileName ? <span><strong className="text-ink">{fileName}</strong> · {rows.length} baris · klik untuk ganti</span> : <span>Klik atau seret file CSV ke sini</span>}
            </button>
          </Step>
          <Step n={3} title="Periksa hasil validasi lalu simpan">
            {busy === 'preview' && <p className="text-sm text-muted">Memvalidasi…</p>}
            {preview && (
              <div className="flex flex-wrap items-center gap-3">
                {preview.valid ? (
                  <Badge tone="success">Semua {preview.total} baris valid</Badge>
                ) : (
                  <Badge tone="danger">{preview.errorCount} dari {preview.total} baris perlu diperbaiki</Badge>
                )}
                <Button onClick={save} disabled={!preview.valid} loading={busy === 'save'} loadingText="Menyimpan…">Simpan {preview.total} pengguna</Button>
                <Button variant="ghost" onClick={() => runPreview()} disabled={busy !== null}>Validasi ulang</Button>
              </div>
            )}
            {!preview && !busy && <p className="text-sm text-muted">Hasil validasi muncul setelah file dipilih.</p>}
          </Step>
          <ErrorText>{error}</ErrorText>
        </div>
      </Card>

      {preview && (
        <Card title="Pratinjau" subtitle={preview.valid ? 'Tidak ada yang disimpan sebelum Anda menekan Simpan' : 'Perbaiki baris bertanda merah di file, lalu pilih file lagi'}>
          <Table minWidth={860}>
            <THead>
              <Th className="pl-5">Baris</Th>
              <Th>NRP</Th>
              <Th>Nama</Th>
              <Th>Peran</Th>
              <Th>Unit</Th>
              <Th>Desa binaan</Th>
              <Th className="pr-5">Status</Th>
            </THead>
            <tbody>
              {preview.rows.map((r) => (
                <Tr key={r.row} className={r.errors.length ? 'bg-danger-soft/40' : undefined}>
                  <Td className="pl-5 text-muted" numeric>{r.row + 1}</Td>
                  <Td className="font-mono">{r.nrp || '—'}</Td>
                  <Td>{r.nama || '—'}</Td>
                  <Td>{r.role ? ROLE_LABEL[r.role] ?? r.role : '—'}</Td>
                  <Td>{r.unit ?? '—'}</Td>
                  <Td className="text-muted">{r.villages.join(', ') || '—'}</Td>
                  <Td className="pr-5">
                    {r.errors.length ? (
                      <span className="flex items-start gap-1.5 text-sm text-danger"><XCircle size={15} className="mt-0.5 shrink-0" />{r.errors.join('; ')}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-success"><CheckCircle2 size={15} /> Siap</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
