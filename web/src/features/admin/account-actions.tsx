'use client';

import { KeyRound, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button, ConfirmDialog, Modal, ModalBody } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { tanggalJam } from '@/lib/format';
import type { DeviceRow } from '@/lib/types';
import { TempPassword } from './temp-password';

function DeviceList({ devices, onRevoke, tz }: { devices: DeviceRow[]; onRevoke: (d: DeviceRow) => void; tz?: string }) {
  if (devices.length === 0) return <p className="text-sm text-muted">Belum pernah login dari aplikasi mobile.</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
      {devices.map((d) => (
        <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
          <Smartphone size={18} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1">
            {d.model ?? 'Perangkat'} <span className="text-muted">· {d.platform}{d.appVersion && ` · v${d.appVersion}`}</span>
            <span className="block text-xs text-muted">{d.lastSeenAt ? `Terakhir aktif ${tanggalJam(d.lastSeenAt, tz)}` : '—'}</span>
          </span>
          {d.revokedAt ? (
            <Badge tone="danger">Dicabut</Badge>
          ) : (
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => onRevoke(d)}>Cabut</Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AccountActions({ userId, nrp, nama, devices, tz }: { userId: string; nrp: string; nama: string; devices: DeviceRow[]; tz?: string }) {
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<DeviceRow | null>(null);

  return (
    <div className="space-y-5 p-5">
      <div>
        <Button variant="outline-warn" icon={<KeyRound size={16} />} onClick={() => setConfirmReset(true)}>Reset sandi</Button>
        <p className="mt-1.5 text-xs text-muted">Membuat sandi sementara baru dan mengeluarkan pengguna dari semua perangkat.</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Perangkat terdaftar</p>
        <DeviceList devices={devices} onRevoke={setRevokeTarget} tz={tz} />
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        tone="warn"
        title="Reset sandi pengguna?"
        message={<><strong>{nama}</strong> (NRP {nrp}) akan dikeluarkan dari semua perangkat dan harus login dengan sandi sementara baru.</>}
        confirmLabel="Reset sandi"
        onConfirm={async () => {
          const res = await callApi<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`, { method: 'POST' });
          setConfirmReset(false);
          setPassword(res.temporaryPassword);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title="Cabut akses perangkat?"
        message={<>Perangkat <strong>{revokeTarget?.model ?? revokeTarget?.platform}</strong> tidak bisa lagi mengakses akun ini. Laporan yang belum tersinkron di perangkat tersebut akan tertahan sampai pengguna login ulang.</>}
        confirmLabel="Cabut akses"
        onConfirm={async () => {
          await callApi(`/admin/users/${userId}/devices/${revokeTarget!.id}`, { method: 'DELETE' });
          setRevokeTarget(null);
          router.refresh();
        }}
      />

      <Modal
        open={password !== null}
        onClose={() => setPassword(null)}
        size="sm"
        title="Sandi berhasil direset"
        description="Serahkan sandi ini langsung kepada pengguna."
        footer={<Button onClick={() => setPassword(null)}>Selesai</Button>}
      >
        <ModalBody>{password && <TempPassword password={password} nrp={nrp} />}</ModalBody>
      </Modal>
    </div>
  );
}
