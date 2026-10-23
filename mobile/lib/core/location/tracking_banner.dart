import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../ui/theme.dart';
import 'tracker.dart';

/// Status pelacakan jam dinas; tampil hanya saat aktif atau bermasalah.
class TrackingBanner extends ConsumerWidget {
  const TrackingBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(trackerProvider);
    if (s == TrackStatus.off) return const SizedBox.shrink();
    final ok = s == TrackStatus.active;
    final (icon, title, text) = switch (s) {
      TrackStatus.active => (Icons.my_location, 'Posisi jam dinas aktif', 'Posisi terkini terlihat oleh satuan sampai absen pulang. Riwayat perjalanan tidak disimpan.'),
      TrackStatus.gpsOff => (Icons.location_disabled, 'GPS mati', 'Nyalakan lokasi agar posisi jam dinas terkirim.'),
      _ => (Icons.location_off, 'Izin lokasi diperlukan', 'Izinkan lokasi "Sepanjang waktu" agar tetap berjalan saat layar terkunci.'),
    };
    final c = ok ? success : warn;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.1), border: Border.all(color: c.withValues(alpha: 0.35)), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Icon(icon, color: c, size: 22),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(fontWeight: FontWeight.w700, color: c, fontSize: 13)),
            const SizedBox(height: 2),
            Text(text, style: const TextStyle(color: muted, fontSize: 11.5)),
          ]),
        ),
        if (!ok)
          TextButton(
            onPressed: () async {
              s == TrackStatus.gpsOff ? await Geolocator.openLocationSettings() : await Geolocator.openAppSettings();
              await ref.read(trackerProvider.notifier).retry();
            },
            child: const Text('Atur'),
          ),
      ]),
    );
  }
}
