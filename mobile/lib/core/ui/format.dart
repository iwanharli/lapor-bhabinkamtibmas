import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Kategori laporan: label & ikon (selaras web).
class Category {
  const Category(this.key, this.label, this.icon, this.color);
  final String key;
  final String label;
  final IconData icon;
  final Color color;
}

const categories = <Category>[
  Category('SAMBANG', 'Sambang / DDS', Icons.groups_rounded, Color(0xFF2563EB)),
  Category('DETEKSI_DINI', 'Deteksi Dini', Icons.radar_rounded, Color(0xFFDC2626)),
  Category('PROBLEM_SOLVING', 'Problem Solving', Icons.handshake_rounded, Color(0xFFD97706)),
  Category('HARGA_PANGAN', 'Harga Pangan', Icons.shopping_basket_rounded, Color(0xFF0891B2)),
  Category('MAPPING_KK', 'Mapping Data Keluarga', Icons.home_rounded, Color(0xFF64748B)),
  Category('KETAHANAN_PANGAN', 'Ketahanan Pangan', Icons.eco_rounded, Color(0xFF16A34A)),
  Category('PENYULUHAN', 'Penyuluhan', Icons.campaign_rounded, Color(0xFF7C3AED)),
];

Category categoryOf(String key) => categories.firstWhere((c) => c.key == key, orElse: () => categories.first);

final _dateTime = DateFormat('d MMM yyyy, HH.mm', 'id_ID');
final _date = DateFormat('EEEE, d MMMM yyyy', 'id_ID');
final _time = DateFormat('HH.mm', 'id_ID');

String tanggalJam(String iso) => _dateTime.format(DateTime.parse(iso).toLocal());
String tanggalPanjang(DateTime d) => _date.format(d);
String jam(String iso) => _time.format(DateTime.parse(iso).toLocal());

String relatif(String iso) {
  final d = DateTime.now().difference(DateTime.parse(iso).toLocal());
  if (d.inMinutes < 1) return 'baru saja';
  if (d.inMinutes < 60) return '${d.inMinutes} menit lalu';
  if (d.inHours < 24) return '${d.inHours} jam lalu';
  if (d.inDays < 30) return '${d.inDays} hari lalu';
  return tanggalJam(iso);
}

String jarak(num m) => m >= 1000 ? '${(m / 1000).toStringAsFixed(1).replaceAll('.', ',')} km' : '${m.round()} m';
String rupiah(num v) => 'Rp ${NumberFormat.decimalPattern('id_ID').format(v)}';

/// Nilai isian untuk ditampilkan (tanggal YYYY-MM-DD → panjang, daftar → koma).
String displayValue(Object? v) {
  if (v == null) return '—';
  if (v is List) return v.join(', ');
  final s = v.toString();
  if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(s)) return DateFormat('d MMMM yyyy', 'id_ID').format(DateTime.parse(s));
  return s;
}
