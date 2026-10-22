import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/forms/form_schema.dart';
import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import 'report_api.dart';

class ReportDetailPage extends ConsumerWidget {
  const ReportDetailPage({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(reportDetailProvider(id));
    return Scaffold(
      appBar: AppBar(title: const Text('Detail laporan')),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(apiErrorMessage(e))),
        data: (r) => _Body(r: r),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.r});
  final Map<String, dynamic> r;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = categoryOf(r['category']);
    final draft = r['status'] == 'DRAFT';
    final schema = r['schema'] == null ? null : FormSchema.fromJson({'category': r['category'], 'version': r['schemaVersion'] ?? 1, 'schema': r['schema']});
    final data = Map<String, dynamic>.from(r['data'] as Map);
    final secret = ((r['sensitiveFilled'] as List?) ?? []).cast<String>();
    final until = r['editableUntil'] as String?;
    final canEdit = draft || (until != null && DateTime.parse(until).isAfter(DateTime.now()));
    final attachments = ((r['attachments'] as List?) ?? []).map((a) => Map<String, dynamic>.from(a)).toList();
    final outside = r['insideVillage'] == false;

    return ListView(padding: const EdgeInsets.all(16), children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), gradient: const LinearGradient(colors: [brandDeep, brand])),
        child: Row(children: [
          CircleAvatar(radius: 24, backgroundColor: Colors.white24, child: Icon(c.icon, color: Colors.white)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              Text(r['nomor'], style: const TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'monospace')),
            ]),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: draft ? Colors.white24 : Colors.white, borderRadius: BorderRadius.circular(99)),
            child: Text(draft ? 'Draft' : 'Terkirim', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: draft ? Colors.white : success)),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      Card(
        child: Column(children: [
          ListTile(dense: true, leading: const Icon(Icons.place_outlined), title: Text('${r['village']['nama']}, ${r['village']['kecamatan']}'),
              trailing: draft ? null : _locationChip(r)),
          if (outside && r['distanceM'] != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Text('Titik GPS ±${jarak(r['distanceM'])} dari batas desa (toleransi 200 m). Laporan tetap tercatat; pimpinan diberi tahu untuk mengecek.',
                  style: const TextStyle(fontSize: 12, color: warn)),
            ),
          ListTile(dense: true, leading: const Icon(Icons.event_outlined), title: Text('Kegiatan ${tanggalJam(r['occurredAt'])}')),
          if (r['submittedAt'] != null) ListTile(dense: true, leading: const Icon(Icons.send_outlined), title: Text('Dikirim ${tanggalJam(r['submittedAt'])}')),
        ]),
      ),
      const SizedBox(height: 12),
      if (canEdit)
        FilledButton.icon(
          onPressed: () async {
            await context.push('/lapor/${r['category']}?id=${r['id']}');
            ref.invalidate(reportDetailProvider(r['id']));
          },
          icon: const Icon(Icons.edit_outlined),
          label: Text(draft ? 'Lanjutkan & kirim draft' : 'Ralat (hingga ${tanggalJam(until!)})'),
        ),
      if (!canEdit) const Text('Laporan final — batas ralat 3×24 jam sudah lewat.', textAlign: TextAlign.center, style: TextStyle(color: muted, fontSize: 12)),
      const SizedBox(height: 16),
      const Text('Isian laporan', style: TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(children: [
            for (final f in (schema?.fields ?? const <SchemaField>[]).where((f) => !f.isMedia && f.active(data)))
              ..._fieldRows(f, data, secret),
          ]),
        ),
      ),
      if (attachments.isNotEmpty) ...[
        const SizedBox(height: 16),
        const Text('Foto & lampiran', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8,
          children: [
            for (final a in attachments)
              GestureDetector(
                onTap: () => showDialog(context: context, builder: (_) => Dialog(child: InteractiveViewer(child: AuthImage(attachmentUrl(a['id']), fit: BoxFit.contain)))),
                child: ClipRRect(borderRadius: BorderRadius.circular(12), child: AuthImage(attachmentUrl(a['id'], thumb: true))),
              ),
          ],
        ),
      ],
      const SizedBox(height: 32),
    ]);
  }

  Widget _locationChip(Map<String, dynamic> r) {
    final (label, color) = r['isMockLocation'] == true
        ? ('Lokasi palsu', danger)
        : r['insideVillage'] == false
            ? ('Di luar desa${r['distanceM'] != null ? ' · ${jarak(r['distanceM'])}' : ''}', warn)
            : r['insideVillage'] == true ? ('Sesuai desa', success) : ('—', muted);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(99)),
      child: Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }

  List<Widget> _fieldRows(SchemaField f, Map<String, dynamic> data, List<String> secret) {
    final v = data[f.key];
    if (f.type == 'repeater') {
      final rows = (v as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
      return [
        Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 4), child: Align(alignment: Alignment.centerLeft, child: Text(f.label, style: const TextStyle(color: muted, fontSize: 12)))),
        for (final row in rows)
          Container(
            margin: const EdgeInsets.fromLTRB(12, 4, 12, 4),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(border: Border.all(color: line), borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (final s in (f.fields ?? const <SchemaField>[]).where((s) => !s.sensitive && s.active(row) && row[s.key] != null && row[s.key] != ''))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text.rich(TextSpan(children: [
                    TextSpan(text: '${s.label}: ', style: const TextStyle(color: muted, fontSize: 12)),
                    TextSpan(text: displayValue(row[s.key]), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  ])),
                ),
              if (secret.contains(f.key)) const Text('🔒 Data sensitif terenkripsi', style: TextStyle(fontSize: 11, color: Color(0xFF7C3AED))),
            ]),
          ),
      ];
    }
    final hidden = f.sensitive && secret.contains(f.key);
    if (!hidden && (v == null || v == '' || (v is List && v.isEmpty))) return [];
    return [
      ListTile(
        dense: true,
        title: Text(f.label, style: const TextStyle(color: muted, fontSize: 12)),
        subtitle: Text(hidden ? '🔒 Terenkripsi' : displayValue(v), style: TextStyle(fontSize: 14, color: hidden ? const Color(0xFF7C3AED) : ink, fontWeight: FontWeight.w500)),
      ),
    ];
  }
}
