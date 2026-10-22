import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/ui/theme.dart';
import 'report_api.dart';
import 'report_tile.dart';

class ReportListPage extends ConsumerStatefulWidget {
  const ReportListPage({super.key});

  @override
  ConsumerState<ReportListPage> createState() => _ReportListPageState();
}

class _ReportListPageState extends ConsumerState<ReportListPage> {
  String? _status;
  String _q = '';
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = (status: _status, q: _q);
    final list = ref.watch(reportsProvider(query));
    return Scaffold(
      appBar: AppBar(title: const Text('Laporan saya')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: SegmentedButton<String?>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: null, label: Text('Semua')),
              ButtonSegment(value: 'SUBMITTED', label: Text('Terkirim')),
              ButtonSegment(value: 'DRAFT', label: Text('Draft')),
            ],
            selected: {_status},
            onSelectionChanged: (s) => setState(() => _status = s.first),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            decoration: const InputDecoration(hintText: 'Cari nomor, desa, atau kepala keluarga…', prefixIcon: Icon(Icons.search)),
            onChanged: (v) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 400), () => setState(() => _q = v));
            },
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(reportsProvider(query).future),
            child: list.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ListView(children: const [Padding(padding: EdgeInsets.all(24), child: Text('Gagal memuat laporan. Tarik untuk mencoba lagi.', style: TextStyle(color: danger)))]),
              data: (items) => items.isEmpty
                  ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Tidak ada laporan.', style: TextStyle(color: muted))))])
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => ReportTile(items[i]),
                    ),
            ),
          ),
        ),
      ]),
    );
  }
}
