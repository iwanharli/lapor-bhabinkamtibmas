import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart';
import '../../core/location/location_service.dart';
import '../../core/location/tracking_banner.dart';
import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import '../../core/ui/skeleton.dart';
import '../reports/report_api.dart';

/// Absen masuk/pulang: swafoto kamera depan + GPS; riwayat 14 hari.
class AttendancePage extends ConsumerStatefulWidget {
  const AttendancePage({super.key});

  @override
  ConsumerState<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends ConsumerState<AttendancePage> {
  bool _busy = false;
  String? _stage;

  Future<void> _record(String type) async {
    setState(() {
      _busy = true;
      _stage = 'Membuka kamera depan…';
    });
    try {
      final selfie = await ImagePicker().pickImage(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front, maxWidth: 1280, imageQuality: 80);
      if (selfie == null) return;
      setState(() => _stage = 'Mencari lokasi GPS…');
      final fix = await getFix(wait: const Duration(seconds: 15));
      setState(() => _stage = 'Mengirim absen…');
      final res = await ref.read(dioProvider).post('/attendances', data: FormData.fromMap({
        'clientUuid': const Uuid().v4(), 'type': type, 'clientTime': DateTime.now().toUtc().toIso8601String(),
        'lat': fix.lat, 'lng': fix.lng, 'gpsAccuracyM': fix.accuracy, 'isMockLocation': fix.mocked,
        'selfie': await MultipartFile.fromFile(selfie.path, filename: 'swafoto.jpg'),
      }));
      ref.invalidate(myAttendanceProvider);
      if (!mounted) return;
      final r = res.data as Map;
      final outside = r['insideVillage'] == false;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        backgroundColor: outside ? warn : success,
        content: Text('${type == 'CHECK_IN' ? 'Absen masuk' : 'Absen pulang'} tercatat${outside ? ' — di luar desa binaan (${jarak(r['distanceM'] ?? 0)})' : ''}'),
      ));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: danger, content: Text(e is LocationException ? e.message : apiErrorMessage(e))));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _stage = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(myAttendanceProvider);
    final today = DateTime.now().toIso8601String().substring(0, 10);
    return Scaffold(
      appBar: AppBar(title: const Text('Absensi')),
      body: list.when(
        loading: () => const SkeletonDetail(),
        error: (e, _) => Center(child: Text(apiErrorMessage(e))),
        data: (rows) {
          final todays = rows.where((a) => a['workDate'] == today).toList();
          final masuk = todays.where((a) => a['type'] == 'CHECK_IN').firstOrNull;
          final pulang = todays.where((a) => a['type'] == 'CHECK_OUT').firstOrNull;
          final next = masuk == null ? 'CHECK_IN' : pulang == null ? 'CHECK_OUT' : null;
          final byDay = <String, List<Map<String, dynamic>>>{};
          for (final a in rows) {
            byDay.putIfAbsent(a['workDate'], () => []).add(a);
          }
          final days = byDay.keys.where((d) => d != today).toList()..sort((a, b) => b.compareTo(a));
          return RefreshIndicator(
            onRefresh: () => ref.refresh(myAttendanceProvider.future),
            child: ListView(padding: const EdgeInsets.all(16), children: [
              Text(tanggalPanjang(DateTime.now()), style: const TextStyle(color: muted)),
              const SizedBox(height: 10),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Row(children: [
                      Expanded(child: _Slot(label: 'Masuk', a: masuk)),
                      const SizedBox(width: 10),
                      Expanded(child: _Slot(label: 'Pulang', a: pulang)),
                    ]),
                    const SizedBox(height: 14),
                    if (next != null)
                      FilledButton.icon(
                        onPressed: _busy ? null : () => _record(next),
                        icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.camera_front_outlined),
                        label: Text(_busy ? (_stage ?? 'Memproses…') : next == 'CHECK_IN' ? 'Absen masuk' : 'Absen pulang'),
                      )
                    else
                      const Text('Absen hari ini lengkap. Terima kasih!', textAlign: TextAlign.center, style: TextStyle(color: success, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    const Text('Swafoto kamera depan & lokasi GPS dicek terhadap desa binaan. Lewat 08.00 tercatat terlambat. Selama jam dinas (masuk s.d. pulang) lokasi dipantau satuan.', textAlign: TextAlign.center, style: TextStyle(color: muted, fontSize: 12)),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              const TrackingBanner(),
              const SizedBox(height: 20),
              const Text('Riwayat', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              if (days.isEmpty) const Text('Belum ada riwayat.', style: TextStyle(color: muted)),
              for (final d in days.take(14))
                Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(tanggalPanjang(DateTime.parse(d)), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: Text([
                      for (final a in byDay[d]!..sort((a, b) => (a['type'] as String).compareTo(b['type'] as String)))
                        '${a['type'] == 'CHECK_IN' ? 'Masuk' : 'Pulang'} ${jam(a['clientTime'])}${a['insideVillage'] == false ? ' (luar desa)' : ''}',
                    ].join(' · ')),
                  ),
                ),
              const SizedBox(height: 80),
            ]),
          );
        },
      ),
    );
  }
}

class _Slot extends StatelessWidget {
  const _Slot({required this.label, required this.a});
  final String label;
  final Map<String, dynamic>? a;

  @override
  Widget build(BuildContext context) {
    final done = a != null;
    final outside = a?['insideVillage'] == false || a?['isMockLocation'] == true;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: (done ? (outside ? warn : success) : muted).withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: muted, fontSize: 12)),
        Text(done ? jam(a!['clientTime']) : '—', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        Text(!done ? 'belum' : outside ? 'lokasi perlu dicek' : 'di desa binaan', style: TextStyle(fontSize: 11, color: done ? (outside ? warn : success) : muted)),
      ]),
    );
  }
}
