'use client';

import { Eye, Lock } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, ErrorText, Field, Input, Modal, ModalBody } from '@/components/ui';
import { callApi } from '@/lib/api/client';

/** Tampilkan field sensitif laporan setelah pengguna menuliskan alasan (tercatat di audit log). */
export function SensitiveReveal({ reportId, fields }: { reportId: string; fields: { key: string; label: string }[] }) {
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
      <Button variant="secondary" size="sm" icon={<Eye size={14} />} onClick={() => setOpen(true)}>Tampilkan data sensitif</Button>
      <Modal open={open} onClose={() => { setOpen(false); setValues(null); setReason(''); }} size="sm" title="Data sensitif" description="Akses dicatat di audit log beserta alasannya.">
        {values ? (
          <ModalBody>
            <dl className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <dt className="text-xs uppercase tracking-wide text-muted">{f.label}</dt>
                  <dd className="font-mono text-lg">
                    {Array.isArray(values[f.key]) ? (
                      <ol className="space-y-1 text-base">
                        {(values[f.key] as Record<string, unknown>[]).map((row, i) => (
                          <li key={i}><span className="mr-2 text-xs text-muted">#{i + 1}</span>{Object.values(row ?? {}).map(String).join(' · ') || '—'}</li>
                        ))}
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
