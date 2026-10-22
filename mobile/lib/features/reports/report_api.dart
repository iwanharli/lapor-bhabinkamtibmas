import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/config.dart';
import '../../core/api/api_client.dart';
import '../../core/ui/theme.dart';

/// Ringkasan laporan dari GET /reports.
class ReportItem {
  ReportItem(this.j);
  final Map<String, dynamic> j;
  String get id => j['id'];
  String get nomor => j['nomor'];
  String get category => j['category'];
  String get status => j['status'];
  bool get draft => status == 'DRAFT';
  bool get priority => j['priority'] == true;
  String get occurredAt => j['occurredAt'];
  String get desa => (j['village'] as Map)['nama'];
  bool get flagged => j['isMockLocation'] == true || j['insideVillage'] == false;
  int get attachments => ((j['_count'] as Map?)?['attachments'] as int?) ?? 0;
}

/// Filter daftar: status (null/SUBMITTED/DRAFT) & kata kunci.
typedef ReportQuery = ({String? status, String q});

final reportsProvider = FutureProvider.autoDispose.family<List<ReportItem>, ReportQuery>((ref, q) async {
  final res = await ref.read(dioProvider).get('/reports', queryParameters: {
    'limit': 50,
    if (q.status != null) 'status': q.status,
    if (q.q.trim().isNotEmpty) 'q': q.q.trim(),
  });
  return ((res.data as Map)['data'] as List).map((r) => ReportItem(Map<String, dynamic>.from(r))).toList();
});

final reportDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) async {
  final res = await ref.read(dioProvider).get('/reports/$id');
  return Map<String, dynamic>.from(res.data);
});

final myAttendanceProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.read(dioProvider).get('/attendances/me');
  return (res.data as List).map((a) => Map<String, dynamic>.from(a)).toList();
});

/// Header Authorization untuk gambar terproteksi (lampiran & swafoto).
final authHeaderProvider = FutureProvider<Map<String, String>>((ref) async {
  final token = await ref.read(tokenStorageProvider).accessToken;
  return {if (token != null) 'Authorization': 'Bearer $token'};
});

String attachmentUrl(String id, {bool thumb = false}) => '$apiUrl/attachments/$id/file${thumb ? '?thumb=1' : ''}';

/// Lencana status laporan.
Widget statusChip(ReportItem r) {
  final (label, color) = r.draft ? ('Draft', muted) : ('Terkirim', success);
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(99)),
    child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
  );
}

/// Gambar dari API yang butuh token.
class AuthImage extends ConsumerWidget {
  const AuthImage(this.url, {super.key, this.fit = BoxFit.cover});
  final String url;
  final BoxFit fit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final headers = ref.watch(authHeaderProvider).valueOrNull;
    if (headers == null) return const ColoredBox(color: line);
    return Image.network(url, headers: headers, fit: fit, errorBuilder: (_, __, ___) => const ColoredBox(color: line, child: Icon(Icons.broken_image_outlined, color: muted)));
  }
}
