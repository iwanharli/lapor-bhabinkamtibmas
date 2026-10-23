'use client';

import { useEffect } from 'react';

/** File JS/CSS versi lama sudah tidak ada setelah deploy baru. */
const STALE = /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Failed to fetch/i;

/**
 * Galat di layout utama: menggantikan seluruh halaman, CSS aplikasi bisa jadi tidak termuat,
 * jadi gaya ditulis inline (warna mengikuti mode gelap sistem).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!STALE.test(`${error.name} ${error.message}`)) return;
    try {
      if (sessionStorage.getItem('reload-after-deploy') === location.pathname) return;
      sessionStorage.setItem('reload-after-deploy', location.pathname);
    } catch {
      /* penyimpanan tidak tersedia: tetap muat ulang sekali */
    }
    location.reload();
  }, [error]);

  return (
    <html lang="id">
      <body className="ge">
        <style>{`
          .ge{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f6fb;color:#0f172a;
            font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
          .ge-card{width:100%;max-width:520px;box-sizing:border-box;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:40px 28px;
            text-align:center;box-shadow:0 28px 80px -44px rgba(16,43,88,.45)}
          .ge-code{margin:0;font:700 48px/1 ui-monospace,Menlo,monospace;letter-spacing:-.08em;color:#c81e3a}
          .ge h1{margin:10px 0 0;font-size:24px}
          .ge p{margin:12px auto 0;max-width:380px;font-size:14px;line-height:1.6;color:#64748b}
          .ge-ref{font:12px ui-monospace,Menlo,monospace}
          .ge-act{margin-top:28px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
          .ge-act a,.ge-act button{height:44px;padding:0 20px;border-radius:12px;font:600 14px inherit;font-family:inherit;cursor:pointer;
            display:inline-flex;align-items:center;text-decoration:none}
          .ge-act button{border:0;background:#1d4ed8;color:#fff}
          .ge-act a{border:1px solid #e2e8f0;background:#fff;color:#0f172a}
          @media (prefers-color-scheme:dark){
            .ge{background:#0b1220;color:#e2e8f0}.ge-card{background:#111a2e;border-color:#1e293b}
            .ge p{color:#94a3b8}.ge-act a{background:#111a2e;border-color:#1e293b;color:#e2e8f0}
          }
        `}</style>
        <main className="ge-card">
          <p className="ge-code">500</p>
          <h1>Aplikasi sedang bermasalah</h1>
          <p>Maaf, halaman tidak dapat dimuat. Coba muat ulang, atau kembali ke halaman utama.</p>
          {error.digest && <p className="ge-ref">Kode referensi: {error.digest}</p>}
          <div className="ge-act">
            <button type="button" onClick={reset}>Coba lagi</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- muat ulang penuh; router klien bisa jadi rusak */}
            <a href="/">Ke halaman utama</a>
          </div>
          <p style={{ fontSize: 12, marginTop: 28 }}>Lapor Bhabinkamtibmas · Baharkam Polri</p>
        </main>
      </body>
    </html>
  );
}
