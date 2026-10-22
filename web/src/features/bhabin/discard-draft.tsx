'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ConfirmDialog } from '@/components/ui';
import { callApi } from '@/lib/api/client';

/** Tombol buang draft (beserta fotonya) dengan konfirmasi. */
export function DiscardDraft({ id, className }: { id: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline-danger" className={className} icon={<Trash2 size={16} />} onClick={() => setOpen(true)}>Buang</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Buang draft ini?"
        message="Draft dan foto yang sudah diunggah akan dihapus permanen dan tidak bisa dikembalikan."
        confirmLabel="Ya, buang draft"
        onConfirm={async () => {
          await callApi(`/reports/${id}`, { method: 'DELETE' });
          router.replace('/bhabin/laporan?status=DRAFT&dibuang=1');
          router.refresh();
        }}
      />
    </>
  );
}
