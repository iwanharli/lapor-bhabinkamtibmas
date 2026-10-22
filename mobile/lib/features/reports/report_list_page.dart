import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import 'report_api.dart';
import 'report_tile.dart';

const _pageSize = 20;
const _periods = [(null, 'Semua waktu'), (7, '7 hari'), (30, '30 hari')];

/// Laporan saya: tab status, cari, filter prioritas/periode/kategori, dikelompokkan per tanggal, muat bertahap saat digulir.
class ReportListPage extends ConsumerStatefulWidget {
  const ReportListPage({super.key});

  @override
  ConsumerState<ReportListPage> createState() => _ReportListPageState();
}

class _ReportListPageState extends ConsumerState<ReportListPage> {
  ReportFilter _f = const ReportFilter();
  final List<ReportItem> _items = [];
  int _total = 0;
  int _page = 0;
  bool _loading = false;
  String? _error;
  int _gen = 0; // abaikan respons lama saat filter berubah
  Timer? _debounce;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) _more();
    });
    _reload();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    _gen++;
    setState(() {
      _items.clear();
      _page = 0;
      _total = 0;
      _error = null;
      _loading = false;
    });
    await _more();
  }

  Future<void> _more() async {
    if (_loading || (_page > 0 && _items.length >= _total)) return;
    final gen = _gen;
    setState(() => _loading = true);
    try {
      final r = await fetchReports(ref.read(dioProvider), _f, page: _page + 1, limit: _pageSize);
      if (gen != _gen || !mounted) return;
      setState(() {
        _items.addAll(r.items.where((x) => !_items.any((y) => y.id == x.id)));
        _total = r.total;
        _page++;
      });
    } catch (e) {
      if (gen == _gen && mounted) setState(() => _error = apiErrorMessage(e));
    } finally {
      if (gen == _gen && mounted) setState(() => _loading = false);
    }
  }

  void _set(ReportFilter f) {
    _f = f;
    _reload();
  }

  Widget _chip(String label, bool on, VoidCallback onTap, {IconData? icon, Color? color}) => Padding(
        padding: const EdgeInsets.only(right: 6),
        child: FilterChip(
          avatar: icon == null ? null : Icon(icon, size: 16, color: on ? Colors.white : (color ?? muted)),
          label: Text(label),
          selected: on,
          showCheckmark: false,
          selectedColor: color ?? brand,
          labelStyle: TextStyle(color: on ? Colors.white : ink, fontSize: 12),
          onSelected: (_) => onTap(),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final yesterday = DateFormat('yyyy-MM-dd').format(DateTime.now().subtract(const Duration(days: 1)));
    final groups = <String, List<ReportItem>>{};
    for (final r in _items) {
      groups.putIfAbsent(DateFormat('yyyy-MM-dd').format(DateTime.parse(r.occurredAt).toLocal()), () => []).add(r);
    }
    String dayLabel(String d) => d == today ? 'HARI INI' : d == yesterday ? 'KEMARIN' : DateFormat('EEEE, d MMMM', 'id_ID').format(DateTime.parse(d)).toUpperCase();

    return Scaffold(
      appBar: AppBar(title: const Text('Laporan saya')),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: CustomScrollView(controller: _scroll, slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                SegmentedButton<String?>(
                  showSelectedIcon: false,
                  segments: const [
                    ButtonSegment(value: null, label: Text('Semua')),
                    ButtonSegment(value: 'SUBMITTED', label: Text('Terkirim')),
                    ButtonSegment(value: 'DRAFT', label: Text('Draft')),
                  ],
                  selected: {_f.status},
                  onSelectionChanged: (s) => _set(_f.copyWith(status: s.first)),
                ),
                const SizedBox(height: 10),
                TextField(
                  decoration: const InputDecoration(hintText: 'Cari nomor, desa, atau kepala keluarga…', prefixIcon: Icon(Icons.search)),
                  onChanged: (v) {
                    _debounce?.cancel();
                    _debounce = Timer(const Duration(milliseconds: 400), () => _set(_f.copyWith(q: v)));
                  },
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    _chip('Prioritas', _f.priority, () => _set(_f.copyWith(priority: !_f.priority)), icon: Icons.local_fire_department, color: danger),
                    for (final p in _periods) _chip(p.$2, _f.days == p.$1, () => _set(_f.copyWith(days: p.$1))),
                  ]),
                ),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    _chip('Semua kategori', _f.category == null, () => _set(_f.copyWith(category: null))),
                    for (final c in categories.where((c) => c.key != 'PENYULUHAN'))
                      _chip(c.label, _f.category == c.key, () => _set(_f.copyWith(category: c.key)), icon: c.icon, color: c.color),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 6, bottom: 4),
                  child: Text('${NumberFormat.decimalPattern('id_ID').format(_total)} laporan${_f.active ? ' sesuai filter' : ''}', style: const TextStyle(color: muted, fontSize: 12)),
                ),
              ]),
            ),
          ),
          if (_items.isEmpty && !_loading)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(_error != null ? Icons.cloud_off : Icons.search_off, size: 40, color: muted),
                  const SizedBox(height: 8),
                  Text(_error ?? (_f.active ? 'Tidak ada laporan yang cocok' : 'Belum ada laporan'), style: const TextStyle(color: muted)),
                  if (_f.active) TextButton(onPressed: () => _set(ReportFilter(status: _f.status)), child: const Text('Hapus filter')),
                ]),
              ),
            ),
          for (final e in groups.entries) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                child: Text(dayLabel(e.key), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: muted, letterSpacing: 0.8)),
              ),
            ),
            SliverList.separated(
              itemCount: e.value.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) => Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: ReportTile(e.value[i])),
            ),
          ],
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              child: Center(
                child: _loading
                    ? const CircularProgressIndicator()
                    : _error != null && _items.isNotEmpty
                        ? TextButton(onPressed: _more, child: const Text('Gagal memuat. Coba lagi'))
                        : _items.length > _pageSize && _items.length >= _total
                            ? Text('Semua ${_items.length} laporan sudah ditampilkan', style: const TextStyle(color: muted, fontSize: 12))
                            : const SizedBox.shrink(),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
