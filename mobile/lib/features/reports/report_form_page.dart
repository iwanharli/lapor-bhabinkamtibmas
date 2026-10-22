import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/forms/form_schema.dart';
import '../../core/location/location_service.dart';
import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import 'report_api.dart';

typedef FormRow = Map<String, dynamic>;

final _phone = RegExp(r'^(\+?62|0)8\d{7,12}$');
const _uuid = Uuid();

/// Isian balita (< 5 th) yang disembunyikan & diisi otomatis — selaras web.
const _balitaDefaults = {'status_perkawinan': 'Belum Kawin', 'pendidikan': 'Tidak/Belum Sekolah', 'pekerjaan': 'Belum/Tidak Bekerja', 'pekerjaan_ket': '', 'no_hp': ''};
bool _isBalita(FormRow r) => (ageYears(r['tanggal_lahir']) ?? 99) < 5;

/// Formulir laporan dari skema JSON: laporan baru, lanjutkan draft, atau ralat (≤ 3×24 jam).
class ReportFormPage extends ConsumerStatefulWidget {
  const ReportFormPage({super.key, required this.category, this.reportId});
  final String category;
  final String? reportId;

  @override
  ConsumerState<ReportFormPage> createState() => _ReportFormPageState();
}

class _ReportFormPageState extends ConsumerState<ReportFormPage> {
  FormSchema? _schema;
  Map<String, dynamic>? _report;
  List<Map<String, dynamic>> _commodities = [];
  String? _loadError;

  final Map<String, dynamic> _values = {};
  final Map<String, List<XFile>> _files = {};
  final Map<String, int> _existing = {};
  Set<String> _saved = {};
  final String _clientUuid = _uuid.v4();
  int _step = 0;
  bool _busy = false;

  Fix? _fix;
  bool _locating = false;
  String? _locError;
  /// Jarak (m) titik GPS ke batas desa binaan bila di luar toleransi 200 m.
  num? _outsideM;

