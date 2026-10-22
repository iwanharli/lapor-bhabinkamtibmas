import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_controller.dart';
import '../features/attendance/attendance_page.dart';
import '../features/auth/change_password_page.dart';
import '../features/auth/login_page.dart';
import '../features/home/home_page.dart';
import '../features/notifications/notifications_page.dart';
import '../features/profile/profile_page.dart';
import '../features/reports/category_picker_page.dart';
import '../features/reports/report_detail_page.dart';
import '../features/reports/report_form_page.dart';
import '../features/reports/report_list_page.dart';
import '../features/shell/app_shell.dart';
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
      if (me == null) return loc == '/login' ? null : '/login';
      if (loc == '/splash') return '/';
      if (me.mustChangePassword) return loc == '/ganti-sandi' ? null : '/ganti-sandi';
      if (loc == '/login' || loc == '/splash') return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/ganti-sandi', builder: (_, __) => const ChangePasswordPage()),
      ShellRoute(
        builder: (_, state, child) => AppShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const HomePage()),
          GoRoute(path: '/laporan', builder: (_, __) => const ReportListPage()),
          GoRoute(path: '/absensi', builder: (_, __) => const AttendancePage()),
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
