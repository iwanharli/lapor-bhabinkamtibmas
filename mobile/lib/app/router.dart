import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_controller.dart';
import '../features/attendance/attendance_page.dart';
import '../features/auth/change_password_page.dart';
import '../features/auth/face_capture_page.dart';
import '../features/auth/login_page.dart';
import '../features/auth/profile_setup_page.dart';
import '../features/home/home_page.dart';
import '../features/notifications/notifications_page.dart';
import '../features/profile/profile_page.dart';
import '../features/reports/category_picker_page.dart';
import '../features/reports/report_detail_page.dart';
import '../features/reports/report_form_page.dart';
import '../features/reports/report_list_page.dart';
import '../features/shell/app_shell.dart';
import '../features/stats/stats_page.dart';
import '../features/splash/splash_page.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);
  return GoRouter(
    initialLocation: '/',
    redirect: (_, state) {
      final loc = state.matchedLocation;
      // Sesi sedang dicek (aplikasi baru dibuka): tampilkan layar pembuka.
      if (auth.isLoading && auth.valueOrNull == null) return loc == '/splash' ? null : '/splash';
      final me = auth.valueOrNull;
      // Belum masuk: login, atau langkah 2 (verifikasi wajah) dengan token sementara.
      if (me == null) return loc == '/login' || loc == '/verifikasi-wajah' ? null : '/login';
      if (loc == '/splash') return '/';
      // Orientasi berurutan: ganti sandi sementara → lengkapi profil → daftarkan wajah.
      if (me.mustChangePassword) return loc == '/ganti-sandi' ? null : '/ganti-sandi';
      if (me.needsProfile) return loc == '/lengkapi-profil' ? null : '/lengkapi-profil';
      if (me.needsFace) return loc == '/daftar-wajah' ? null : '/daftar-wajah';
      if (const {'/login', '/splash', '/verifikasi-wajah', '/lengkapi-profil', '/daftar-wajah'}.contains(loc)) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/ganti-sandi', builder: (_, __) => const ChangePasswordPage()),
      GoRoute(path: '/lengkapi-profil', builder: (_, __) => const ProfileSetupPage()),
      GoRoute(path: '/daftar-wajah', builder: (_, __) => const FaceCapturePage()),
      GoRoute(path: '/verifikasi-wajah', builder: (_, s) => FaceCapturePage(faceToken: s.extra as String?)),
      ShellRoute(
        builder: (_, state, child) => AppShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const HomePage()),
          GoRoute(path: '/laporan', builder: (_, __) => const ReportListPage()),
          GoRoute(path: '/absensi', builder: (_, __) => const AttendancePage()),
          GoRoute(path: '/statistik', builder: (_, __) => const StatsPage()),
          GoRoute(path: '/profil', builder: (_, __) => const ProfilePage()),
        ],
      ),
      GoRoute(path: '/lapor', builder: (_, __) => const CategoryPickerPage()),
      GoRoute(path: '/notifikasi', builder: (_, __) => const NotificationsPage()),
      GoRoute(
        path: '/lapor/:category',
        builder: (_, s) => ReportFormPage(category: s.pathParameters['category']!, reportId: s.uri.queryParameters['id']),
      ),
      GoRoute(path: '/laporan/:id', builder: (_, s) => ReportDetailPage(id: s.pathParameters['id']!)),
    ],
  );
});
