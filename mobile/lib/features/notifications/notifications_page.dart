import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import '../../core/ui/skeleton.dart';
import '../reports/report_api.dart';

final _notificationsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.read(dioProvider).get('/notifications', queryParameters: {'limit': 50});
  return ((res.data as Map)['data'] as List).map((n) => Map<String, dynamic>.from(n)).toList();
});

const _meta = {
  'REPORT_PRIORITY': (Icons.local_fire_department, danger, 'Prioritas'),
  'REPORT_LOCATION': (Icons.wrong_location_outlined, warn, 'Lokasi'),
  'VILLAGES_UPDATED': (Icons.place_outlined, brand, 'Desa binaan'),
};

class NotificationsPage extends ConsumerWidget {
  const NotificationsPage({super.key});

  Future<void> _open(BuildContext context, WidgetRef ref, Map<String, dynamic> n) async {
    if (n['readAt'] == null) {
      try {
        await ref.read(dioProvider).post('/notifications/${n['id']}/read');
      } catch (_) {
        // Gagal menandai dibaca tidak menghalangi membuka laporannya.
      }
      ref.invalidate(_notificationsProvider);
      ref.invalidate(unreadNotificationsProvider);
    }
    // Tautan web Bhabin (/bhabin/laporan/:id) → layar detail aplikasi.
    final m = RegExp(r'/laporan/([0-9a-f-]{36})').firstMatch(n['link']?.toString() ?? '');
    if (m != null && context.mounted) context.push('/laporan/${m.group(1)}');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(_notificationsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Notifikasi'), actions: [
        TextButton(
          onPressed: () async {
            await ref.read(dioProvider).post('/notifications/read-all');
            ref.invalidate(_notificationsProvider);
            ref.invalidate(unreadNotificationsProvider);
          },
          child: const Text('Tandai semua dibaca'),
        ),
      ]),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(_notificationsProvider.future),
        child: list.when(
          loading: () => const SkeletonList(count: 6),
          error: (e, _) => ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(apiErrorMessage(e)))]),
          data: (items) => items.isEmpty
              ? ListView(children: const [Padding(padding: EdgeInsets.all(40), child: Center(child: Text('Belum ada notifikasi.', style: TextStyle(color: muted))))])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final n = items[i];
                    final (icon, color, label) = _meta[n['type']] ?? (Icons.notifications_outlined, muted, 'Info');
                    final unread = n['readAt'] == null;
                    return Card(
                      color: unread ? brand.withValues(alpha: 0.04) : null,
                      child: ListTile(
                        onTap: () => _open(context, ref, n),
                        leading: CircleAvatar(backgroundColor: color.withValues(alpha: 0.12), child: Icon(icon, color: color)),
                        title: Text(n['title'] ?? '', style: TextStyle(fontWeight: unread ? FontWeight.w700 : FontWeight.w500)),
                        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          if ((n['body'] ?? '') != '') Text(n['body'], maxLines: 2, overflow: TextOverflow.ellipsis),
                          const SizedBox(height: 2),
                          Text('$label · ${relatif(n['createdAt'])}', style: TextStyle(fontSize: 11, color: color)),
                        ]),
                        trailing: unread ? const CircleAvatar(radius: 5, backgroundColor: brand) : null,
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
