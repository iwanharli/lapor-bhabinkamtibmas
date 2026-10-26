import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/offline/cache.dart';
import 'report_api.dart';

const _uuid = Uuid();

/// Batas server: laporan ditolak bila dikirim lebih dari 3×24 jam setelah kegiatan.
const outboxDeadline = Duration(hours: 72);

/// Laporan yang sudah dikirim pengguna tetapi belum sampai ke server.
/// Langkah pengiriman (buat → unggah foto → kirim) aman diulang karena memakai clientUuid.
class OutboxItem {
  OutboxItem(this.j);
  final Map<String, dynamic> j;

  String get id => j['clientUuid'];
  String get nrp => j['nrp'];
  String get category => j['category'];
  String get villageName => j['villageName'] ?? '';
  DateTime get occurredAt => DateTime.parse(j['occurredAt']);
  String? get reportId => j['reportId'];
  List<Map<String, dynamic>> get photos => (j['photos'] as List).cast<Map<String, dynamic>>();
  /// Pesan penolakan server; laporan tidak dicoba lagi sampai diperbaiki atau dihapus.
  String? get error => j['error'];
  bool get failed => error != null;
  DateTime get deadline => occurredAt.add(outboxDeadline);
}

typedef OutboxState = ({List<OutboxItem> items, bool sending});

sealed class SendResult {}

class Sent extends SendResult {
  Sent(this.reportId);
  final String reportId;
}

class Queued extends SendResult {}

class Rejected extends SendResult {
  Rejected(this.errors);
  final List<String> errors;
}

final outboxProvider = NotifierProvider<Outbox, OutboxState>(Outbox.new);

/// Antrean laporan offline. Isian (bisa memuat NIK/No. KK) disimpan di penyimpanan terenkripsi;
/// foto disalin ke folder privat aplikasi sampai terkirim.
class Outbox extends Notifier<OutboxState> {
  static const _key = 'report_outbox';
  final _store = const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
  late final Future<void> _ready = _load();
  Future<void>? _flushing;
  /// clientUuid → id laporan yang sudah terkirim (untuk formulir yang menunggu flush otomatis selesai).
  final _sent = <String, String>{};

  @override
  OutboxState build() {
    _ready;
    return (items: <OutboxItem>[], sending: false);
  }

  /// Antrean milik pengguna yang sedang masuk.
  List<OutboxItem> mine(String? nrp) => state.items.where((i) => i.nrp == nrp).toList();

  Future<void> _load() async {
    try {
      final raw = await _store.read(key: _key);
      final list = raw == null ? const [] : jsonDecode(raw) as List;
      state = (items: list.map((e) => OutboxItem(Map<String, dynamic>.from(e as Map))).toList(), sending: state.sending);
    } catch (_) {
      // Data rusak: mulai dari antrean kosong daripada aplikasi macet.
    }
  }

  Future<void> _save(List<OutboxItem> items) async {
    state = (items: items, sending: state.sending);
    await _store.write(key: _key, value: jsonEncode(items.map((i) => i.j).toList()));
  }

  Future<void> _patch(String id, Map<String, dynamic> changes) =>
      _save([for (final i in state.items) i.id == id ? OutboxItem({...i.j, ...changes}) : i]);

  /// Simpan laporan ke antrean (menimpa entri dengan clientUuid sama bila dikirim ulang dari formulir).
  Future<void> add({
    required String clientUuid,
    required String nrp,
    required String category,
    required int schemaVersion,
    required String villageId,
    required String villageName,
    required Map<String, dynamic> data,
    required Map<String, dynamic> location,
    required Map<String, List<XFile>> files,
  }) async {
    await _ready;
    final dir = Directory('${(await getApplicationSupportDirectory()).path}/outbox/$clientUuid');
    await dir.create(recursive: true);
    final photos = <Map<String, dynamic>>[];
    for (final entry in files.entries) {
      for (final f in entry.value) {
        final photoUuid = _uuid.v4();
        final path = '${dir.path}/$photoUuid-${f.name}';
        await File(f.path).copy(path);
        photos.add({'fieldKey': entry.key, 'clientUuid': photoUuid, 'path': path, 'name': f.name,
            'capturedAt': (await f.lastModified()).toUtc().toIso8601String(), 'uploaded': false});
      }
    }
    final item = OutboxItem({
      'clientUuid': clientUuid, 'nrp': nrp, 'category': category, 'schemaVersion': schemaVersion,
      'villageId': villageId, 'villageName': villageName, 'occurredAt': DateTime.now().toUtc().toIso8601String(),
      'data': data, 'location': location, 'photos': photos, 'createdAt': DateTime.now().toUtc().toIso8601String(),
    });
    await _save([...state.items.where((i) => i.id != clientUuid), item]);
  }

