'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, EmptyState, Input } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import type { VillageOption } from '@/lib/types';

/** Desa binaan Bhabin: boleh beberapa desa; satu desa hanya dibina satu Bhabin. */
export function VillagePicker({ userId, villages, selected }: { userId: string; villages: VillageOption[]; selected: string[] }) {
  const router = useRouter();
  const [chosen, setChosen] = useState(() => new Set(selected));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = chosen.size !== selected.length || selected.some((id) => !chosen.has(id));
  const shown = useMemo(() => villages.filter((v) => `${v.nama} ${v.kecamatan}`.toLowerCase().includes(q.toLowerCase())), [villages, q]);

  function pick(id: string) {
    setChosen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMsg(null);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await callApi(`/admin/users/${userId}/villages`, { method: 'PUT', body: { villageIds: [...chosen] } });
      setMsg({ ok: true, text: 'Desa binaan tersimpan ✓' });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (villages.length === 0) {
    return <EmptyState>Belum ada desa terdaftar di wilayah Polsek ini. Tambahkan data desa terlebih dahulu.</EmptyState>;
  }

  return (
    <div className="space-y-4 p-5">
      <p className="text-xs text-muted">Bhabin boleh membina beberapa desa, tetapi satu desa hanya dibina satu Bhabin. Laporan hanya dapat dikirim dari dalam desa yang dipilih (toleransi 200 m).</p>
      {villages.length > 8 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari desa/kecamatan" />}
      <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {shown.map((v) => (
          <li key={v.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-bg">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={chosen.has(v.id)} onChange={() => pick(v.id)} />
              <span>{v.nama}<span className="block text-xs text-muted">{v.kecamatan}, {v.kabupaten}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={!dirty} loading={busy} loadingText="Menyimpan…">Simpan desa binaan</Button>
        {chosen.size > 0 && <><span className="text-sm text-muted">{chosen.size} desa dipilih</span><button type="button" onClick={() => setChosen(new Set())} className="text-sm text-muted underline hover:text-danger">Lepas semua</button></>}
        {chosen.size === 0 && <span className="text-xs text-warn">Bhabin tanpa desa binaan tidak dapat membuat laporan.</span>}
        {msg && <span className={msg.ok ? 'text-sm text-success' : 'text-sm text-danger'}>{msg.text}</span>}
      </div>
    </div>
  );
}
