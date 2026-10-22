import 'package:flutter/material.dart';

import '../../core/ui/theme.dart';

/// Layar pembuka selama sesi login dicek (menyambung splash bawaan Android yang berwarna sama).
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(gradient: LinearGradient(colors: [brandDeep, brand], begin: Alignment.topCenter, end: Alignment.bottomCenter)),
        child: SafeArea(
          child: Column(children: [
            const Spacer(flex: 3),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.85, end: 1),
              duration: const Duration(milliseconds: 600),
              curve: Curves.easeOutBack,
              builder: (_, v, child) => Transform.scale(scale: v, child: child),
              child: Image.asset('assets/logo.png', height: 132),
            ),
            const SizedBox(height: 20),
            const Text('Lapor Bhabinkamtibmas', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 0.2)),
            const SizedBox(height: 4),
            Text('Pelaporan kegiatan & absensi lapangan', style: TextStyle(color: Colors.white.withValues(alpha: 0.75))),
            const Spacer(flex: 2),
            SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white.withValues(alpha: 0.85))),
            const SizedBox(height: 14),
            Text('Baharkam Polri', style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12)),
            const SizedBox(height: 24),
          ]),
        ),
      ),
    );
  }
}
