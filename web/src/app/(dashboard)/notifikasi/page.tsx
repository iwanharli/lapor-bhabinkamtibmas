import { PageHeader } from '@/components/ui';
import { NotificationList } from '@/features/notifications/notification-list';

export default function NotifikasiPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifikasi" subtitle="Laporan prioritas dan laporan dengan lokasi perlu dicek di wilayah Anda" />
      <NotificationList />
    </div>
  );
}
