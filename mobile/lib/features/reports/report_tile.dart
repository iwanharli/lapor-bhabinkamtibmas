import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/ui/format.dart';
import '../../core/ui/theme.dart';
import 'report_api.dart';

class ReportTile extends StatelessWidget {
  const ReportTile(this.r, {super.key});
  final ReportItem r;

  @override
  Widget build(BuildContext context) {
    final c = categoryOf(r.category);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/laporan/${r.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            CircleAvatar(backgroundColor: c.color.withValues(alpha: 0.12), child: Icon(c.icon, color: c.color, size: 20)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(c.label, style: const TextStyle(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
                  if (r.priority) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(color: danger, borderRadius: BorderRadius.circular(99)),
                      child: const Text('PRIORITAS', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ]),
                Text('${r.desa} · ${relatif(r.occurredAt)}', style: const TextStyle(color: muted, fontSize: 12)),
                const SizedBox(height: 4),
                Row(children: [
                  statusChip(r),
                  if (r.flagged) ...[const SizedBox(width: 8), const Icon(Icons.wrong_location_outlined, size: 14, color: warn), const Text(' lokasi', style: TextStyle(fontSize: 11, color: warn))],
                  if (r.attachments > 0) ...[const SizedBox(width: 8), const Icon(Icons.photo_outlined, size: 14, color: muted), Text(' ${r.attachments}', style: const TextStyle(fontSize: 11, color: muted))],
                ]),
              ]),
            ),
            const Icon(Icons.chevron_right, color: muted),
          ]),
        ),
      ),
    );
  }
}
