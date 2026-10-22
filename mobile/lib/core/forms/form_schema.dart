import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';

/// Model skema form (docs/teknis/03-modul-laporan.md §4). Renderer menyusul di fase 2.
class SchemaField {
  SchemaField.fromJson(Map<String, dynamic> j)
      : key = j['key'],
        label = j['label'],
        type = j['type'],
        required = j['required'] ?? false,
        options = (j['options'] as List?)?.cast<String>(),
        min = j['min'] as num?,
        max = j['max'] as num?,
        maxLength = j['maxLength'] as int?,
        fields = (j['fields'] as List?)?.map((f) => SchemaField.fromJson(Map<String, dynamic>.from(f))).toList();

  final String key;
  final String label;
  final String type;
  final bool required;
  final List<String>? options;
  final num? min;
  final num? max;
  final int? maxLength;
  final List<SchemaField>? fields;
}

class FormSchema {
  FormSchema.fromJson(Map<String, dynamic> row)
      : category = row['category'],
        version = row['version'],
        title = row['schema']['title'],
        fields = (row['schema']['fields'] as List).map((f) => SchemaField.fromJson(Map<String, dynamic>.from(f))).toList();

  final String category;
  final int version;
  final String title;
  final List<SchemaField> fields;
}

final formSchemasProvider = FutureProvider<List<FormSchema>>((ref) async {
  final Response res = await ref.read(dioProvider).get('/form-schemas');
  final rows = (res.data as List).map((r) => FormSchema.fromJson(Map<String, dynamic>.from(r))).toList();
  // API mengurutkan versi menurun; ambil versi terbaru per kategori.
  final latest = <String, FormSchema>{};
  for (final s in rows) {
    latest.putIfAbsent(s.category, () => s);
  }
  return latest.values.toList();
});