  bool get _ralat => _report?['status'] == 'SUBMITTED';
  List<FormStep> get _steps => _schema!.steps ?? [FormStep.fromJson({'title': _schema!.title, 'fields': _schema!.fields.map((f) => f.key).toList()})];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final dio = ref.read(dioProvider);
      Map<String, dynamic>? report;
      if (widget.reportId != null) report = Map<String, dynamic>.from((await dio.get('/reports/${widget.reportId}')).data);
      final schema = report != null
          ? await ref.read(schemaVersionProvider((widget.category, report['schemaVersion'] as int?)).future)
          : (await ref.read(formSchemasProvider.future)).where((s) => s.category == widget.category).firstOrNull;
      if (schema == null) throw Exception('Formulir tidak tersedia');
      final needsCommodities = schema.fields.any((f) => f.fields?.any((s) => s.source == 'commodities') ?? false);
      final commodities = needsCommodities ? await ref.read(commoditiesProvider.future) : <Map<String, dynamic>>[];
      setState(() {
        _schema = schema;
        _report = report;
        _commodities = commodities;
        if (report != null) {
          final data = Map<String, dynamic>.from(report['data'] as Map);
          for (final f in schema.fields) {
            final v = data[f.key];
            if (v == null) continue;
            if (f.type == 'repeater') {
              _values[f.key] = (v as List).map((r) => Map<String, dynamic>.from(r as Map).map((k, x) => MapEntry(k, x?.toString() ?? ''))).toList();
            } else if (f.type == 'multiselect') {
              _values[f.key] = (v as List).map((e) => e.toString()).toList();
            } else {
              _values[f.key] = v.toString();
            }
          }
          _saved = ((report['sensitiveFilled'] as List?) ?? []).cast<String>().toSet();
          for (final a in (report['attachments'] as List? ?? [])) {
            final k = (a as Map)['fieldKey'] as String;
            _existing[k] = (_existing[k] ?? 0) + 1;
          }
        }
      });
      if (!_ralat) _locate();
    } catch (e) {
      setState(() => _loadError = apiErrorMessage(e) == 'Terjadi kesalahan' ? e.toString() : apiErrorMessage(e));
    }
  }

  Future<void> _locate() async {
    setState(() {
      _locating = true;
      _locError = null;
    });
    try {
      final f = await getFix();
      if (mounted) setState(() => _fix = f);
      await _checkDistance(f);
    } catch (e) {
      if (mounted) setState(() => _locError = e.toString());
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _checkDistance(Fix f) async {
    final villageId = _report?['village']?['id'] ?? ref.read(authControllerProvider).valueOrNull?.villages.firstOrNull?['id'];
    if (villageId == null) return;
    try {
      final res = await ref.read(dioProvider).get('/villages/$villageId/distance', queryParameters: {'lat': f.lat, 'lng': f.lng});
      final d = res.data as Map;
      if (mounted) setState(() => _outsideM = d['insideVillage'] == false ? d['distanceM'] as num? : null);
    } catch (_) {
      // Cek jarak hanya informasi; laporan tetap bisa dikirim.
    }
  }

  // ---------- validasi & pengiriman ----------

  bool _empty(Object? v) => v == null || (v is String && v.trim().isEmpty) || (v is List && v.isEmpty);
  bool _rowFilled(FormRow r) => r.entries.any((e) => e.key != '_id' && !_empty(e.value));

  List<String> _errorsFor(List<SchemaField> fields) {
    final errs = <String>[];
    for (final f in fields) {
      if (!f.active(_values)) continue;
      final req = f.isRequired(_values);
      if (f.isMedia) {
        final n = (_files[f.key]?.length ?? 0) + (_existing[f.key] ?? 0);
        if (req && n == 0) errs.add('${f.label} wajib diisi.');
        continue;
      }
      if (f.type == 'repeater') {
        final rows = ((_values[f.key] as List?) ?? []).cast<FormRow>().where(_rowFilled).toList();
        if (req && rows.isEmpty) errs.add('${f.label} wajib diisi.');
        for (var i = 0; i < rows.length; i++) {
          for (final s in f.fields ?? const <SchemaField>[]) {
            if (!s.active(rows[i]) || (_isBalita(rows[i]) && _balitaDefaults.containsKey(s.key))) continue;
            final v = rows[i][s.key];
            if (_empty(v)) {
              if (s.isRequired(rows[i]) && !(s.sensitive && _saved.contains(f.key))) errs.add('${f.label} ${i + 1} — ${s.label} wajib diisi.');
            } else if (s.type == 'nik' && !RegExp(r'^\d{16}$').hasMatch(v)) {
              errs.add('${f.label} ${i + 1} — ${s.label} harus 16 digit.');
            } else if (s.type == 'phone' && !_phone.hasMatch(v)) {
              errs.add('${f.label} ${i + 1} — ${s.label} tidak valid.');
            }
          }
        }
        continue;
      }
      final v = _values[f.key];
      if (_empty(v)) {
        if (req && !(f.sensitive && _saved.contains(f.key))) errs.add('${f.label} wajib diisi.');
      } else if (f.type == 'nik' && !RegExp(r'^\d{16}$').hasMatch(v)) {
        errs.add('${f.label} harus 16 digit angka.');
      } else if (f.type == 'phone' && !_phone.hasMatch(v)) {
        errs.add('${f.label} tidak valid (mis. 0812xxxxxxxx).');
      }
    }
    return errs;
  }

  List<SchemaField> _stepFields(int i) => _steps[i].fields.map((k) => _schema!.field(k)).whereType<SchemaField>().toList();

  /// Isian untuk API: angka sebagai number, kosong dibuang, rahasia kosong = nilai lama tetap.
  Map<String, dynamic> _cleanData() {
    num? numOf(String v) => num.tryParse(v.replaceAll('.', '').replaceAll(',', '.'));
    final out = <String, dynamic>{};
    for (final f in _schema!.fields) {
      if (f.isMedia || !f.active(_values)) continue;
      final v = _values[f.key];
      if (_empty(v)) continue;
      if (f.type == 'repeater') {
        out[f.key] = (v as List).cast<FormRow>().where(_rowFilled).map((row) {
          final r = Map<String, dynamic>.from(row);
          if (_isBalita(r)) r.addAll(_balitaDefaults);
          return {
            if (r['_id'] != null) '_id': r['_id'],
            for (final s in f.fields ?? const <SchemaField>[])
              if (!_empty(r[s.key]) && s.active(r))
                s.key: (s.type == 'number' || s.type == 'currency' || s.source == 'commodities') ? numOf(r[s.key]) : r[s.key],
          };
        }).toList();
      } else if (f.type == 'number' || f.type == 'currency') {
        out[f.key] = numOf(v);
      } else {
        out[f.key] = v is String ? v.trim() : v;
      }
    }
    return out;
  }

  Future<void> _save({required bool send}) async {
    final errs = send || _ralat ? _errorsFor(_schema!.fields) : <String>[];
    final villageId = _report?['village']?['id'] ?? ref.read(authControllerProvider).valueOrNull?.villages.firstOrNull?['id'];
    if (villageId == null) errs.insert(0, 'Anda belum punya desa binaan. Hubungi admin satuan.');
    if (_report == null && _fix == null) errs.insert(0, 'Lokasi GPS belum didapat. Tekan "Ambil lokasi".');
    if (errs.isNotEmpty) return _showErrors(errs);

    setState(() => _busy = true);
    final dio = ref.read(dioProvider);
    try {
      final loc = _fix == null ? <String, dynamic>{} : {'location': {'lat': _fix!.lat, 'lng': _fix!.lng}, 'gpsAccuracyM': _fix!.accuracy, 'isMockLocation': _fix!.mocked};
      final data = _cleanData();
      final Map saved = _report == null
          ? (await dio.post('/reports', data: {
              'clientUuid': _clientUuid, 'category': _schema!.category, 'schemaVersion': _schema!.version, 'villageId': villageId,
              'occurredAt': DateTime.now().toUtc().toIso8601String(), 'data': data, ...loc,
            })).data
          : (await dio.patch('/reports/${_report!['id']}', data: {'data': data, ...loc})).data;
      final id = saved['id'] as String;
      for (final entry in _files.entries) {
        for (final file in entry.value) {
          await dio.post('/reports/$id/attachments', data: FormData.fromMap({
            'fieldKey': entry.key, 'clientUuid': _uuid.v4(), 'source': 'CAMERA',
            'capturedAt': (await file.lastModified()).toUtc().toIso8601String(),
            'file': await MultipartFile.fromFile(file.path, filename: file.name),
          }));
        }
      }
      if (send && !_ralat) await dio.post('/reports/$id/submit');
      ref.invalidate(reportsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_ralat ? 'Ralat tersimpan' : send ? 'Laporan terkirim' : 'Draft tersimpan')));
      context.pushReplacement('/laporan/$id');
    } catch (e) {
      _showErrors([apiErrorMessage(e), if (e is DioException && e.response?.data is Map && (e.response!.data['error']?['details'] is List)) ...(e.response!.data['error']['details'] as List).map((x) => x.toString())]);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showErrors(List<String> errs) {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Row(children: [Icon(Icons.error_outline, color: danger), SizedBox(width: 8), Text('Periksa isian', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16))]),
            const SizedBox(height: 10),
            for (final e in errs.take(8)) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('• $e')),
            if (errs.length > 8) Text('… dan ${errs.length - 8} lainnya', style: const TextStyle(color: muted)),
          ]),
        ),
      ),
    );
  }

  void _next() {
    final errs = _errorsFor(_stepFields(_step));
    if (errs.isNotEmpty) return _showErrors(errs);
    setState(() => _step++);
  }

  // ---------- tampilan ----------

  @override
  Widget build(BuildContext context) {
    final cat = categoryOf(widget.category);
    if (_loadError != null) return Scaffold(appBar: AppBar(title: Text(cat.label)), body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_loadError!))));
    if (_schema == null) return Scaffold(appBar: AppBar(title: Text(cat.label)), body: const Center(child: CircularProgressIndicator()));
    final steps = _steps;
    final last = _step == steps.length - 1;
    final me = ref.watch(authControllerProvider).valueOrNull;
    final desa = _report?['village'] ?? me?.villages.firstOrNull;

    return PopScope(
      canPop: _step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _step--);
      },
      child: Scaffold(
        appBar: AppBar(title: Text(_ralat ? 'Ralat · ${cat.label}' : cat.label)),
        body: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 120), children: [
          if (steps.length > 1) _Stepper(steps: steps, current: _step),
          if (_step == 0) ...[
            Card(
              child: Column(children: [
                ListTile(
                  leading: const Icon(Icons.place_outlined), dense: true,
                  title: Text(desa == null ? 'Belum ada desa binaan' : 'Desa ${desa['nama']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: const Text('Desa binaan (terkunci)'), trailing: const Icon(Icons.lock_outline, size: 16, color: muted),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(_fix != null ? Icons.gps_fixed : Icons.gps_not_fixed, color: _fix != null ? success : _locError != null ? danger : muted), dense: true,
                  title: Text(_locating ? 'Mencari lokasi GPS…' : _fix != null ? 'Lokasi didapat · ±${_fix!.accuracy.round()} m' : _ralat ? 'Memakai lokasi laporan' : (_locError ?? 'Lokasi belum diambil'),
                      style: TextStyle(color: _locError != null && _fix == null ? danger : null)),
                  subtitle: _fix != null ? Text('${_fix!.lat.toStringAsFixed(5)}, ${_fix!.lng.toStringAsFixed(5)}${_fix!.mocked ? ' · lokasi palsu terdeteksi!' : ''}') : null,
                  trailing: _locating ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : TextButton(onPressed: _locate, child: Text(_fix != null ? 'Ulangi' : 'Ambil lokasi')),
                ),
                if (_outsideM != null && desa != null)
                  Container(
                    margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: warn.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Icon(Icons.warning_amber_rounded, color: warn, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text('Titik GPS ±${jarak(_outsideM!)} dari batas desa ${desa['nama']} (toleransi 200 m). Laporan tetap bisa dikirim; pimpinan diberi tahu untuk mengecek lokasinya.',
                          style: const TextStyle(fontSize: 12))),
                    ]),
                  ),
              ]),
            ),
            const SizedBox(height: 12),
          ],
          if (steps[_step].description != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(steps[_step].description!, style: const TextStyle(color: muted, fontSize: 12))),
          for (final f in _stepFields(_step).where((f) => f.active(_values))) Padding(padding: const EdgeInsets.only(bottom: 14), child: _field(f)),
        ]),
        bottomSheet: Container(
          color: surface,
          padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.of(context).padding.bottom),
          child: Row(children: [
            if (_step > 0) ...[
              Expanded(child: OutlinedButton(onPressed: _busy ? null : () => setState(() => _step--), child: const Text('Kembali'))),
              const SizedBox(width: 10),
            ] else if (!_ralat) ...[
              Expanded(child: OutlinedButton(onPressed: _busy ? null : () => _save(send: false), child: const Text('Simpan draft'))),
              const SizedBox(width: 10),
            ],
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: _busy ? null : last ? () => _save(send: true) : _next,
                child: Text(_busy ? 'Menyimpan…' : !last ? 'Lanjut' : _ralat ? 'Simpan ralat' : 'Kirim laporan'),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  String _label(SchemaField f, bool req) => '${f.label}${req ? ' *' : ''}';

  Widget _field(SchemaField f) {
    final req = f.isRequired(_values);
    final keep = f.sensitive && _saved.contains(f.key);
    switch (f.type) {
      case 'photo':
      case 'file':
        return _MediaField(
          label: _label(f, req), files: _files[f.key] ?? [], existing: _existing[f.key] ?? 0, max: (f.max ?? 3).toInt(), photo: f.type == 'photo',
          onChanged: (l) => setState(() => _files[f.key] = l),
        );
      case 'repeater':
        return _RepeaterField(
          field: f, rows: ((_values[f.key] as List?) ?? []).cast<FormRow>(), commodities: _commodities, keep: _saved.contains(f.key),
          onChanged: (rows) => setState(() => _values[f.key] = rows),
        );
      default:
        return _ScalarInput(
          field: f, value: _values[f.key], label: _label(f, req && !keep), keep: keep, commodities: _commodities,
          onChanged: (v) => setState(() => _values[f.key] = v),
        );
    }
  }
}

/// Penanda langkah formulir bertahap.
class _Stepper extends StatelessWidget {
  const _Stepper({required this.steps, required this.current});
  final List<FormStep> steps;
  final int current;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          for (var i = 0; i < steps.length; i++)
            Expanded(child: Container(height: 5, margin: const EdgeInsets.symmetric(horizontal: 2), decoration: BoxDecoration(color: i <= current ? brand : line, borderRadius: BorderRadius.circular(9)))),
        ]),
        const SizedBox(height: 8),
        Text('Langkah ${current + 1} dari ${steps.length}', style: const TextStyle(color: muted, fontSize: 12)),
        Text(steps[current].title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
      ]),
    );
  }
}

