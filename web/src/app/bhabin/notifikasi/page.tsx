import { NotificationList } from '@/features/notifications/notification-list';

export default function NotifikasiBhabinPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Notifikasi</h1>
      <p className="mb-4 text-sm text-muted">Pemberitahuan untuk Anda.</p>
      <NotificationList />
    </>
  );
}
