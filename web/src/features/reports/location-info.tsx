import { CircleAlert, CircleCheck, Crosshair, MapPin, ServerCog } from 'lucide-react';
import { cn } from '@/components/ui';
import { MapFrame } from './map-frame';
import { tanggalJam, jarak } from '@/lib/format';
import type { ReportDetail } from '@/lib/types';

function Check({ ok, icon, label, value }: { ok?: boolean; icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3 text-sm">
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', ok === false ? 'bg-warn-soft text-warn' : ok ? 'bg-success-soft text-success' : 'bg-bg text-muted')}>
        {icon}
      </span>
      <span className="flex-1 whitespace-nowrap text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </li>
  );
}

/** Peta titik laporan + pemeriksaan bukti lokasi. Peta memakai OpenStreetMap (butuh internet; tautan tetap tersedia). */
export function LocationInfo({ report: r }: { report: ReportDetail }) {
  const mapUrl = `https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`;
  const accurate = r.gpsAccuracyM != null && r.gpsAccuracyM <= 50;

  return (
    <div>
      <MapFrame lat={r.lat} lng={r.lng} mapUrl={mapUrl} />
      <ul className="divide-y divide-line">
        <Check icon={<MapPin size={16} />} label="Koordinat" value={<span className="font-mono text-xs">{r.lat.toFixed(5)}, {r.lng.toFixed(5)}</span>} />
        <Check ok={accurate} icon={<Crosshair size={16} />} label="Akurasi GPS" value={r.gpsAccuracyM != null ? `±${Math.round(r.gpsAccuracyM)} m` : '—'} />
        <Check
          ok={r.insideVillage ?? undefined}
          icon={r.insideVillage === false ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
          label="Desa binaan"
          value={r.insideVillage == null ? '—' : r.insideVillage ? <span className="text-success">Di dalam</span> : <span className="text-warn">Di luar{r.distanceM != null ? ` · ±${jarak(r.distanceM)} dari batas` : ''}</span>}
        />
        <Check
          ok={!r.isMockLocation}
          icon={r.isMockLocation ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
          label="Lokasi palsu"
          value={r.isMockLocation ? <span className="text-danger">Terdeteksi</span> : 'Tidak terdeteksi'}
        />
        <Check icon={<ServerCog size={16} />} label="Diterima" value={tanggalJam(r.receivedAt, r.unit.timezone)} />
      </ul>
    </div>
  );
}
