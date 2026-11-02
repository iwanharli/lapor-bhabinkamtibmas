/** Tab peta batas di halaman desa, opsional langsung ke satu wilayah. */
export const boundaryHref = (kode?: string) => `/admin/desa?tab=peta-batas${kode ? `&kode=${kode}` : ''}`;
