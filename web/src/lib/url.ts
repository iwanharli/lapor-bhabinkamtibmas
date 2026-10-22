/** Objek parameter URL; nilai undefined/kosong diabaikan. Menerima interface filter apa pun. */
type Params = object;

/** URL dengan parameter saat ini + perubahan; nilai kosong dihapus. */
export function withParams(path: string, current: Params, patch: Params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (typeof v === 'string' && v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