/// Satu isian non-repeater: teks, angka, rupiah, tanggal, pilihan, pilihan ganda, NIK, nomor HP.
class _ScalarInput extends StatelessWidget {
  const _ScalarInput({super.key, required this.field, required this.value, required this.label, required this.onChanged, this.keep = false, this.commodities = const []});
  final SchemaField field;
  final Object? value;
  final String label;
  final ValueChanged<Object?> onChanged;
  final bool keep;
  final List<Map<String, dynamic>> commodities;

  @override
  Widget build(BuildContext context) {
    final f = field;
    final hint = f.sensitive ? (keep ? '🔒 Tersimpan (terenkripsi). Biarkan kosong bila tidak diubah.' : '🔒 Disimpan terenkripsi.') : f.hint;
    final deco = InputDecoration(labelText: label, helperText: hint, helperMaxLines: 3, hintText: f.placeholder);
    switch (f.type) {
      case 'select':
        final opts = f.source == 'commodities'
            ? commodities.map((c) => (c['id'].toString(), c['nama'] as String)).toList()
            : (f.options ?? []).map((o) => (o, o)).toList();
        final v = value?.toString();
        return DropdownButtonFormField<String>(
          isExpanded: true,
          initialValue: opts.any((o) => o.$1 == v) ? v : null,
          decoration: deco.copyWith(hintText: keep ? 'Tersimpan, tidak diubah' : 'Pilih'),
          items: [for (final o in opts) DropdownMenuItem(value: o.$1, child: Text(o.$2, overflow: TextOverflow.ellipsis))],
          onChanged: onChanged,
        );
      case 'multiselect':
        final sel = (value as List?)?.cast<String>() ?? <String>[];
        return InputDecorator(
          decoration: deco,
          child: Wrap(spacing: 6, runSpacing: 6, children: [
            for (final o in f.options ?? const <String>[])
              FilterChip(label: Text(o), selected: sel.contains(o), onSelected: (on) => onChanged(on ? [...sel, o] : sel.where((x) => x != o).toList())),
          ]),
        );
      case 'date':
        final v = value?.toString();
        return InkWell(
          onTap: () async {
            final now = DateTime.now();
            final d = await showDatePicker(context: context, firstDate: DateTime(1900), lastDate: now, initialDate: v != null && v.isNotEmpty ? DateTime.parse(v) : now);
            if (d != null) onChanged(DateFormat('yyyy-MM-dd').format(d));
          },
          child: InputDecorator(decoration: deco.copyWith(suffixIcon: const Icon(Icons.calendar_today_outlined)), child: Text(v == null || v.isEmpty ? 'Pilih tanggal' : displayValue(v))),
        );
      default:
        final type = f.type;
        return TextFormField(
          key: ValueKey(f.key),
          initialValue: value?.toString(),
          maxLines: type == 'textarea' ? 4 : 1,
          maxLength: type == 'nik' ? 16 : f.maxLength,
          keyboardType: switch (type) {
            'number' || 'currency' => const TextInputType.numberWithOptions(decimal: true),
            'nik' => TextInputType.number,
            'phone' => TextInputType.phone,
            'textarea' => TextInputType.multiline,
            _ => TextInputType.text,
          },
          inputFormatters: [if (type == 'nik') FilteringTextInputFormatter.digitsOnly, if (type == 'phone') FilteringTextInputFormatter.allow(RegExp(r'[\d+]'))],
          decoration: deco.copyWith(prefixText: type == 'currency' ? 'Rp ' : null, hintText: keep ? 'Tersimpan · kosongkan bila tidak diubah' : f.placeholder),
          onChanged: onChanged,
        );
    }
  }
}

