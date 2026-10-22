import { Check, CircleDot, RotateCcw, X } from 'lucide-react';
import { cn } from '@/components/ui';
import { personName, tanggalJam } from '@/lib/format';
import type { ReportDetail } from '@/lib/types';

type Tone = 'done' | 'current' | 'todo' | 'warn' | 'danger';

const DOT: Record<Tone, string> = {
  done: 'bg-success text-white',
  current: 'bg-primary text-white ring-4 ring-primary/15',
  todo: 'bg-line text-muted',
  warn: 'bg-warn text-white',
  danger: 'bg-danger text-white',
};

/** Alur status laporan dalam tiga tahap: Terkirim → Ditinjau → Keputusan. */
export function StatusStepper({ report: r }: { report: ReportDetail }) {
  const at = (s: string) => [...r.history].reverse().find((h) => h.toStatus === s);
  const submitted = at('SUBMITTED');
  const reviewed = at('IN_REVIEW');
  const decision = ['APPROVED', 'NEEDS_REVISION', 'REJECTED'].includes(r.status) ? at(r.status) : undefined;

  const decisionStep = {
    APPROVED: { label: 'Disetujui', tone: 'done' as Tone, icon: <Check size={15} /> },
    NEEDS_REVISION: { label: 'Perlu revisi', tone: 'warn' as Tone, icon: <RotateCcw size={14} /> },
    REJECTED: { label: 'Ditolak', tone: 'danger' as Tone, icon: <X size={15} /> },
  }[r.status as 'APPROVED'] ?? { label: 'Keputusan', tone: 'todo' as Tone, icon: <CircleDot size={14} /> };

  const steps = [
    { label: 'Terkirim', tone: (submitted ? 'done' : 'todo') as Tone, icon: <Check size={15} />, entry: submitted },
    {
      label: 'Ditinjau',
      tone: (reviewed ? (decision ? 'done' : 'current') : r.status === 'SUBMITTED' ? 'todo' : 'done') as Tone,
      icon: reviewed && !decision ? <CircleDot size={14} /> : <Check size={15} />,
      entry: reviewed,
    },
    { ...decisionStep, entry: decision },
  ];

  return (
    <ol className="grid gap-4 p-5 sm:grid-cols-3 sm:gap-0">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center">
          {i < steps.length - 1 && (
            <span className={cn('absolute left-1/2 top-4 hidden h-0.5 w-full sm:block', s.tone === 'done' ? 'bg-success/50' : 'bg-line')} />
          )}
          <span className={cn('relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full', DOT[s.tone])}>{s.icon}</span>
          <div className="sm:mt-2">
            <p className={cn('text-sm font-semibold', s.tone === 'todo' && 'text-muted')}>{s.label}</p>
            {s.entry ? (
              <p className="text-xs text-muted">
                {tanggalJam(s.entry.at)}
                <span className="block">{personName(s.entry.actor)}</span>
              </p>
            ) : (
              <p className="text-xs text-muted">{s.tone === 'current' ? 'sedang berlangsung' : 'belum'}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
