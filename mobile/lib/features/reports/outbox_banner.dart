import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import 'outbox.dart';

/// Kartu antrean offline (beranda & Laporan saya): jumlah laporan menunggu sinyal, yang ditolak, dan tombol kirim sekarang.
class OutboxBanner extends ConsumerWidget {
  const OutboxBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nrp = ref.watch(authControllerProvider).valueOrNull?.nrp;
    final state = ref.watch(outboxProvider);
    final items = ref.read(outboxProvider.notifier).mine(nrp);
    if (items.isEmpty) return const SizedBox.shrink();
    final failed = items.where((i) => i.failed).length;
    final waiting = items.length - failed;
    final urgent = items.any((i) => !i.failed && i.deadline.difference(DateTime.now()) < const Duration(hours: 12));
    final color = failed > 0 || urgent ? danger : warn;

    return Card(
      color: color.withValues(alpha: 0.08),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: color.withValues(alpha: 0.35))),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showList(context),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
          child: Row(children: [
            CircleAvatar(
              radius: 20, backgroundColor: color.withValues(alpha: 0.15),
              child: state.sending
                  ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: color))
                  : Icon(failed > 0 ? Icons.error_outline : Icons.cloud_upload_outlined, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  [if (waiting > 0) '$waiting laporan menunggu dikirim', if (failed > 0) '$failed laporan ditolak'].join(' · '),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  state.sending ? 'Mengirim…' : failed > 0 ? 'Ketuk untuk melihat alasannya' : urgent ? 'Segera cari sinyal: batas kirim 3×24 jam' : 'Dikirim otomatis saat ada sinyal',
                  style: const TextStyle(fontSize: 12, color: muted),
                ),
              ]),
            ),
            if (waiting > 0)
              TextButton(onPressed: state.sending ? null : () => ref.read(outboxProvider.notifier).flush(), child: const Text('Kirim')),
          ]),
        ),
      ),
    );
  }

  void _showList(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _OutboxSheet(),
    );
  }
}

class _OutboxSheet extends ConsumerWidget {
  const _OutboxSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nrp = ref.watch(authControllerProvider).valueOrNull?.nrp;
    ref.watch(outboxProvider);
    final outbox = ref.read(outboxProvider.notifier);
    final items = outbox.mine(nrp);
    if (items.isEmpty) {
      return const SafeArea(child: Padding(padding: EdgeInsets.all(24), child: Text('Antrean kosong. Semua laporan sudah terkirim.')));
    }
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.7),
        child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), children: [
          const Text('Antrean laporan', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 4),
          const Text('Laporan tersimpan di perangkat ini sampai terkirim. Jangan hapus aplikasi atau datanya.', style: TextStyle(fontSize: 12, color: muted)),
          const SizedBox(height: 12),
          for (final i in items)
            Card(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(categoryOf(i.category).icon, color: categoryOf(i.category).color),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${categoryOf(i.category).label} · ${i.villageName}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text('${tanggalJam(i.occurredAt.toIso8601String())} · ${i.photos.length} foto', style: const TextStyle(fontSize: 12, color: muted)),
                      const SizedBox(height: 4),
                      Text(
                        i.failed ? 'Ditolak server: ${i.error}' : 'Kirim sebelum ${tanggalJam(i.deadline.toIso8601String())}',
                        style: TextStyle(fontSize: 12, color: i.failed ? danger : muted),
                      ),
                    ]),
                  ),
                  PopupMenuButton<String>(
                    onSelected: (v) async {
                      if (v == 'retry') return outbox.retry(i.id);
                      final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
                        title: const Text('Hapus laporan dari antrean?'),
                        content: const Text('Laporan ini belum terkirim dan akan hilang permanen.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
                          FilledButton(style: FilledButton.styleFrom(backgroundColor: danger), onPressed: () => Navigator.pop(ctx, true), child: const Text('Hapus')),
                        ],
                      ));
                      if (ok == true) await outbox.remove(i.id);
                    },
                    itemBuilder: (_) => [
                      if (i.failed) const PopupMenuItem(value: 'retry', child: Text('Coba kirim lagi')),
                      const PopupMenuItem(value: 'delete', child: Text('Hapus dari antrean', style: TextStyle(color: danger))),
                    ],
                  ),
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}
