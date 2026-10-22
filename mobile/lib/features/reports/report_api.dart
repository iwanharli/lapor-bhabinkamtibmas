import 'package:dio/dio.dart';
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

/// Beberapa laporan terbaru (beranda).
final reportsProvider = FutureProvider.autoDispose.family<List<ReportItem>, ReportQuery>((ref, q) async {
  return (await fetchReports(ref.read(dioProvider), ReportFilter(status: q.status, q: q.q), page: 1, limit: 10)).items;
});

/// Filter lengkap Laporan saya (selaras web): status, kategori, periode (hari), prioritas, kata kunci.
class ReportFilter {
  const ReportFilter({this.status, this.category, this.days, this.priority = false, this.q = ''});
  final String? status;
  final String? category;
  final int? days;
  final bool priority;
  final String q;

  ReportFilter copyWith({Object? status = _keep, Object? category = _keep, Object? days = _keep, bool? priority, String? q}) => ReportFilter(
        status: status == _keep ? this.status : status as String?,
        category: category == _keep ? this.category : category as String?,
        days: days == _keep ? this.days : days as int?,
        priority: priority ?? this.priority,
        q: q ?? this.q,
      );
  bool get active => category != null || days != null || priority || q.trim().isNotEmpty;
}

const _keep = Object();

Future<({List<ReportItem> items, int total})> fetchReports(Dio dio, ReportFilter f, {required int page, int limit = 20}) async {
  final res = await dio.get('/reports', queryParameters: {
    'limit': limit, 'page': page,
    if (f.status != null) 'status': f.status,
    if (f.category != null) 'category': f.category,
    if (f.priority) 'priority': 'true',
    if (f.days != null) 'from': DateTime.now().subtract(Duration(days: f.days! - 1)).copyWith(hour: 0, minute: 0, second: 0).toUtc().toIso8601String(),
    if (f.q.trim().isNotEmpty) 'q': f.q.trim(),
  });
  final body = res.data as Map;
  return (
    items: (body['data'] as List).map((r) => ReportItem(Map<String, dynamic>.from(r))).toList(),
    total: (body['meta'] as Map)['total'] as int,
  );
}

/// Jumlah notifikasi belum dibaca (lonceng beranda).
final unreadNotificationsProvider = FutureProvider.autoDispose<int>((ref) async {
  final res = await ref.read(dioProvider).get('/notifications/unread-count');
  final d = res.data;
  return d is Map ? (d['unread'] ?? d['count'] ?? 0) as int : (d as num).toInt();
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
