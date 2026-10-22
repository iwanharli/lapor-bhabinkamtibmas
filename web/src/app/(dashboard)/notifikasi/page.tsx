import { PageHeader } from '@/components/ui';
import { NotificationList } from '@/features/notifications/notification-list';

export default function NotifikasiPage() {
  return (
    <>
      <PageHeader title="Notifikasi" subtitle="Laporan Deteksi Dini urgensi tinggi dan laporan dengan lokasi perlu dicek di wilayah Anda" />
      <div className="max-w-3xl"><NotificationList /></div>
    </>
  );
}
