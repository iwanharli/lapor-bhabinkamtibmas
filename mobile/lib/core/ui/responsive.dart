import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Mulai lebar ini (dp) tampilan dianggap lebar: tablet (portrait ±600–900 dp) atau ponsel lipat.
const wideBreakpoint = 600.0;

/// Lebar maksimum isi berbentuk formulir/profil agar baris tidak terlalu panjang di tablet.
const maxContentWidth = 720.0;

bool isWide(BuildContext context) => MediaQuery.sizeOf(context).width >= wideBreakpoint;

/// Padding ListView yang menaruh isi selebar [maxContentWidth] di tengah layar lebar (di HP tetap 16).
EdgeInsets contentPadding(BuildContext context, {double top = 16, double bottom = 16}) {
  final side = math.max(16.0, (MediaQuery.sizeOf(context).width - maxContentWidth) / 2);
  return EdgeInsets.fromLTRB(side, top, side, bottom);
}

/// Kartu berjajar: satu kolom di HP, 2–3 kolom di tablet (sesuai [minItemWidth]); kartu sebaris sama tinggi.
class CardColumns extends StatelessWidget {
  const CardColumns({super.key, required this.children, this.minItemWidth = 340, this.spacing = 8});

  final List<Widget> children;
  final double minItemWidth;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final n = (c.maxWidth / minItemWidth).floor().clamp(1, 3);
      final rows = <Widget>[];
      for (var i = 0; i < children.length; i += n) {
        final cells = [
          for (var j = i; j < i + n; j++) Expanded(child: j < children.length ? children[j] : const SizedBox.shrink()),
        ];
        rows.add(n == 1
            ? children[i]
            : IntrinsicHeight(
                child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  for (var k = 0; k < cells.length; k++) ...[if (k > 0) SizedBox(width: spacing), cells[k]],
                ]),
              ));
      }
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < rows.length; i++) ...[if (i > 0) SizedBox(height: spacing), rows[i]],
      ]);
    });
  }
}
