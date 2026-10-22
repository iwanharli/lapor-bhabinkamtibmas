import 'package:flutter/material.dart';

const brand = Color(0xFF1D4ED8);
const brandDeep = Color(0xFF1E3A8A);
const ink = Color(0xFF0F172A);
const muted = Color(0xFF64748B);
const line = Color(0xFFE2E8F0);
const surface = Colors.white;
const bg = Color(0xFFF3F6FA);
const danger = Color(0xFFDC2626);
const success = Color(0xFF16A34A);
const warn = Color(0xFFD97706);

ThemeData appTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: brand, primary: brand, surface: surface);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    appBarTheme: const AppBarTheme(backgroundColor: surface, foregroundColor: ink, elevation: 0, scrolledUnderElevation: 0.5, centerTitle: false),
    cardTheme: CardThemeData(
      color: surface, elevation: 0, margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: line)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: surface, isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: line)),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? brand : surface),
        foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.white : ink),
        side: const WidgetStatePropertyAll(BorderSide(color: line)),
        shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: surface,
      side: const BorderSide(color: line),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(99)),
      labelStyle: const TextStyle(fontSize: 12, color: ink),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    ),
  );
}
