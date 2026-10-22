import 'package:flutter/material.dart';

const brand = Color(0xFF1D4ED8);
const brandDeep = Color(0xFF1E3A8A);
const danger = Color(0xFFDC2626);
const success = Color(0xFF16A34A);
const warn = Color(0xFFD97706);
/// Teks sekunder: abu-abu menengah yang tetap terbaca di latar terang maupun gelap.
const muted = Color(0xFF7A879A);

// Warna terang (dipakai juga sebagai bawaan bila konteks tak tersedia).
const ink = Color(0xFF0F172A);
const line = Color(0xFFE2E8F0);
const surface = Colors.white;
const bg = Color(0xFFF3F6FA);

/// Palet sesuai mode terang/gelap: `context.pal.surface` dst.
class Palette {
  const Palette({required this.ink, required this.line, required this.surface, required this.bg, required this.subtle});
  final Color ink;
  final Color line;
  final Color surface;
  final Color bg;
  /// Latar lembut untuk kotak di dalam kartu (sel statistik, baris belang).
  final Color subtle;

  static const light = Palette(ink: Color(0xFF0F172A), line: Color(0xFFE2E8F0), surface: Colors.white, bg: Color(0xFFF3F6FA), subtle: Color(0xFFF1F5F9));
  static const dark = Palette(ink: Color(0xFFE2E8F0), line: Color(0xFF243049), surface: Color(0xFF111A2E), bg: Color(0xFF0A1120), subtle: Color(0xFF17223A));
}

extension PaletteX on BuildContext {
  Palette get pal => Theme.of(this).brightness == Brightness.dark ? Palette.dark : Palette.light;
}

ThemeData appTheme(Brightness brightness) {
  final p = brightness == Brightness.dark ? Palette.dark : Palette.light;
  final scheme = ColorScheme.fromSeed(seedColor: brand, brightness: brightness, primary: brightness == Brightness.dark ? const Color(0xFF60A5FA) : brand, surface: p.surface);
  final border = OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: p.line));
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: p.bg,
    dividerColor: p.line,
    appBarTheme: AppBarTheme(backgroundColor: p.surface, foregroundColor: p.ink, elevation: 0, scrolledUnderElevation: 0.5, centerTitle: false),
    cardTheme: CardThemeData(
      color: p.surface, elevation: 0, margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: p.line)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: p.surface, isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: border, enabledBorder: border,
    ),
    bottomAppBarTheme: BottomAppBarThemeData(color: p.surface),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: p.surface),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? brand : p.surface),
        foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.white : p.ink),
        side: WidgetStatePropertyAll(BorderSide(color: p.line)),
        shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: p.surface,
      side: BorderSide(color: p.line),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(99)),
      labelStyle: TextStyle(fontSize: 12, color: p.ink),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(backgroundColor: brand, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: BorderSide(color: p.line), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    ),
  );
}
