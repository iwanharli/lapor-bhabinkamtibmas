'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button } from '@/components/ui';

/** Menampilkan sandi sementara sekali saja, untuk diserahkan langsung ke pengguna. */
export function TempPassword({ password, nrp }: { password: string; nrp: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Alert tone="success" title={`Sandi sementara untuk NRP ${nrp}`}>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-surface px-3 py-1.5 font-mono text-base">{password}</code>
        <Button variant="secondary" size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />}
          onClick={() => navigator.clipboard.writeText(password).then(() => setCopied(true))}>
          {copied ? 'Tersalin' : 'Salin'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">Sandi ini hanya ditampilkan sekali. Pengguna wajib menggantinya saat login pertama.</p>
    </Alert>
  );
}
