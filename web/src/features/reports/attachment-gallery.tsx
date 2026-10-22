'use client';

import { Camera, ChevronLeft, ChevronRight, Download, FileText, Film, ImageOff, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn, EmptyState } from '@/components/ui';
import { tanggalJam } from '@/lib/format';
import type { ReportAttachment, SchemaField } from '@/lib/types';

const fileUrl = (id: string, thumb = false) => `/api/proxy/attachments/${id}/file${thumb ? '?thumb=1' : ''}`;
const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB` : `${Math.round(b / 1024)} KB`);
const isImage = (a: ReportAttachment) => a.mime.startsWith('image/');

/** Galeri lampiran dikelompokkan per field skema, dengan lightbox (← → Esc). */
export function AttachmentGallery({ items, fields }: { items: ReportAttachment[]; fields: SchemaField[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const images = items.filter(isImage);
  const label = (k: string) => fields.find((f) => f.key === k)?.label ?? k;
  const groups = [...new Set(items.map((a) => a.fieldKey))];

  const move = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + images.length) % images.length)), [images.length]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, move]);

  if (items.length === 0) {
    return (
      <EmptyState icon={<ImageOff size={22} />} tone="neutral" title="Belum ada lampiran">
        Foto dari aplikasi mobile akan tampil di sini.
      </EmptyState>
    );
  }

  const current = open != null ? images[open] : null;

  return (
    <div className="space-y-5 p-5">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{label(g)}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.filter((a) => a.fieldKey === g).map((a) =>
              isImage(a) ? (
                <button key={a.id} type="button" onClick={() => setOpen(images.indexOf(a))}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-bg focus:outline-none focus:ring-2 focus:ring-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element -- gambar dari BFF terautentikasi, bukan aset statis */}
                  <img src={fileUrl(a.id, a.hasThumb)} alt={label(g)} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  {a.source === 'CAMERA' && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
                      <Camera size={11} /> Kamera
                    </span>
                  )}
                </button>
              ) : (
                <a key={a.id} href={fileUrl(a.id)} target="_blank" rel="noreferrer"
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-line bg-bg p-3 text-center text-sm hover:border-primary">
                  {a.mime === 'video/mp4' ? <Film size={28} className="text-primary" /> : <FileText size={28} className="text-primary" />}
                  <span className="font-medium">{a.mime === 'video/mp4' ? 'Video' : 'Dokumen PDF'}</span>
                  <span className="text-xs text-muted">{size(a.sizeBytes)}</span>
                </a>
              ),
            )}
          </div>
        </div>
      ))}

      {current && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Pratinjau lampiran" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between gap-4 p-4 text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <span>
              <strong>{label(current.fieldKey)}</strong>
              <span className="ml-2 text-white/60">{open! + 1} / {images.length}{current.capturedAt && ` · diambil ${tanggalJam(current.capturedAt)}`}{current.watermarked && ' · bertanda air'}</span>
            </span>
            <span className="flex gap-2">
              <a href={fileUrl(current.id)} download className="rounded-lg p-2 hover:bg-white/10" aria-label="Unduh"><Download size={20} /></a>
              <button type="button" onClick={() => setOpen(null)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Tutup"><X size={22} /></button>
            </span>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
            {images.length > 1 && (
              <button type="button" onClick={(e) => { e.stopPropagation(); move(-1); }} aria-label="Sebelumnya"
                className="absolute left-4 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ChevronLeft size={24} /></button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(current.id)} alt={label(current.fieldKey)} onClick={(e) => e.stopPropagation()}
              className={cn('max-h-full max-w-full rounded-lg object-contain shadow-2xl')} />
            {images.length > 1 && (
              <button type="button" onClick={(e) => { e.stopPropagation(); move(1); }} aria-label="Berikutnya"
                className="absolute right-4 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><ChevronRight size={24} /></button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
