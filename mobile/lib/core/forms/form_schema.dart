import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../auth/auth_controller.dart';

/// Syarat "wajib & tampil bila field lain bernilai …" (sama dengan validator server).
class RequiredIf {
  RequiredIf.fromJson(Map<String, dynamic> j)
      : field = j['field'] as String,
        equals = j['equals'],
        inList = (j['in'] as List?)?.toList();
  final String field;
  final Object? equals;
  final List<Object?>? inList;

  bool met(Map<String, dynamic> v) => inList != null ? inList!.contains(v[field]) : v[field] == equals;
}

/// Tampil hanya untuk kelompok tertentu: nilai field lain, jenis kelamin, umur dari tanggal lahir.
class ShowIf {
  ShowIf.fromJson(Map<String, dynamic> j)
      : field = j['field'] as String?,
        inList = (j['in'] as List?)?.toList(),
        sexField = j['sexField'] as String?,
        sex = j['sex'] as String?,
        dob = j['dob'] as String?,
        ageMin = j['ageMin'] as num?,
        ageMax = j['ageMax'] as num?;
  final String? field;
  final List<Object?>? inList;
  final String? sexField;
  final String? sex;
  final String? dob;
  final num? ageMin;
  final num? ageMax;

  bool met(Map<String, dynamic> v) {
    if (field != null && !(inList ?? const []).contains(v[field])) return false;
    if (sexField != null && v[sexField] != sex) return false;
    if (dob != null) {
      final a = ageYears(v[dob]);
      if (a == null || (ageMin != null && a < ageMin!) || (ageMax != null && a >= ageMax!)) return false;
    }
    return true;
  }
}

/// Umur (tahun penuh) dari YYYY-MM-DD; null bila kosong/tidak valid.
int? ageYears(Object? dob) {
  if (dob is! String || !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(dob)) return null;
  final d = DateTime.parse(dob), now = DateTime.now();
  var a = now.year - d.year;
  if (now.month < d.month || (now.month == d.month && now.day < d.day)) a--;
  return a < 0 ? null : a;
}

/// Model skema form (docs/teknis/03-modul-laporan.md §4).
class SchemaField {
  SchemaField.fromJson(Map<String, dynamic> j)
      : key = j['key'],
        label = j['label'],
        type = j['type'],
        required = j['required'] ?? false,
        sensitive = j['sensitive'] ?? false,
        options = (j['options'] as List?)?.cast<String>(),
        source = j['source'] as String?,
        hint = j['hint'] as String?,
        placeholder = j['placeholder'] as String?,
        min = j['min'] as num?,
        max = j['max'] as num?,
        maxLength = j['maxLength'] as int?,
        requiredIf = j['requiredIf'] is Map ? RequiredIf.fromJson(Map<String, dynamic>.from(j['requiredIf'])) : null,
        showIf = j['showIf'] is Map ? ShowIf.fromJson(Map<String, dynamic>.from(j['showIf'])) : null,
        fields = (j['fields'] as List?)?.map((f) => SchemaField.fromJson(Map<String, dynamic>.from(f))).toList();

  final String key;
  final String label;
  final String type;
  final bool required;
  final bool sensitive;
  final List<String>? options;
  final String? source;
  final String? hint;
  final String? placeholder;
  final num? min;
  final num? max;
  final int? maxLength;
  final RequiredIf? requiredIf;
  final ShowIf? showIf;
  final List<SchemaField>? fields;

  bool get isMedia => type == 'photo' || type == 'file';

  /// Tampil untuk konteks nilai ini? (field bersyarat yang tidak berlaku disembunyikan)
  bool active(Map<String, dynamic> v) => (showIf?.met(v) ?? true) && (requiredIf?.met(v) ?? true);
  bool isRequired(Map<String, dynamic> v) => required || (requiredIf != null && active(v));
}

class FormStep {
  FormStep.fromJson(Map<String, dynamic> j)
      : title = j['title'],
        description = j['description'] as String?,
        fields = (j['fields'] as List).cast<String>();
  final String title;
  final String? description;
  final List<String> fields;
}

class FormSchema {
  FormSchema.fromJson(Map<String, dynamic> row)
      : category = row['category'],
        version = row['version'],
        title = row['schema']['title'],
        fields = (row['schema']['fields'] as List).map((f) => SchemaField.fromJson(Map<String, dynamic>.from(f))).toList(),
        steps = (row['schema']['steps'] as List?)?.map((s) => FormStep.fromJson(Map<String, dynamic>.from(s))).toList();

  final String category;
  final int version;
  final String title;
  final List<SchemaField> fields;
  final List<FormStep>? steps;

  SchemaField? field(String key) => fields.where((f) => f.key == key).firstOrNull;
}

/// Dimuat ulang saat pengguna berganti (login/logout) — galat sesi lama tidak tersangkut.
final _schemasProvider = FutureProvider<List<FormSchema>>((ref) async {
  ref.watch(authControllerProvider.select((s) => s.valueOrNull?.nrp));
  final Response res = await ref.read(dioProvider).get('/form-schemas');
  return (res.data as List).map((r) => FormSchema.fromJson(Map<String, dynamic>.from(r))).toList();
});

/// Versi terbaru per kategori (API mengurutkan versi menurun).
final formSchemasProvider = FutureProvider<List<FormSchema>>((ref) async {
  final latest = <String, FormSchema>{};
  for (final s in await ref.watch(_schemasProvider.future)) {
    latest.putIfAbsent(s.category, () => s);
  }
  return latest.values.toList();
});

/// Skema versi tertentu (laporan lama boleh memakai versi yang sudah dipensiunkan).
final schemaVersionProvider = FutureProvider.family<FormSchema?, (String, int?)>((ref, key) async {
  final all = await ref.watch(_schemasProvider.future);
  final (category, version) = key;
  return all.where((s) => s.category == category && (version == null || s.version == version)).firstOrNull;
});

final commoditiesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  ref.watch(authControllerProvider.select((s) => s.valueOrNull?.nrp));
  final res = await ref.read(dioProvider).get('/commodities');
  return (res.data as List).map((c) => Map<String, dynamic>.from(c)).where((c) => c['active'] != false).toList();
});
