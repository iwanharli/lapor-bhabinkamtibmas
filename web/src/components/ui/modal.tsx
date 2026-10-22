'use client';

import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ErrorText } from './alert';
import { Button } from './button';
import { cn } from './cn';

type Size = 'sm' | 'md' | 'lg';
const WIDTH: Record<Size, string> = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

/**
 * Modal berbasis <dialog> bawaan browser: fokus terkunci di dalam, Esc menutup,
 * dan konten di belakangnya tidak bisa diklik.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  size?: Size;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** false saat sedang menyimpan, agar modal tidak tertutup di tengah proses. */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn('modal m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl', WIDTH[size])}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        // Klik di backdrop (di luar kotak) menutup modal.
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={!dismissible} aria-label="Tutup" className="-mr-2 p-2">
              <X size={20} />
            </Button>
          </header>
          <div className="overflow-y-auto">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-bg/60 px-6 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Isi modal dengan padding standar. */
export function ModalBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('space-y-4 px-6 py-5', className)}>{children}</div>;
}

const CONFIRM_TONE = {
  primary: { icon: CheckCircle2, ring: 'bg-primary-soft text-primary', variant: 'primary' },
  warn: { icon: AlertTriangle, ring: 'bg-warn/10 text-warn', variant: 'warn' },
  danger: { icon: AlertTriangle, ring: 'bg-danger/10 text-danger', variant: 'danger' },
} as const;

/** Dialog konfirmasi pengganti window.confirm(). onConfirm boleh async; galat ditampilkan di dalam dialog. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Ya, lanjutkan',
  tone = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: keyof typeof CONFIRM_TONE;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = CONFIRM_TONE[tone];

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Batal</Button>
          <Button variant={t.variant} onClick={confirm} loading={busy} autoFocus>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex gap-4 px-6 py-5">
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', t.ring)}>
          <t.icon size={20} />
        </div>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>{message}</div>
          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    </Modal>
  );
}
