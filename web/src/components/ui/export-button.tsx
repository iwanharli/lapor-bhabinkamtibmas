'use client';

import { Download, Loader2, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { buttonClass } from './button';
import { cn } from './cn';

type Job = { id: string; status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'; rows: number | null; error: string | null };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, { ...init, headers: { 'content-type': 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? 'Ekspor gagal');
  return body as T;
}

/**
 * Tombol ekspor CSV lewat antrean: membuat pekerjaan ekspor, memantau sampai selesai, lalu mengunduh otomatis.
 * `path` sama seperti unduhan langsung, mis. "/exports/reports.csv?status=APPROVED" (jenis & filter diambil darinya).
 */
export function ExportButton({ path, label = 'Ekspor CSV' }: { path: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  async function run() {
    if (state === 'working') return;
    const url = new URL(path, 'http://x');
    const kind = url.pathname.split('/').pop()!.replace(/\.csv$/, '');
    setState('working');
    setMessage('Menyiapkan berkas…');
    try {
      let job = await api<Job>('/exports/jobs', { method: 'POST', body: JSON.stringify({ kind, params: Object.fromEntries(url.searchParams) }) });
      for (let i = 0; job.status === 'QUEUED' || job.status === 'RUNNING'; i++) {
        await new Promise((r) => setTimeout(r, i < 5 ? 700 : 2000));
        if (!alive.current) return;
        job = await api<Job>(`/exports/jobs/${job.id}`);
        if (job.status === 'RUNNING') setMessage('Memproses data…');
      }
      if (job.status === 'FAILED') throw new Error(job.error ?? 'Ekspor gagal');
      const a = document.createElement('a');
      a.href = `/api/proxy/exports/jobs/${job.id}/file`;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setState('idle');
    } catch (e) {
      setState('error');
      setMessage((e as Error).message);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      aria-busy={state === 'working'}
      className={cn(buttonClass({ variant: 'secondary' }), state === 'error' && 'border-danger/40 text-danger')}
      title={state === 'idle' ? 'Unduh sebagai CSV (dapat dibuka di Excel)' : message}
    >
      {state === 'working' ? <Loader2 size={16} className="animate-spin" /> : state === 'error' ? <TriangleAlert size={16} /> : <Download size={16} />}
      {state === 'working' ? message : state === 'error' ? 'Ekspor gagal — coba lagi' : label}
    </button>
  );
}
