import Image from 'next/image';
import { cn } from '@/components/ui';

/** Lambang aplikasi (perisai Bhabin Report System). */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return <Image src="/logo.png" alt="Logo Bhabin Report System" width={size} height={Math.round(size * 1218 / 1292)} priority className={cn('shrink-0 object-contain drop-shadow', className)} />;
}