/// Daftar baris (anggota keluarga, item harga): satu kartu per baris; _id tetap agar data terenkripsi tidak tertukar.
class _RepeaterField extends StatelessWidget {
  const _RepeaterField({required this.field, required this.rows, required this.onChanged, required this.commodities, required this.keep});
  final SchemaField field;
  final List<FormRow> rows;
  final ValueChanged<List<FormRow>> onChanged;
  final List<Map<String, dynamic>> commodities;
  final bool keep;

  void _update(int i, String key, Object? v) {
    final next = [...rows];
    final row = Map<String, dynamic>.from(next[i])..[key] = v;
    // Balita: isian yang tak berlaku disetel otomatis.
    if (key == 'tanggal_lahir' && _isBalita(row)) {
      for (final e in _balitaDefaults.entries) {
        if (field.fields?.any((s) => s.key == e.key) ?? false) row[e.key] = e.value;
      }
    }
    next[i] = row;
    onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final noun = field.label.toLowerCase().replaceFirst(RegExp(r'^daftar '), '');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(field.label, style: const TextStyle(fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      if (rows.isEmpty) Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(border: Border.all(color: line), borderRadius: BorderRadius.circular(12)),
        child: Text('Belum ada $noun.', textAlign: TextAlign.center, style: const TextStyle(color: muted)),
      ),
      for (var i = 0; i < rows.length; i++)
        Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                const Icon(Icons.person_outline, size: 18, color: brand),
                const SizedBox(width: 6),
                Expanded(child: Text((rows[i]['nama'] as String?)?.isNotEmpty == true ? rows[i]['nama'] : '${field.label} ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w600))),
                if (_isBalita(rows[i])) Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), margin: const EdgeInsets.only(right: 4),
                  decoration: BoxDecoration(color: brand.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(99)),
                  child: const Text('Balita', style: TextStyle(fontSize: 11, color: brand)),
                ),
                IconButton(icon: const Icon(Icons.delete_outline, color: danger), onPressed: () => onChanged([...rows]..removeAt(i))),
              ]),
              for (final s in (field.fields ?? const <SchemaField>[]).where((s) => s.active(rows[i]) && !(_isBalita(rows[i]) && _balitaDefaults.containsKey(s.key))))
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: _ScalarInput(
                    key: ValueKey('${rows[i]['_id']}-${s.key}'),
                    field: s, value: rows[i][s.key], label: '${s.label}${s.isRequired(rows[i]) && !(s.sensitive && keep) ? ' *' : ''}',
                    keep: s.sensitive && keep, commodities: commodities, onChanged: (v) => _update(i, s.key, v),
                  ),
                ),
            ]),
          ),
        ),
      OutlinedButton.icon(onPressed: () => onChanged([...rows, {'_id': _uuid.v4()}]), icon: const Icon(Icons.add), label: Text('Tambah $noun')),
    ]);
  }
}

