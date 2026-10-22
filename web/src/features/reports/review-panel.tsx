'use client';

import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ConfirmDialog, ErrorText, Field, Modal, ModalBody, Textarea, type ButtonVariant } from '@/components/ui';
import { callApi } from '@/lib/api/client';

type NoteDecision = 'NEEDS_REVISION' | 'REJECTED';

const NOTE_COPY: Record<NoteDecision, { title: string; description: string; label: string; variant: ButtonVariant; placeholder: string }> = {
  NEEDS_REVISION: {
    title: 'Minta revisi laporan',
    description: 'Laporan dikembalikan ke Bhabin untuk diperbaiki lalu dikirim ulang.',
    label: 'Kirim permintaan revisi',
    variant: 'warn',
    placeholder: 'mis. Foto etalase buram, mohon diulang dan lengkapi nama kios.',
  },
  REJECTED: {
    title: 'Tolak laporan',
    description: 'Laporan ditolak secara final dan tidak dihitung dalam rekap.',
    label: 'Tolak laporan',
    variant: 'danger',
    placeholder: 'mis. Laporan duplikat dengan nomor …',
  },
};

/** Tombol keputusan verifikator. `inline` untuk deretan tombol di kepala halaman. */
export function ReviewPanel({ reportId, nomor, inline }: { reportId: string; nomor: string; inline?: boolean }) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [noteFor, setNoteFor] = useState<NoteDecision | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const transition = (to: string, n?: string) =>
    callApi(`/reports/${reportId}/transition`, { method: 'POST', body: { to, ...(n && { note: n }) } });

  function openNote(d: NoteDecision) {
    setNote('');
    setError('');
    setNoteFor(d);
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteFor) return;
    if (note.trim().length < 5) return setError('Tuliskan catatan yang jelas (minimal 5 karakter).');
    setBusy(true);
    setError('');
    try {
      await transition(noteFor, note.trim());
      setNoteFor(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const copy = noteFor ? NOTE_COPY[noteFor] : null;

  return (
    <div className={inline ? 'flex flex-wrap items-center gap-2' : 'flex flex-col gap-2 p-5'}>
      {inline ? (
        <>
          <Button variant="outline-danger" icon={<XCircle size={16} />} onClick={() => openNote('REJECTED')}>Tolak</Button>
          <Button variant="outline-warn" icon={<RotateCcw size={16} />} onClick={() => openNote('NEEDS_REVISION')}>Minta revisi</Button>
          <Button size="lg" icon={<CheckCircle2 size={18} />} onClick={() => setApproveOpen(true)}>Setujui</Button>
        </>
      ) : (
        <>
          <Button size="lg" icon={<CheckCircle2 size={18} />} onClick={() => setApproveOpen(true)}>Setujui</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline-warn" icon={<RotateCcw size={16} />} onClick={() => openNote('NEEDS_REVISION')}>Minta revisi</Button>
            <Button variant="outline-danger" icon={<XCircle size={16} />} onClick={() => openNote('REJECTED')}>Tolak</Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        tone="primary"
        title="Setujui laporan?"
        message={<>Laporan <strong className="font-mono">{nomor}</strong> akan ditandai <strong>Disetujui</strong> dan masuk rekap pimpinan.</>}
        confirmLabel="Setujui"
        onConfirm={async () => {
          await transition('APPROVED');
          setApproveOpen(false);
          router.refresh();
        }}
      />

      <Modal
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        dismissible={!busy}
        title={copy?.title ?? ''}
        description={copy?.description}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoteFor(null)} disabled={busy}>Batal</Button>
            <Button type="submit" form="review-note-form" variant={copy?.variant} loading={busy} loadingText="Menyimpan…">{copy?.label}</Button>
          </>
        }
      >
        <form id="review-note-form" onSubmit={submitNote}>
          <ModalBody>
            <Field label="Catatan untuk Bhabin" required hint={<span className="flex justify-between"><span>Terlihat oleh Bhabin dan tercatat di riwayat.</span><span className="tabular-nums">{note.length}/1000</span></span>}>
              {(id) => <Textarea id={id} rows={5} maxLength={1000} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy?.placeholder} />}
            </Field>
            <ErrorText>{error}</ErrorText>
          </ModalBody>
        </form>
      </Modal>
    </div>
  );
}
