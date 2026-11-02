'use client';

import { Check, Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/components/ui';

type Format = 'pdf' | 'xlsx';

const SECTIONS: { key: string; label: string; hint: string; formats: Format[] }[] = [
  { key: 'harian', label: 'Grafik laporan per hari', hint: 'Jumlah laporan tiap tanggal', formats: ['pdf'] },
  { key: 'kategori', label: 'Laporan per kategori', hint: 'Dibanding periode pembanding', formats: ['pdf'] },
  { key: 'keluarga', label: 'Keluarga & stunting', hint: 'Angka gabungan, tanpa data per orang', formats: ['pdf'] },
  { key: 'satuan', label: 'Rekap per satuan', hint: 'Satuan bawahan langsung', formats: ['pdf', 'xlsx'] },
  { key: 'bhabin', label: 'Kinerja Bhabin', hint: 'PDF: hanya yang perlu perhatian. Excel: semua', formats: ['pdf', 'xlsx'] },
  { key: 'prioritas', label: 'Laporan prioritas', hint: 'Deteksi dini urgensi tinggi', formats: ['pdf', 'xlsx'] },
  { key: 'harga', label: 'Harga pangan', hint: 'Rata-rata dan perubahan harga', formats: ['pdf', 'xlsx'] },
];

const FORMATS: { key: Format; label: string; hint: string; icon: typeof FileText; tone: string }[] = [
  { key: 'pdf', label: 'PDF', hint: 'Siap cetak, ada kop & pengesahan', icon: FileText, tone: 'text-red-600' },
  { key: 'xlsx', label: 'Excel', hint: 'Data lengkap untuk diolah', icon: FileSpreadsheet, tone: 'text-emerald-600' },
];

/** Tombol unduh yang membuka panel samping: pilih format & bagian yang ikut diekspor, lalu unduh. */
export function ExportDrawer({ baseHref, summary }: { baseHref: string; summary: { label: string; value: string }[] }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>('pdf');
  const [off, setOff] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const show = (f: Format) => {
    setFormat(f);
    setOpen(true);
  };
  const available = SECTIONS.filter((s) => s.formats.includes(format));
  const chosen = available.filter((s) => !off.has(s.key));
  const toggle = (key: string) => setOff((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  // Excel selalu punya lembar Ringkasan, jadi boleh tanpa bagian tambahan; PDF harus berisi minimal satu bagian.
  const ready = format === 'xlsx' || chosen.length > 0;
  const href = `${baseHref}${baseHref.includes('?') ? '&' : '?'}format=${format}&bagian=${chosen.map((s) => s.key).join(',') || 'ringkasan'}`;

  return (
    <>
      {FORMATS.map((f) => (
        <button key={f.key} type="button" onClick={() => show(f.key)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-3.5 text-sm font-semibold text-[var(--brand-deep)] transition hover:bg-white/90">
          <f.icon size={16} className={f.tone} /> Unduh {f.label}
        </button>
      ))}
      {mounted && createPortal(
        <div className={cn('fixed inset-0 z-[1100]', !open && 'pointer-events-none')} aria-hidden={!open}>
          <div onClick={() => setOpen(false)} className={cn('absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')} />
          <aside role="dialog" aria-modal="true" aria-label="Pengaturan unduhan" inert={!open}
            className={cn('absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface text-ink shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none', open ? 'translate-x-0' : 'translate-x-full')}>
            <header className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
              <div>
                <h2 className="text-lg font-bold">Pengaturan unduhan</h2>
                <p className="mt-0.5 text-sm text-muted">Pilih format dan data yang ikut diekspor.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink"><X size={18} /></button>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Format</p>
                <div role="radiogroup" aria-label="Format" className="grid grid-cols-2 gap-2">
                  {FORMATS.map((f) => (
                    <button key={f.key} type="button" role="radio" aria-checked={format === f.key} onClick={() => setFormat(f.key)}
                      className={cn('rounded-xl border p-3 text-left transition', format === f.key ? 'border-primary bg-primary-soft ring-1 ring-primary' : 'border-line hover:border-primary/40')}>
                      <span className="flex items-center gap-2 font-semibold"><f.icon size={18} className={f.tone} /> {f.label}</span>
                      <span className="mt-1 block text-xs leading-snug text-muted">{f.hint}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Data yang diekspor · {chosen.length}/{available.length}</p>
                  <button type="button" onClick={() => setOff(chosen.length === available.length ? new Set(SECTIONS.map((s) => s.key)) : new Set())} className="text-xs font-medium text-primary hover:underline">
                    {chosen.length === available.length ? 'Kosongkan' : 'Pilih semua'}
                  </button>
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {available.map((s) => {
                    const on = !off.has(s.key);
                    return (
                      <li key={s.key}>
                        <button type="button" role="switch" aria-checked={on} aria-label={s.label} onClick={() => toggle(s.key)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-bg/60">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{s.label}</span>
                            <span className="block text-xs text-muted">{s.hint}</span>
                          </span>
                          <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-line')}>
                            <span className={cn('absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white text-primary shadow transition-all', on ? 'left-[22px]' : 'left-0.5')}>{on && <Check size={12} strokeWidth={3} className="text-[#244f91]" />}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-muted">{format === 'pdf' ? 'Ringkasan, angka utama, dan pengesahan selalu ikut.' : 'Lembar Ringkasan (termasuk kategori & keluarga) selalu ikut.'}</p>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Cakupan</p>
                <dl className="space-y-1.5 rounded-xl bg-bg/70 p-3.5 text-sm">
                  {summary.map((s) => (
                    <div key={s.label} className="flex justify-between gap-4">
                      <dt className="shrink-0 text-muted">{s.label}</dt>
                      <dd className="text-right font-medium">{s.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-muted">Tidak memuat NIK/No. KK maupun data kesehatan per orang. Unduhan tercatat di audit log.</p>
              </section>
            </div>

            <footer className="flex gap-2 border-t border-line px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-lg border border-line px-4 text-sm font-medium hover:bg-bg">Batal</button>
              <a href={ready ? href : undefined} aria-disabled={!ready} onClick={(e) => { if (ready) setTimeout(() => setOpen(false), 150); else e.preventDefault(); }}
                className={cn('inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition', ready ? 'bg-[var(--brand)] hover:brightness-110' : 'cursor-not-allowed bg-muted/50')}>
                <Download size={17} /> {ready ? `Unduh ${format === 'pdf' ? 'PDF' : 'Excel'}` : 'Pilih minimal satu data'}
              </a>
            </footer>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
