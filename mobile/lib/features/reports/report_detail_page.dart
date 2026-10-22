import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/forms/form_schema.dart';
import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import '../../core/ui/skeleton.dart';
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
        loading: () => const SkeletonDetail(),
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
      if (draft) ...[
        const SizedBox(height: 8),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: danger, side: const BorderSide(color: danger)),
          onPressed: () => _discard(context, ref),
          icon: const Icon(Icons.delete_outline),
          label: const Text('Buang draft'),
        ),
      ],
      if (!canEdit) const Text('Laporan final — batas ralat 3×24 jam sudah lewat.', textAlign: TextAlign.center, style: TextStyle(color: muted, fontSize: 12)),
      if (secret.isNotEmpty && r['canRevealSensitive'] == true) ...[
        const SizedBox(height: 12),
        Card(
          color: const Color(0xFF7C3AED).withValues(alpha: 0.06),
          child: ListTile(
            leading: const Icon(Icons.lock_outline, color: Color(0xFF7C3AED)),
            title: const Text('Data sensitif terenkripsi', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: const Text('NIK & data kesehatan dibuka dengan alasan; tercatat di audit log.', style: TextStyle(fontSize: 12)),
            trailing: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF7C3AED), minimumSize: const Size(0, 40)),
              onPressed: () => _reveal(context, ref, schema),
              child: const Text('Tampilkan'),
            ),
          ),
        ),
      ],
      const SizedBox(height: 16),
      const Text('Isian laporan', style: TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(children: [
            for (final f in (schema?.fields ?? const <SchemaField>[]).where((f) => !f.isMedia && f.active(data)))
              ..._fieldRows(context, f, data, secret),
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

  Future<void> _discard(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Buang draft ini?'),
      content: const Text('Draft dan foto yang sudah diunggah akan dihapus permanen dan tidak bisa dikembalikan.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
        FilledButton(style: FilledButton.styleFrom(backgroundColor: danger), onPressed: () => Navigator.pop(ctx, true), child: const Text('Ya, buang')),
      ],
    ));
    if (ok != true) return;
    try {
      await ref.read(dioProvider).delete('/reports/${r['id']}');
      ref.invalidate(reportsProvider);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Draft sudah dibuang')));
      context.pop();
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: danger, content: Text(apiErrorMessage(e))));
    }
  }

  /// Buka data sensitif dengan alasan (tercatat di audit log); baris repeater ditampilkan per nama.
  Future<void> _reveal(BuildContext context, WidgetRef ref, FormSchema? schema) async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Data sensitif'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Akses dicatat di audit log beserta alasannya.', style: TextStyle(color: muted, fontSize: 13)),
        const SizedBox(height: 12),
        TextField(controller: reason, autofocus: true, decoration: const InputDecoration(labelText: 'Alasan membuka', hintText: 'mis. Verifikasi data untuk Puskesmas')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
        FilledButton(onPressed: () => Navigator.pop(ctx, reason.text.trim().length >= 5), child: const Text('Tampilkan')),
      ],
    ));
    if (ok != true || !context.mounted) {
      if (ok == false && reason.text.trim().isNotEmpty && reason.text.trim().length < 5 && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Alasan minimal 5 karakter')));
      }
      return;
    }
    try {
      final res = await ref.read(dioProvider).post('/reports/${r['id']}/reveal-sensitive', data: {'reason': reason.text.trim()});
      final values = Map<String, dynamic>.from(res.data as Map);
      final data = Map<String, dynamic>.from(r['data'] as Map);
      if (!context.mounted) return;
      await showModalBottomSheet(
        context: context, isScrollControlled: true,
        builder: (ctx) => DraggableScrollableSheet(
          expand: false, initialChildSize: 0.6,
          builder: (_, sc) => ListView(controller: sc, padding: const EdgeInsets.all(20), children: [
            const Text('Data sensitif', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
            const SizedBox(height: 4),
            const Text('Jangan menyalin atau menyebarkan data ini di luar keperluan tugas.', style: TextStyle(color: warn, fontSize: 12)),
            const SizedBox(height: 12),
            for (final e in values.entries) ...[
              Text(schema?.field(e.key)?.label ?? e.key, style: const TextStyle(color: muted, fontSize: 12)),
              const SizedBox(height: 4),
              if (e.value is List)
                for (final row in (e.value as List).cast<Map>())
                  Container(
                    margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: context.pal.subtle, borderRadius: BorderRadius.circular(10)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(((data[e.key] as List?)?.cast<Map>().where((p) => p['_id'] == row['_id']).firstOrNull?['nama'] ?? 'Baris').toString(), style: const TextStyle(fontWeight: FontWeight.w600)),
                      for (final kv in row.entries.where((kv) => kv.key != '_id'))
                        Text('${schema?.field(e.key)?.fields?.where((s) => s.key == kv.key).firstOrNull?.label ?? kv.key}: ${kv.value}'),
                    ]),
                  )
              else
                Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(e.value.toString(), style: const TextStyle(fontSize: 18, fontFamily: 'monospace'))),
            ],
          ]),
        ),
      );
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: danger, content: Text(apiErrorMessage(e))));
    }
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

  List<Widget> _fieldRows(BuildContext context, SchemaField f, Map<String, dynamic> data, List<String> secret) {
    final v = data[f.key];
    if (f.type == 'repeater') {
      final rows = (v as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
      return [
        Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 4), child: Align(alignment: Alignment.centerLeft, child: Text(f.label, style: const TextStyle(color: muted, fontSize: 12)))),
        for (final row in rows)
          Container(
            margin: const EdgeInsets.fromLTRB(12, 4, 12, 4),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(border: Border.all(color: context.pal.line), borderRadius: BorderRadius.circular(12)),
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
        subtitle: Text(hidden ? '🔒 Terenkripsi' : displayValue(v), style: TextStyle(fontSize: 14, color: hidden ? const Color(0xFF7C3AED) : context.pal.ink, fontWeight: FontWeight.w500)),
      ),
    ];
  }
}
