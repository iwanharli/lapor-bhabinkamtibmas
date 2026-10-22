import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { FieldShell } from '@/features/bhabin/field-shell';
import { getSessionUser } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Lapor Bhabinkamtibmas · Lapangan' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0a1730' };

/** Tampilan lapangan untuk Bhabinkamtibmas (web/HP) — pengganti sementara aplikasi mobile. */
export default async function BhabinLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'BHABIN') redirect('/');
  return <FieldShell user={user}>{children}</FieldShell>;
}
