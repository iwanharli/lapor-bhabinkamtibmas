import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/forms/form_schema.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(authControllerProvider).valueOrNull;
    final schemas = ref.watch(formSchemasProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Beranda'),
        actions: [
          IconButton(
            tooltip: 'Keluar',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (me != null) ...[
            Text('Selamat bertugas, ${me.nama}', style: Theme.of(context).textTheme.titleLarge),
            Text(me.unitNama),
            const SizedBox(height: 4),
            Text('Desa binaan: ${me.villages.map((v) => v['nama']).join(', ').ifEmpty('—')}'),
          ],
          const SizedBox(height: 24),
          Text('Buat laporan', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          schemas.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => const Text('Gagal memuat kategori laporan'),
            data: (list) => GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.6,
              children: [
                for (final s in list)
                  Card(
                    child: InkWell(
                      // Form dinamis & mode offline: fase 2.
                      onTap: () => ScaffoldMessenger.of(context)
                          .showSnackBar(SnackBar(content: Text('Form ${s.title} tersedia di fase 2'))),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Align(alignment: Alignment.bottomLeft, child: Text(s.title, style: const TextStyle(fontWeight: FontWeight.w600))),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
