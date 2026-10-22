import 'package:flutter/material.dart';

import 'theme.dart';

/// Kotak abu-abu yang berdenyut lembut sebagai pengganti konten yang sedang dimuat.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({super.key, this.width, this.height = 14, this.radius = 8});
  final double? width;
  final double height;
  final double radius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = context.pal.line;
    return FadeTransition(
      opacity: Tween(begin: 0.45, end: 1.0).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)),
      child: Container(width: widget.width, height: widget.height, decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(widget.radius))),
    );
  }
}

/// Kerangka kartu laporan (ikon bulat + dua baris teks + lencana).
class SkeletonTile extends StatelessWidget {
  const SkeletonTile({super.key});

  @override
  Widget build(BuildContext context) => const Card(
        child: Padding(
          padding: EdgeInsets.all(12),
          child: Row(children: [
            SkeletonBox(width: 40, height: 40, radius: 20),
            SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SkeletonBox(width: 150, height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: 110, height: 11),
                SizedBox(height: 8),
                SkeletonBox(width: 64, height: 16, radius: 99),
              ]),
            ),
          ]),
        ),
      );
}

/// Daftar kerangka untuk layar daftar.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 5, this.padding = const EdgeInsets.all(16)});
  final int count;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => ListView.separated(
        padding: padding, physics: const NeverScrollableScrollPhysics(), shrinkWrap: true,
        itemCount: count, separatorBuilder: (_, __) => const SizedBox(height: 8), itemBuilder: (_, __) => const SkeletonTile(),
      );
}

/// Kerangka halaman detail: blok judul + beberapa kartu baris.
class SkeletonDetail extends StatelessWidget {
  const SkeletonDetail({super.key});

  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
        const SkeletonBox(height: 76, radius: 16),
        const SizedBox(height: 12),
        for (var i = 0; i < 4; i++) ...[
          const Card(
            child: Padding(
              padding: EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SkeletonBox(width: 90, height: 11),
                SizedBox(height: 8),
                SkeletonBox(height: 15),
                SizedBox(height: 6),
                SkeletonBox(width: 180, height: 15),
              ]),
            ),
          ),
          const SizedBox(height: 10),
        ],
      ]);
}
