/** Pemanggil API dari komponen klien lewat BFF /api/proxy. Melempar Error dengan pesan siap tampil. */
export async function callApi<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error;
    const detail = Array.isArray(err?.details) ? `: ${err.details.join('; ')}` : '';
    throw new Error((err?.message ?? 'Permintaan gagal') + detail);
  }
  return body as T;
}