  Future<void> remove(String id) async {
    await _ready;
    await _save(state.items.where((i) => i.id != id).toList());
    try {
      await Directory('${(await getApplicationSupportDirectory()).path}/outbox/$id').delete(recursive: true);
    } catch (_) {}
  }

  /// Coba lagi laporan yang ditolak (mis. setelah admin menetapkan desa binaan).
  Future<void> retry(String id) async {
    await _patch(id, {'error': null});
    await flush();
  }

  /// Kirim satu laporan sekarang (dipanggil formulir tepat setelah tombol Kirim).
  Future<SendResult> sendNow(String id) async {
    await _ready;
    await _flushing;
    final item = state.items.where((i) => i.id == id).firstOrNull;
    if (item == null) return _sent[id] != null ? Sent(_sent[id]!) : Queued();
    final res = await _send(item);
    if (res is Rejected) await remove(id); // formulir masih terbuka: pengguna memperbaiki di sana
    return res;
  }

  /// Kirim semua antrean milik pengguna yang masuk; berhenti di galat jaringan pertama.
  Future<void> flush() => _flushing ??= () async {
        try {
          await _ready;
          final nrp = ref.read(authControllerProvider).valueOrNull?.nrp;
          if (nrp == null) return;
          final pending = mine(nrp).where((i) => !i.failed).toList();
          if (pending.isEmpty) return;
          state = (items: state.items, sending: true);
          for (final item in pending) {
            if (await _send(item) is Queued) break;
          }
        } finally {
          state = (items: state.items, sending: false);
          _flushing = null;
        }
      }();

  Future<SendResult> _send(OutboxItem item) async {
    final dio = ref.read(dioProvider);
    var id = item.reportId;
    try {
      if (id == null) {
        final res = await dio.post('/reports', data: {
          'clientUuid': item.id, 'category': item.category, 'schemaVersion': item.j['schemaVersion'], 'villageId': item.j['villageId'],
          'occurredAt': item.j['occurredAt'], 'data': item.j['data'], ...Map<String, dynamic>.from(item.j['location'] as Map),
        });
        id = res.data['id'] as String;
        await _patch(item.id, {'reportId': id});
      }
      final photos = [for (final p in item.photos) Map<String, dynamic>.from(p)];
      for (final p in photos.where((p) => p['uploaded'] != true)) {
        final file = File(p['path'] as String);
        if (!await file.exists()) throw StateError('Foto ${p['name']} hilang dari perangkat');
        await dio.post('/reports/$id/attachments', data: FormData.fromMap({
          'fieldKey': p['fieldKey'], 'clientUuid': p['clientUuid'], 'source': 'CAMERA', 'capturedAt': p['capturedAt'],
          'file': await MultipartFile.fromFile(file.path, filename: p['name'] as String),
        }));
        p['uploaded'] = true;
        await _patch(item.id, {'photos': photos});
      }
      await dio.post('/reports/$id/submit');
      _sent[item.id] = id;
      await remove(item.id);
      ref.invalidate(reportsProvider);
      return Sent(id);
    } catch (e) {
      if (isNetworkError(e) || (e is DioException && e.response?.statusCode == 401)) {
        await _patch(item.id, {'lastAttempt': DateTime.now().toUtc().toIso8601String()});
        return Queued();
      }
      final errors = [
        e is StateError ? e.message : apiErrorMessage(e),
        if (e is DioException && e.response?.data is Map && e.response!.data['error']?['details'] is List)
          ...(e.response!.data['error']['details'] as List).map((x) => x.toString()),
      ];
      // Laporan sudah ada di server sebagai draft: tidak hilang walau dihapus dari antrean.
      if (id != null) errors.add('Laporan tersimpan sebagai draft. Kirim dari tab Draft setelah diperbaiki (mis. dari dalam desa binaan), lalu hapus dari antrean.');
      await _patch(item.id, {'error': errors.join('\n')});
      return Rejected(errors);
    }
  }
}

/// Pemicu kirim otomatis selama aplikasi terbuka: sinyal kembali, aplikasi dibuka lagi, berkala tiap 2 menit, dan saat login.
final outboxAutoSyncProvider = Provider<void>((ref) {
  final outbox = ref.read(outboxProvider.notifier);
  void flush() => unawaited(outbox.flush());
  final conn = Connectivity().onConnectivityChanged.listen((r) {
    if (!r.contains(ConnectivityResult.none)) flush();
  });
  final timer = Timer.periodic(const Duration(minutes: 2), (_) => flush());
  final life = AppLifecycleListener(onResume: flush);
  ref.listen(authControllerProvider.select((s) => s.valueOrNull?.nrp), (_, nrp) {
    if (nrp != null) flush();
  }, fireImmediately: true);
  ref.onDispose(() {
    conn.cancel();
    timer.cancel();
    life.dispose();
  });
});
