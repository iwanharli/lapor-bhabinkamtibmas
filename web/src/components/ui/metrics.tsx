import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { cn } from './cn';

/** Label bagian: "AKTIVITAS LAPORAN  periode terpilih ────". */
export function SectionLabel({ title, hint, className }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{title}</h2>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      <span className="h-px flex-1 bg-line/80" />
    </div>
  );
}

/**
 * Perubahan dibanding periode sebelumnya: pil persentase + label.
 * Bila nilai pembanding kosong atau terlalu kecil (< `minBase`), persentase tidak ditampilkan karena menyesatkan
 * (mis. 2 → 70 = +3.400%). `inverse` bila kenaikan itu buruk.
 */
export function Delta({
  now,
  prev,
  inverse,
  onDark,
  label = 'vs periode sebelumnya',
  minBase = 5,
  className,
}: {
  now: number;
  prev: number;
  inverse?: boolean;
  onDark?: boolean;
  label?: string;
  minBase?: number;
  className?: string;
}) {
  const text = onDark ? 'text-white/75' : 'text-muted';
  if (!prev) return <span className={cn('text-sm', text, className)}>Belum ada data pembanding</span>;
  // Pembanding harus cukup besar (absolut & relatif) agar persentase bermakna.
  if (prev < Math.max(minBase, Math.abs(now) * 0.1)) return <span className={cn('text-sm', text, className)}>Data pembanding belum cukup</span>;
  const pct = Math.round(((now - prev) / prev) * 1000) / 10;
  const up = pct >= 0;
  const good = inverse ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  const tone = onDark ? 'bg-white/15 text-white' : good ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger';
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2 text-sm', text, className)}>
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', tone)}>
        <Icon size={13} strokeWidth={2.4} />
        {up ? '+' : ''}
        {pct.toLocaleString('id-ID')}%
      </span>
      {label}
    </span>
  );
}

const ICON_TONE = {
  primary: 'bg-primary-soft text-primary',
  accent: 'bg-accent/15 text-accent-ink',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
} as const;

export type MetricTone = keyof typeof ICON_TONE;

export function IconChip({ tone = 'primary', children, className }: { tone?: MetricTone; children: React.ReactNode; className?: string }) {
  return <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', ICON_TONE[tone], className)}>{children}</span>;
}

/** Kartu metrik: judul + keterangan + ikon di atas, angka besar di bawah, catatan/perubahan di kaki. */
export function StatCard({
  title,
  description,
  icon,
  tone = 'primary',
  value,
  suffix,
  footer,
  href,
  alert,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: MetricTone;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  footer?: React.ReactNode;
  href?: string;
  /** Kartu bernuansa merah untuk hal yang perlu ditindaklanjuti. */
  alert?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'group relative flex h-full min-h-[148px] flex-col rounded-2xl border bg-surface p-4 shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.04),0_8px_22px_-16px_rgb(var(--shadow-tint)/0.2)] transition duration-200',
        alert ? 'border-danger/25 bg-gradient-to-br from-danger-soft/70 to-surface' : 'border-line',
        href && 'hover:-translate-y-0.5 hover:shadow-lg',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn('font-semibold leading-snug', alert && 'text-danger')}>{title}</p>
          {description && <p className={cn('mt-1 text-[13px] leading-snug', alert ? 'text-danger/80' : 'text-muted')}>{description}</p>}
        </div>
        {icon && <IconChip tone={alert ? 'danger' : tone} className="h-9 w-9 rounded-lg">{icon}</IconChip>}
      </div>
      <div className="mt-auto pt-4">
        <p className={cn('text-4xl font-bold leading-none tracking-tight tabular-nums', alert && 'text-danger')}>
          {value}
          {suffix && <span className="ml-1 text-xl font-medium text-muted">{suffix}</span>}
        </p>
        {footer && <div className={cn('mt-3 flex flex-wrap items-center gap-2 text-sm text-muted', href && 'pr-6')}>{footer}</div>}
      </div>
      {href && (
        <Link href={href} aria-label={`Lihat ${title}`} className="absolute inset-0 rounded-2xl">
          <ArrowUpRight size={16} className="absolute bottom-5 right-5 text-muted/60 transition group-hover:text-primary" />
        </Link>
      )}
    </div>
  );
}

/** Garis tren kecil (SVG). Warna mengikuti `currentColor` (atur lewat class text-*); aman dipakai berkali-kali per halaman. */
export function Sparkline({ values, className, fill = true }: { values: (number | null)[]; className?: string; fill?: boolean }) {
  const id = useId();
  const pts0 = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts0.length < 2) return null;
  const w = 300;
  const h = 80;
  const ys = pts0.map(([, v]) => v);
  const max = Math.max(...ys);
  const min = Math.min(...ys);
  const pts = pts0.map(([i, v]) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / (max - min || 1)) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [x0] = pts[0];
  const [x1] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${x1},${h} L${x0},${h} Z`} fill={`url(#${id})`} />
        </>
      )}
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Cincin persentase (SVG). */
export function RingProgress({ value, label, size = 128, className }: { value: number; label?: string; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="11" className="stroke-success-soft" />
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="11" strokeLinecap="round" className="stroke-success transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-2xl font-bold text-success tabular-nums">{Math.round(pct)}%</span>
        {label && <span className="text-[10px] font-semibold uppercase tracking-wider text-success/80">{label}</span>}
      </div>
    </div>
  );
}

/** Batang proporsi dua/lebih bagian dengan legenda. */
export function SplitBar({ parts, onDark }: { parts: { label: string; value: number; className: string }[]; onDark?: boolean }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className={cn('flex h-2 overflow-hidden rounded-full', onDark ? 'bg-white/20' : 'bg-line')}>
        {parts.map((p) => <span key={p.label} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <div className={cn('mt-3 flex flex-wrap justify-between gap-2 text-sm', onDark ? 'text-white/85' : 'text-muted')}>
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', p.className)} />
            {p.label} <strong className={onDark ? 'text-white' : 'text-ink'}>{p.value.toLocaleString('id-ID')}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
