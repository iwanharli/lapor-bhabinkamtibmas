'use client';

import { Eye, Lock } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Alert, Button, ErrorText, Field, Input, Modal, ModalBody } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import type { RevealField } from './revealable';

/** Tampilkan field sensitif laporan setelah pengguna menuliskan alasan (tercatat di audit log). */
export function SensitiveReveal({ reportId, fields }: { reportId: string; fields: RevealField[] }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function reveal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setValues(await callApi<Record<string, unknown>>(`/reports/${reportId}/reveal-sensitive`, { method: 'POST', body: { reason } }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-violet-600/25 transition hover:brightness-110 active:scale-[0.98]">
        <Eye size={15} /> Tampilkan data sensitif
      </button>
      <Modal open={open} onClose={() => { setOpen(false); setValues(null); setReason(''); }} size="sm" title="Data sensitif" description="Akses dicatat di audit log beserta alasannya.">
        {values ? (
          <ModalBody>
            <dl className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <dt className="text-xs uppercase tracking-wide text-muted">{f.label}</dt>
                  <dd className="font-mono text-lg">
                    {Array.isArray(values[f.key]) ? (
                      <ol className="mt-1 space-y-2 font-sans text-sm">
                        {(values[f.key] as Record<string, unknown>[]).map((row, i) => {
                          const entries = (f.subs ?? []).filter((s) => row?.[s.key] != null && row[s.key] !== '');
                          return (
                            <li key={i} className="rounded-lg bg-bg px-3 py-2">
                              <p className="font-semibold">{f.rows?.[i] ?? `#${i + 1}`}</p>
                              {entries.length ? (
                                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                                  {entries.map((s) => (
                                    <Fragment key={s.key}>
                                      <dt className="text-xs text-muted">{s.label}</dt>
                                      <dd className={s.key === 'nik' ? 'font-mono' : ''}>{String(row[s.key])}</dd>
                                    </Fragment>
                                  ))}
                                </dl>
                              ) : <p className="text-xs text-muted">Tidak ada data sensitif.</p>}
                            </li>
                          );
                        })}
                      </ol>
                    ) : String(values[f.key] ?? '—')}
                  </dd>
                </div>
              ))}
            </dl>
            <Alert tone="warn">Jangan menyalin atau menyebarkan data ini di luar keperluan tugas.</Alert>
          </ModalBody>
        ) : (
          <form onSubmit={reveal}>
            <ModalBody>
              <p className="flex items-center gap-2 text-sm text-muted"><Lock size={15} /> {fields.map((f) => f.label).join(', ')}</p>
              <Field label="Alasan membuka" required>
                {(id) => <Input id={id} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. Verifikasi identitas kepala keluarga" maxLength={300} />}
              </Field>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" className="w-full" loading={busy} disabled={reason.trim().length < 5}>Tampilkan</Button>
            </ModalBody>
          </form>
        )}
      </Modal>
    </>
  );
}