/// Foto dari kamera (atau berkas dari galeri untuk tipe file), dengan pratinjau & batas jumlah.
class _MediaField extends StatelessWidget {
  const _MediaField({required this.label, required this.files, required this.existing, required this.max, required this.photo, required this.onChanged});
  final String label;
  final List<XFile> files;
  final int existing;
  final int max;
  final bool photo;
  final ValueChanged<List<XFile>> onChanged;

  Future<void> _pick(ImageSource src) async {
    final f = await ImagePicker().pickImage(source: src, maxWidth: 1600, maxHeight: 1600, imageQuality: 80);
    if (f != null) onChanged([...files, f]);
  }

  @override
  Widget build(BuildContext context) {
    final room = max - existing - files.length;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (var i = 0; i < existing; i++)
          Container(width: 96, height: 96, alignment: Alignment.center, decoration: BoxDecoration(color: success.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
              child: const Text('Terunggah', style: TextStyle(color: success, fontSize: 12))),
        for (var i = 0; i < files.length; i++)
          Stack(children: [
            ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.file(File(files[i].path), width: 96, height: 96, fit: BoxFit.cover)),
            Positioned(right: 2, top: 2, child: InkWell(
              onTap: () => onChanged([...files]..removeAt(i)),
              child: const CircleAvatar(radius: 12, backgroundColor: Colors.black54, child: Icon(Icons.close, size: 14, color: Colors.white)),
            )),
          ]),
        if (room > 0) ...[
          if (photo) _PickTile(icon: Icons.photo_camera_outlined, label: 'Kamera', onTap: () => _pick(ImageSource.camera)),
          if (!photo) _PickTile(icon: Icons.attach_file, label: 'Pilih berkas', onTap: () => _pick(ImageSource.gallery)),
        ],
      ]),
    ]);
  }
}

class _PickTile extends StatelessWidget {
  const _PickTile({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 96, height: 96,
          decoration: BoxDecoration(border: Border.all(color: brand.withValues(alpha: 0.4), width: 1.5), color: brand.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12)),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, color: brand), const SizedBox(height: 4), Text(label, style: const TextStyle(fontSize: 12, color: brand))]),
        ),
      );
}
