import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/location/tracker.dart';
import '../../core/ui/theme.dart';

/// Kerangka utama: navigasi bawah + tombol Lapor di tengah (selaras tampilan web Bhabin).
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.location, required this.child});
  final String location;
  final Widget child;

  static const _tabs = [
    ('/', Icons.home_outlined, Icons.home_rounded, 'Beranda'),
    ('/laporan', Icons.assignment_outlined, Icons.assignment_rounded, 'Laporan'),
    ('/absensi', Icons.how_to_reg_outlined, Icons.how_to_reg_rounded, 'Absensi'),
    ('/profil', Icons.person_outline, Icons.person_rounded, 'Profil'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(trackerProvider); // pelacakan jam dinas hidup selama sesi
    final index = _tabs.indexWhere((t) => t.$1 == location).clamp(0, _tabs.length - 1);
    return Scaffold(
      body: child,
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/lapor'),
        backgroundColor: brand, foregroundColor: Colors.white, shape: const CircleBorder(),
        tooltip: 'Lapor', child: const Icon(Icons.add, size: 30),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 6, height: 68, padding: EdgeInsets.zero,
        child: Row(children: [
          for (var i = 0; i < _tabs.length; i++) ...[
            if (i == 2) const SizedBox(width: 64),
            Expanded(
              child: InkWell(
                onTap: () => context.go(_tabs[i].$1),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(i == index ? _tabs[i].$3 : _tabs[i].$2, color: i == index ? brand : muted),
                  const SizedBox(height: 2),
                  Text(_tabs[i].$4, style: TextStyle(fontSize: 11, color: i == index ? brand : muted, fontWeight: i == index ? FontWeight.w600 : FontWeight.normal)),
                ]),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}
