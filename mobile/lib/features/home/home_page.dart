import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/forms/form_schema.dart';
import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import '../../core/ui/skeleton.dart';
import '../reports/report_api.dart';
import '../reports/report_tile.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(authControllerProvider).valueOrNull;
    final schemas = ref.watch(formSchemasProvider);
    final recent = ref.watch(reportsProvider((status: null, q: '')));
    final att = ref.watch(myAttendanceProvider);
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final todays = (att.valueOrNull ?? []).where((a) => a['workDate'] == today).toList();
    final masuk = todays.where((a) => a['type'] == 'CHECK_IN').firstOrNull;
    final pulang = todays.where((a) => a['type'] == 'CHECK_OUT').firstOrNull;
    final desa = me?.villages.firstOrNull;
    final unread = ref.watch(unreadNotificationsProvider).valueOrNull ?? 0;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(myAttendanceProvider);
        ref.invalidate(reportsProvider);
        ref.invalidate(unreadNotificationsProvider);
        ref.invalidate(formSchemasProvider);
        await ref.read(myAttendanceProvider.future);
      },
      child: ListView(padding: EdgeInsets.zero, children: [
        Container(
          padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 18, 20, 24),
          decoration: const BoxDecoration(gradient: LinearGradient(colors: [brandDeep, brand], begin: Alignment.topLeft, end: Alignment.bottomRight)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Image.asset('assets/logo.png', height: 40),
              const SizedBox(width: 10),
              Expanded(child: Text(me?.unitNama ?? '', style: const TextStyle(color: Colors.white70, fontSize: 12), overflow: TextOverflow.ellipsis)),
              IconButton(
                tooltip: 'Notifikasi',
                onPressed: () async {
                  await context.push('/notifikasi');
                  ref.invalidate(unreadNotificationsProvider);
                },
                icon: Badge(
                  isLabelVisible: unread > 0, label: Text(unread > 99 ? '99+' : '$unread'),
                  child: const Icon(Icons.notifications_outlined, color: Colors.white),
                ),
              ),
            ]),
            const SizedBox(height: 16),
            Text('Selamat bertugas,', style: TextStyle(color: Colors.white.withValues(alpha: 0.8))),
            Text(me?.namaLengkap ?? '', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
            if (desa != null) ...[
              const SizedBox(height: 6),
              Row(children: [
                const Icon(Icons.place_outlined, size: 16, color: Colors.white70),
                const SizedBox(width: 4),
                Expanded(child: Text('Desa ${desa['nama']}, ${desa['kecamatan']}', style: const TextStyle(color: Colors.white70), overflow: TextOverflow.ellipsis)),
              ]),
            ],
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Card(
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => context.go('/absensi'),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    CircleAvatar(
                      backgroundColor: (masuk != null ? success : warn).withValues(alpha: 0.12),
                      child: Icon(masuk != null ? Icons.check_circle_rounded : Icons.schedule_rounded, color: masuk != null ? success : warn),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(masuk == null ? 'Belum absen masuk' : pulang == null ? 'Sudah absen masuk ${jam(masuk['clientTime'])}' : 'Absen lengkap hari ini',
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text(masuk == null ? 'Ketuk untuk absen dengan swafoto & GPS' : pulang == null ? 'Jangan lupa absen pulang' : 'Masuk ${jam(masuk['clientTime'])} · pulang ${jam(pulang['clientTime'])}',
                            style: const TextStyle(color: muted, fontSize: 12)),
                      ]),
                    ),
                    const Icon(Icons.chevron_right, color: muted),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Buat laporan', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 10),
            schemas.when(
              loading: () => GridView.count(
                crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.95,
                children: List.generate(6, (_) => const SkeletonBox(radius: 16, height: double.infinity)),
              ),
              error: (e, _) => _Retry(message: 'Formulir belum bisa dimuat. ${apiErrorMessage(e)}', onRetry: () => ref.invalidate(formSchemasProvider)),
              data: (list) => GridView.count(
                crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.95,
                children: [
                  for (final c in categories.where((c) => list.any((s) => s.category == c.key)))
                    Card(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => context.push('/lapor/${c.key}'),
                        child: Padding(
                          padding: const EdgeInsets.all(8),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            CircleAvatar(radius: 22, backgroundColor: c.color.withValues(alpha: 0.12), child: Icon(c.icon, color: c.color)),
                            const SizedBox(height: 8),
                            Text(c.label, textAlign: TextAlign.center, maxLines: 2, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ]),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(children: [
              const Expanded(child: Text('Laporan terbaru', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
              TextButton(onPressed: () => context.go('/laporan'), child: const Text('Semua')),
            ]),
            recent.when(
              loading: () => const SkeletonList(count: 3, padding: EdgeInsets.zero),
              error: (e, _) => _Retry(message: 'Laporan belum bisa dimuat. ${apiErrorMessage(e)}', onRetry: () => ref.invalidate(reportsProvider)),
              data: (list) => list.isEmpty
                  ? const Padding(padding: EdgeInsets.all(16), child: Text('Belum ada laporan.', style: TextStyle(color: muted)))
                  : Column(children: [for (final r in list.take(5)) Padding(padding: const EdgeInsets.only(bottom: 8), child: ReportTile(r))]),
            ),
            const SizedBox(height: 80),
          ]),
        ),
      ]),
    );
  }
}

/// Pesan galat yang ramah + tombol coba lagi (tanpa detail teknis).
class _Retry extends StatelessWidget {
  const _Retry({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            const Icon(Icons.cloud_off_outlined, color: muted),
            const SizedBox(width: 10),
            Expanded(child: Text(message, style: const TextStyle(fontSize: 13))),
            TextButton(onPressed: onRetry, child: const Text('Coba lagi')),
          ]),
        ),
      );
}
