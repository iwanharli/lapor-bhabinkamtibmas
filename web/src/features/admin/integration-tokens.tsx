'use client';

import { Check, Copy, KeyRound, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorText, Field, Input, Modal, ModalBody, Stack, Table, Td, Textarea, Th, THead, Tr, cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { tanggalJam } from '@/lib/format';
import type { IntegrationTokenItem, IntegrationTokenList } from '@/lib/types';

const parseIps = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);

/** Salin teks ke clipboard. Teks berupa Promise didukung (Safari menolak menulis clipboard setelah `await`). */
async function copyText(text: string | Promise<string>) {
  if (typeof text !== 'string' && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = text.then((t) => new Blob([t], { type: 'text/plain' }));
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
    return;
  }
  const value = await text;
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  // Tanpa konteks aman (HTTP di jaringan internal): cara lama.
  const ta = Object.assign(document.createElement('textarea'), { value });
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

/** Tombol token yang bisa diklik untuk menyalin. `token` langsung, atau `reveal` mengambilnya dari server. */
function CopyToken({ prefix, token, reveal, disabled }: { prefix: string; token?: string; reveal?: () => Promise<string>; disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [error, setError] = useState('');

  async function copy() {
    setError('');
    try {
      await copyText(token ?? reveal!());
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch (e) {
      setState('error');
      setError((e as Error).message || 'Gagal menyalin');
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={copy} disabled={disabled} title={disabled ? 'Token tidak bisa disalin' : 'Klik untuk menyalin token'}
        className={cn('group inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1 font-mono text-xs transition',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-[var(--brand)] hover:text-[var(--brand)]')}>
        <span className="truncate">{token ?? `${prefix}…`}</span>
        {state === 'copied' ? <Check size={14} className="shrink-0 text-success" /> : <Copy size={14} className="shrink-0 text-muted group-hover:text-current" />}
        {state === 'copied' && <span className="font-sans text-success">Tersalin</span>}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

const reveal = (id: string) => () => callApi<{ token: string }>(`/admin/integration-tokens/${id}/reveal`, { method: 'POST' }).then((r) => r.token);

function IpList({ ips, defaultIps }: { ips: string[]; defaultIps: string[] }) {
  if (ips.length) return <span className="font-mono text-xs">{ips.join(', ')}</span>;
  return defaultIps.length
    ? <span className="text-xs text-muted">Bawaan server: <span className="font-mono">{defaultIps.join(', ')}</span></span>
    : <span className="text-xs text-warn">Semua IP diizinkan</span>;
}

export function IntegrationTokens({ list, tz }: { list: IntegrationTokenList; tz?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<IntegrationTokenItem | null>(null);
  const [revoking, setRevoking] = useState<IntegrationTokenItem | null>(null);
  const active = list.tokens.filter((t) => !t.revokedAt);

  return (
    <Stack>
      <Card title="Token" subtitle={`${active.length} aktif · klik token untuk menyalin (tercatat di audit log)`} bodyClassName="p-0">
        {list.tokens.length === 0 ? (
          <EmptyState icon={<KeyRound size={24} />} tone="neutral" title="Belum ada token" className="py-16">Buat token untuk dipasang di server Command Center Pusat.</EmptyState>
        ) : (
          <Table minWidth={900}>
            <THead>
              <Th className="pl-5">Nama</Th>
              <Th>Token</Th>
              <Th>IP diizinkan</Th>
              <Th>Terakhir dipakai</Th>
              <Th>Status</Th>
              <Th />
            </THead>
            <tbody>
              {list.tokens.map((t) => (
                <Tr key={t.id} className={cn(t.revokedAt && 'opacity-60')}>
                  <Td className="pl-5">
                    <span className="block font-medium">{t.nama}</span>
                    <span className="block text-xs text-muted">Dibuat oleh {t.user.nama} ({t.user.nrp}) · {tanggalJam(t.createdAt, tz)}</span>
                  </Td>
                  <Td>
                    {t.copyable
                      ? <CopyToken prefix={t.prefix} reveal={reveal(t.id)} />
                      : <span className="font-mono text-xs text-muted" title={t.revokedAt ? undefined : 'Dibuat sebelum token bisa disalin; buat token baru bila perlu'}>{t.prefix}…</span>}
                  </Td>
                  <Td><IpList ips={t.allowedIps} defaultIps={list.defaultIps} /></Td>
                  <Td className="text-sm">{t.lastUsedAt ? tanggalJam(t.lastUsedAt, tz) : <span className="text-muted">Belum pernah</span>}</Td>
                  <Td>
                    {t.revokedAt
                      ? <Badge tone="danger">Dicabut {tanggalJam(t.revokedAt, tz)}</Badge>
                      : t.user.active ? <Badge tone="success">Aktif</Badge> : <Badge tone="warn">Akun nonaktif</Badge>}
                  </Td>
                  <Td align="right" className="pr-5">
                    {!t.revokedAt && (
                      <span className="inline-flex gap-1">
                        <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(t)}>Ubah</Button>
                        <Button variant="outline-danger" size="sm" onClick={() => setRevoking(t)}>Cabut</Button>
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <EditTokenModal token={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="Cabut token?"
        confirmLabel="Ya, cabut"
        message={<>Token <span className="font-mono">{revoking?.prefix}…</span> ({revoking?.nama}) langsung ditolak dan tidak bisa dipulihkan. Pastikan Pusat sudah memakai token pengganti.</>}
        onConfirm={async () => {
          await callApi(`/admin/integration-tokens/${revoking!.id}/revoke`, { method: 'POST' });
          setRevoking(null);
          router.refresh();
        }}
      />
    </Stack>
  );
}

function EditTokenModal({ token, onClose }: { token: IntegrationTokenItem | null; onClose: () => void }) {
  const router = useRouter();
  const [nama, setNama] = useState('');
  const [ips, setIps] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Isi ulang form setiap kali token lain dibuka.
  if (token && token.id !== loadedId) {
    setLoadedId(token.id);
    setNama(token.nama);
    setIps(token.allowedIps.join('\n'));
    setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nama.trim().length < 2) return setError('Nama wajib diisi.');
    setBusy(true);
    setError('');
    try {
      await callApi(`/admin/integration-tokens/${token!.id}`, { method: 'PATCH', body: { nama: nama.trim(), allowedIps: parseIps(ips) } });
      setLoadedId(null);
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!token} onClose={() => { setLoadedId(null); onClose(); }} dismissible={!busy} size="sm" title="Ubah token"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Batal</Button>
          <Button type="submit" form="edit-token-form" loading={busy} loadingText="Menyimpan…">Simpan</Button>
        </>
      }>
      <form id="edit-token-form" onSubmit={submit}>
        <ModalBody>
          <Field label="Nama" required>{(id) => <Input id={id} value={nama} onChange={(e) => setNama(e.target.value)} />}</Field>
          <IpField value={ips} onChange={setIps} />
          <ErrorText>{error}</ErrorText>
        </ModalBody>
      </form>
    </Modal>
  );
}

function IpField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="IP diizinkan" hint="Satu IP atau CIDR per baris (mis. 10.1.2.3 atau 10.9.0.0/16). Kosong = memakai INTEGRATION_ALLOWED_IPS server; jika bawaan juga kosong, semua IP diizinkan.">
      {(id) => <Textarea id={id} rows={3} className="font-mono text-sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder="10.1.2.3" />}
    </Field>
  );
}

export function CreateTokenButton({ defaultIps }: { defaultIps: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState('');
  const [ips, setIps] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ prefix: string; token: string } | null>(null);

  function show() {
    setNama('Command Center Pusat');
    setIps('');
    setError('');
    setCreated(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    if (created) router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nama.trim().length < 2) return setError('Nama wajib diisi.');
    const list = parseIps(ips);
    setBusy(true);
    setError('');
    try {
      setCreated(await callApi<{ prefix: string; token: string }>('/admin/integration-tokens', { method: 'POST', body: { nama: nama.trim(), allowedIps: list } }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button icon={<Plus size={18} />} onClick={show}>Buat token</Button>
      <Modal open={open} onClose={close} dismissible={!busy} size="sm" title={created ? 'Token dibuat' : 'Buat token integrasi'}
        footer={created
          ? <Button onClick={close}>Selesai</Button>
          : (
            <>
              <Button variant="secondary" onClick={close} disabled={busy}>Batal</Button>
              <Button type="submit" form="create-token-form" loading={busy} loadingText="Membuat…">Buat token</Button>
            </>
          )}>
        {created ? (
          <ModalBody>
            <p className="text-sm">Klik token untuk menyalin, lalu pasang di server Pusat sebagai <span className="font-mono">Authorization: Bearer &lt;token&gt;</span>.</p>
            <CopyToken prefix={created.prefix} token={created.token} />
            <p className="text-xs text-muted">Token tetap bisa disalin lagi dari daftar selama belum dicabut. Perlakukan seperti sandi.</p>
          </ModalBody>
        ) : (
          <form id="create-token-form" onSubmit={submit}>
            <ModalBody>
              <Field label="Nama" required hint="Untuk mengenali token, mis. lingkungan atau server pemakainya.">
                {(id) => <Input id={id} value={nama} onChange={(e) => setNama(e.target.value)} />}
              </Field>
              <IpField value={ips} onChange={setIps} />
              <ErrorText>{error}</ErrorText>
            </ModalBody>
          </form>
        )}
      </Modal>
    </>
  );
}
