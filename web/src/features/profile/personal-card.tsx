'use client';

import { BadgeCheck, Building2, Check, KeyRound, Pencil, Phone, UserRound, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { ROLE_LABEL } from '@/lib/format';

const PANGKAT = ['Bharada', 'Bharatu', 'Bharaka', 'Bripda', 'Briptu', 'Brigpol', 'Bripka', 'Aipda', 'Aiptu', 'Ipda', 'Iptu', 'AKP', 'Kompol', 'AKBP', 'Kombes Pol', 'Brigjen Pol', 'Irjen Pol', 'Komjen Pol', 'Jenderal Pol'];
const PHONE = /^(\+?62|0)8\d{7,12}$/;

type Data = { nama: string; pangkat: string | null; jabatan: string | null; phone: string | null; role: string };
const FIELDS = [
  { key: 'nama', label: 'Nama lengkap', icon: UserRound },
  { key: 'pangkat', label: 'Pangkat', icon: BadgeCheck },
  { key: 'jabatan', label: 'Jabatan', icon: Building2 },
  { key: 'phone', label: 'No. HP', icon: Phone },
] as const;

/** Kartu data pribadi yang bisa diedit sendiri (kecuali peran). Isian kosong ditandai merah. */
export function PersonalCard({ data, className }: { data: Data; className?: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState({ nama: data.nama, pangkat: data.pangkat ?? '', jabatan: data.jabatan ?? '', phone: data.phone ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const missing = FIELDS.filter((f) => !data[f.key]).length;

  const phoneBad = !!v.phone.trim() && !PHONE.test(v.phone.trim());
  const namaBad = v.nama.trim().length < 2;

  function cancel() {
    setV({ nama: data.nama, pangkat: data.pangkat ?? '', jabatan: data.jabatan ?? '', phone: data.phone ?? '' });
    setError('');
    setEdit(false);
  }
  async function save() {
    if (phoneBad || namaBad) return;
    setBusy(true);
    setError('');
    try {
      await callApi('/auth/profile', { method: 'PATCH', body: { nama: v.nama.trim(), pangkat: v.pangkat.trim(), jabatan: v.jabatan.trim(), phone: v.phone.trim() } });
      setEdit(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-sm', className)}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <UserRound size={16} className="text-[var(--brand)]" />
        <h2 className="flex-1 text-sm font-semibold">Data pribadi</h2>
        {!edit && missing > 0 && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">{missing} belum diisi</span>}
        {!edit && (
          <button type="button" onClick={() => setEdit(true)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:bg-bg">
            <Pencil size={13} /> Ubah
          </button>
        )}
      </header>

      {edit ? (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Nama lengkap <span className="text-danger">*</span></span>
            <input value={v.nama} onChange={(e) => setV({ ...v, nama: e.target.value })} maxLength={150}
              className={cn('h-10 w-full rounded-lg border bg-bg px-3 text-sm outline-none focus:border-primary/60', namaBad ? 'border-danger' : 'border-line')} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Pangkat</span>
              <input list="pangkat-list" value={v.pangkat} onChange={(e) => setV({ ...v, pangkat: e.target.value })} maxLength={40} placeholder="mis. Bripka"
                className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm outline-none focus:border-primary/60" />
              <datalist id="pangkat-list">{PANGKAT.map((p) => <option key={p} value={p} />)}</datalist>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">No. HP / WhatsApp</span>
              <input type="tel" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value.replace(/[^\d+]/g, '') })} maxLength={16} placeholder="08xxxxxxxxxx"
                className={cn('h-10 w-full rounded-lg border bg-bg px-3 text-sm tracking-wide outline-none focus:border-primary/60', phoneBad ? 'border-danger' : 'border-line')} />
              {phoneBad && <span className="mt-1 block text-[11px] text-danger">Format: 08… atau +628…</span>}
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Jabatan</span>
            <input value={v.jabatan} onChange={(e) => setV({ ...v, jabatan: e.target.value })} maxLength={120} placeholder="mis. Bhabinkamtibmas Desa Sukamaju"
              className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm outline-none focus:border-primary/60" />
          </label>
          <p className="flex items-center gap-1.5 text-xs text-muted"><KeyRound size={13} /> Peran {ROLE_LABEL[data.role] ?? data.role} hanya bisa diubah admin.</p>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={cancel} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium hover:bg-bg"><X size={15} /> Batal</button>
            <button type="submit" disabled={busy || phoneBad || namaBad}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"><Check size={15} /> {busy ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      ) : (
        <dl className="divide-y divide-line/70">
          {FIELDS.map((f) => {
            const val = data[f.key];
            return (
              <div key={f.key} className={cn('flex items-start gap-3 px-4 py-3', !val && 'bg-danger-soft/30')}>
                <f.icon size={16} className={cn('mt-0.5 shrink-0', val ? 'text-muted' : 'text-danger')} />
                <dt className="w-32 shrink-0 text-sm text-muted">{f.label}</dt>
                <dd className="min-w-0 flex-1 break-words text-sm font-medium">
                  {!val ? (
                    <button type="button" onClick={() => setEdit(true)} className="inline-flex items-center gap-1 font-semibold text-danger hover:underline">Belum diisi <Pencil size={12} /></button>
                  ) : f.key === 'phone' ? <a href={`tel:${val}`} className="text-primary hover:underline">{val}</a> : val}
                </dd>
              </div>
            );
          })}
          <div className="flex items-start gap-3 px-4 py-3">
            <KeyRound size={16} className="mt-0.5 shrink-0 text-muted" />
            <dt className="w-32 shrink-0 text-sm text-muted">Peran</dt>
            <dd className="min-w-0 flex-1 text-sm font-medium">{ROLE_LABEL[data.role] ?? data.role}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
