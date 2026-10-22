'use client';

import { Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, ErrorText, Field, Modal, ModalBody, Select } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { TZ_LABEL, tzLabel } from '@/lib/format';

export const TIMEZONE_OPTIONS = Object.entries(TZ_LABEL).map(([value, label]) => ({
  value,
  label: `${label} (${value === 'Asia/Jakarta' ? 'UTC+7' : value === 'Asia/Makassar' ? 'UTC+8' : 'UTC+9'})`,
}));

/** Label zona waktu unit yang bisa diklik untuk mengubahnya (menurun ke unit turunan yang zonanya sama). */
export function TimezoneButton({ unitId, unitName, timezone, editable }: { unitId: string; unitName: string; timezone?: string; editable: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tz, setTz] = useState(timezone ?? 'Asia/Jakarta');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const label = <span className="inline-flex items-center gap-1 rounded bg-bg px-1.5 py-0.5 text-[11px] font-semibold text-muted"><Clock size={11} />{tzLabel(timezone)}</span>;
  if (!editable) return label;

  async function save() {
    setBusy(true);
    setError('');
    try {
      await callApi(`/units/${unitId}/timezone`, { method: 'PATCH', body: { timezone: tz } });
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
      <button type="button" onClick={() => { setTz(timezone ?? 'Asia/Jakarta'); setError(''); setOpen(true); }} title="Ubah zona waktu" className="relative z-10 hover:opacity-80">
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} dismissible={!busy} size="sm" title={`Zona waktu ${unitName}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Batal</Button><Button onClick={save} loading={busy} loadingText="Menyimpan…">Simpan</Button></>}>
        <ModalBody>
          <Field label="Zona waktu">
            {(id) => (
              <Select id={id} value={tz} onChange={(e) => setTz(e.target.value)}>
                {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            )}
          </Field>
          <Alert>Unit di bawahnya yang memakai zona yang sama ikut diubah. Dipakai untuk tanggal laporan, nomor laporan, dan rekap harian.</Alert>
          <ErrorText>{error}</ErrorText>
        </ModalBody>
      </Modal>
    </>
  );
}
