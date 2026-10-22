export interface AppNotification {
  id: string;
  type: 'REPORT_PRIORITY' | 'REPORT_LOCATION' | 'VILLAGES_UPDATED' | string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  data: AppNotification[];
  meta: { page: number; limit: number; total: number };
  unread: number;
}
