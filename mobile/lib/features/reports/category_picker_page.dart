import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/forms/form_schema.dart';
import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import '../../core/ui/skeleton.dart';

class CategoryPickerPage extends ConsumerWidget {
  const CategoryPickerPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schemas = ref.watch(formSchemasProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Buat laporan')),
      body: schemas.when(
        loading: () => const SkeletonList(count: 6),
        error: (e, _) => Center(child: Text('Gagal memuat formulir: $e')),
        data: (list) => ListView(padding: const EdgeInsets.all(16), children: [
          const Text('Pilih jenis kegiatan', style: TextStyle(color: muted)),
          const SizedBox(height: 10),
          for (final c in categories.where((c) => list.any((s) => s.category == c.key)))
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Card(
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  leading: CircleAvatar(backgroundColor: c.color.withValues(alpha: 0.12), child: Icon(c.icon, color: c.color)),
                  title: Text(c.label, style: const TextStyle(fontWeight: FontWeight.w600)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.pushReplacement('/lapor/${c.key}'),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}
