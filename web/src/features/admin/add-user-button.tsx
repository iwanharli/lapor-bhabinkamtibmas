'use client';

import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { UserForm } from './user-form';

export function AddUserButton({ canAssignSuperadmin }: { canAssignSuperadmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // key baru setiap kali dibuka agar form selalu kosong.
  const [session, setSession] = useState(0);

  function close() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button icon={<UserPlus size={18} />} onClick={() => { setSession((n) => n + 1); setOpen(true); }}>Tambah pengguna</Button>
      <Modal open={open} onClose={close} size="lg" title="Tambah pengguna" description="Sandi sementara dibuat otomatis dan wajib diganti saat login pertama.">
        <UserForm key={session} canAssignSuperadmin={canAssignSuperadmin} onDone={close} />
      </Modal>
    </>
  );
}
