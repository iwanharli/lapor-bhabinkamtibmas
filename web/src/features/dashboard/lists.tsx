import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { CATEGORY_LABEL, tanggalJam } from '@/lib/format';
import type { Overview } from '@/lib/types';

/** Jumlah laporan per kategori dengan batang proporsi. */
export function CategoryBars({ rows, hrefFor }: { rows: Overview['byCategory']; hrefFor: (category: string) => string }) {
  const max = Math.max(...rows.map((r) => r.jumlah), 1);
  const total = rows.reduce((s, r) => s + r.jumlah, 0) || 1;
  return (
    <ul className="space-y-3.5 p-5">
      {rows.map((c) => (
        <li key={c.category}>
          <Link href={hrefFor(c.category)} className="group block">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="group-hover:text-primary">{CATEGORY_LABEL[c.category]}</span>
              <span className="tabular-nums">
                <strong>{c.jumlah}</strong>
                <span className="ml-1.5 text-xs text-muted">{Math.round((c.jumlah / total) * 100)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-primary-soft">
              <div className="h-2 rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${(c.jumlah / max) * 100}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PriorityList({ rows }: { rows: Overview['priority'] }) {
  if (rows.length === 0) {
    return (
      <EmptyState icon={<ShieldCheck size={24} />} title="Tidak ada prioritas terbuka" className="h-full">
        Semua laporan deteksi dini urgensi tinggi sudah diputuskan.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/laporan/${r.id}`} className="block px-5 py-3 text-sm hover:bg-bg">
            <span className="font-medium text-danger">{r.data.kategori_kerawanan}</span> · {r.village.nama}
            <span className="block text-xs text-muted">{r.nomor} · {r.user.nama} · {tanggalJam(r.occurredAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
