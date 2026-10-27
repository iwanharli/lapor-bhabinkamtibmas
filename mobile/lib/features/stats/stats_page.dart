import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/ui/format.dart';
import '../../core/ui/responsive.dart';
import '../../core/ui/skeleton.dart';
import '../../core/ui/theme.dart';

/// Statistik Bhabin sendiri dari GET /me/stats (7 atau 30 hari terakhir).
final myStatsProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, days) async {
  final res = await ref.read(dioProvider).get('/me/stats', queryParameters: {'days': days});
  return Map<String, dynamic>.from(res.data as Map);
});

/// Tab Statistik: ringkasan kinerja, laporan per hari, dan per kategori.
class StatsPage extends ConsumerStatefulWidget {
  const StatsPage({super.key});

  @override
  ConsumerState<StatsPage> createState() => _StatsPageState();
}

class _StatsPageState extends ConsumerState<StatsPage> {
  int _days = 30;

  @override
  Widget build(BuildContext context) {
    final stats = ref.watch(myStatsProvider(_days));
    return Scaffold(
      appBar: AppBar(title: const Text('Statistik saya')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myStatsProvider(_days).future),
        child: ListView(padding: contentPadding(context, top: 8, bottom: 100), children: [
          SegmentedButton<int>(
            showSelectedIcon: false,
            segments: const [ButtonSegment(value: 7, label: Text('7 hari')), ButtonSegment(value: 30, label: Text('30 hari'))],
            selected: {_days},
            onSelectionChanged: (s) => setState(() => _days = s.first),
          ),
          const SizedBox(height: 16),
          stats.when(
            loading: () => const SkeletonList(count: 4, padding: EdgeInsets.zero),
            error: (e, _) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Text('Statistik belum bisa dimuat. ${apiErrorMessage(e)}'))),
            data: (d) => _Body(d),
          ),
        ]),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body(this.d);
  final Map<String, dynamic> d;

  int _n(String k) => (d[k] as num?)?.toInt() ?? 0;

  @override
  Widget build(BuildContext context) {
    final days = _n('days'), laporan = _n('laporan'), prev = _n('sebelumnya'), hariKerja = _n('hariKerja'), hadir = _n('hadir');
    final change = prev >= 5 ? ((laporan - prev) / prev * 100).round() : null;
    final hadirPct = hariKerja > 0 ? (hadir / hariKerja * 100).round() : null;
    final harian = ((d['harian'] as List?) ?? []).cast<Map>();
    final kategori = ((d['perKategori'] as List?) ?? []).cast<Map>();
    final range = '${DateFormat('d MMM', 'id_ID').format(DateTime.parse(d['dari']))} – ${DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(d['sampai']))}';

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(range, style: const TextStyle(color: muted, fontSize: 12)),
      const SizedBox(height: 8),
      GridView.count(
        crossAxisCount: isWide(context) ? 4 : 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: isWide(context) ? 1.35 : 1.45,
        children: [
          _Kpi(icon: Icons.assignment_turned_in_outlined, color: brand, label: 'Laporan terkirim', value: '$laporan',
              note: change == null ? 'periode sebelumnya: $prev' : '${change >= 0 ? '+' : ''}$change% dari periode sebelumnya',
              noteColor: change == null ? muted : change >= 0 ? success : danger),
          _Kpi(icon: Icons.event_available_outlined, color: success, label: 'Hari aktif melapor', value: '${_n('hariAktif')}', note: 'dari $days hari'),
          _Kpi(icon: Icons.how_to_reg_outlined, color: hadirPct != null && hadirPct < 50 ? danger : const Color(0xFF0EA5E9), label: 'Kehadiran',
              value: hadirPct == null ? '—' : '$hadirPct%', note: '$hadir dari $hariKerja hari kerja · ${_n('terlambat')} terlambat'),
          _Kpi(icon: Icons.local_fire_department_outlined, color: danger, label: 'Urgensi tinggi', value: '${_n('prioritas')}', note: 'deteksi dini prioritas'),
        ],
      ),
      const SizedBox(height: 16),
      Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Laporan per hari', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            _DailyBars(harian),
          ]),
        ),
      ),
      const SizedBox(height: 12),
      Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Per kategori', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (kategori.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Belum ada laporan pada periode ini.', style: TextStyle(color: muted))),
            for (final k in kategori) _CategoryRow(k: k, total: laporan),
          ]),
        ),
      ),
    ]);
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.icon, required this.color, required this.label, required this.value, required this.note, this.noteColor = muted});
  final IconData icon;
  final Color color;
  final String label, value, note;
  final Color noteColor;

  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              CircleAvatar(radius: 14, backgroundColor: color.withValues(alpha: 0.12), child: Icon(icon, size: 16, color: color)),
              const SizedBox(width: 8),
              Expanded(child: Text(label, style: const TextStyle(fontSize: 12, color: muted), maxLines: 1, overflow: TextOverflow.ellipsis)),
            ]),
            const Spacer(),
            Text(value, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, height: 1)),
            const SizedBox(height: 4),
            Text(note, style: TextStyle(fontSize: 11, color: noteColor), maxLines: 2, overflow: TextOverflow.ellipsis),
          ]),
        ),
      );
}

/// Batang harian sederhana; label tanggal tiap ±5 hari.
class _DailyBars extends StatelessWidget {
  const _DailyBars(this.rows);
  final List<Map> rows;

  @override
  Widget build(BuildContext context) {
    final max = rows.fold<int>(1, (m, r) => (r['jumlah'] as num).toInt() > m ? (r['jumlah'] as num).toInt() : m);
    final step = rows.length > 10 ? 5 : 1;
    return SizedBox(
      height: 130,
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        for (var i = 0; i < rows.length; i++)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1.5),
              child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                if ((rows[i]['jumlah'] as num) > 0 && (rows[i]['jumlah'] as num) == max)
                  Text('$max', style: const TextStyle(fontSize: 9, color: muted)),
                Container(
                  height: 96 * ((rows[i]['jumlah'] as num) / max),
                  decoration: BoxDecoration(color: brand.withValues(alpha: (rows[i]['jumlah'] as num) > 0 ? 0.9 : 0.15), borderRadius: BorderRadius.circular(3)),
                ),
                const SizedBox(height: 4),
                SizedBox(
                  height: 14,
                  child: (i % step == 0 || i == rows.length - 1)
                      ? FittedBox(child: Text(DateTime.parse(rows[i]['hari'] as String).day.toString(), style: const TextStyle(fontSize: 10, color: muted)))
                      : null,
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.k, required this.total});
  final Map k;
  final int total;

  @override
  Widget build(BuildContext context) {
    final c = categoryOf(k['kategori'] as String);
    final n = (k['jumlah'] as num).toInt();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Icon(c.icon, size: 18, color: c.color),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(c.label, style: const TextStyle(fontSize: 13))),
              Text('$n', style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(value: total == 0 ? 0 : n / total, minHeight: 6, color: c.color, backgroundColor: c.color.withValues(alpha: 0.12)),
            ),
          ]),
        ),
      ]),
    );
  }
}
