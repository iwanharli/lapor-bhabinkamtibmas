import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../app/config.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/theme.dart';
import '../auth/change_password_page.dart';

final _profileProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final res = await ref.read(dioProvider).get('/auth/profile');
  return Map<String, dynamic>.from(res.data);
});
final _versionProvider = FutureProvider((_) async => (await PackageInfo.fromPlatform()).version);

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  Future<void> _edit(BuildContext context, WidgetRef ref, Map<String, dynamic> p) async {
    final pangkat = TextEditingController(text: p['pangkat'] ?? '');
    final jabatan = TextEditingController(text: p['jabatan'] ?? '');
    final phone = TextEditingController(text: p['phone'] ?? '');
    final ok = await showModalBottomSheet<bool>(
      context: context, isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Ubah data pribadi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 14),
          TextField(controller: pangkat, decoration: const InputDecoration(labelText: 'Pangkat')),
          const SizedBox(height: 12),
          TextField(controller: jabatan, decoration: const InputDecoration(labelText: 'Jabatan')),
          const SizedBox(height: 12),
          TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'No. HP / WhatsApp', hintText: '08xxxxxxxxxx')),
          const SizedBox(height: 18),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Simpan')),
        ]),
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).patch('/auth/profile', data: {'pangkat': pangkat.text.trim(), 'jabatan': jabatan.text.trim(), 'phone': phone.text.trim()});
      ref.invalidate(_profileProvider);
      await ref.read(authControllerProvider.notifier).refreshMe();
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: danger, content: Text(apiErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(_profileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profil saya')),
      body: profile.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(apiErrorMessage(e))),
        data: (p) {
          final desa = ((p['villages'] as List?) ?? []).cast<Map>().where((v) => v['until'] == null).firstOrNull?['village'] as Map?;
          final missing = [if ((p['pangkat'] ?? '') == '') 'pangkat', if ((p['jabatan'] ?? '') == '') 'jabatan', if ((p['phone'] ?? '') == '') 'No. HP'];
          String initials(String n) => n.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0]).join().toUpperCase();
          return ListView(padding: const EdgeInsets.all(16), children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(children: [
                  CircleAvatar(radius: 36, backgroundColor: brand, child: Text(initials(p['nama']), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700))),
                  const SizedBox(height: 10),
                  if ((p['pangkat'] ?? '') != '') Text(p['pangkat'], style: const TextStyle(color: brand, fontWeight: FontWeight.w600, letterSpacing: 1)),
                  Text(p['nama'], style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                  Text('NRP ${p['nrp']} · ${p['unit']['nama']}', style: const TextStyle(color: muted)),
                ]),
              ),
            ),
            if (missing.isNotEmpty) ...[
              const SizedBox(height: 10),
              Card(
                color: danger.withValues(alpha: 0.06),
                child: ListTile(
                  leading: const Icon(Icons.error_outline, color: danger),
                  title: Text('Belum diisi: ${missing.join(', ')}', style: const TextStyle(color: danger, fontWeight: FontWeight.w600)),
                  trailing: const Icon(Icons.edit_outlined, color: danger),
                  onTap: () => _edit(context, ref, p),
                ),
              ),
            ],
            const SizedBox(height: 10),
            Card(
              child: Column(children: [
                ListTile(leading: const Icon(Icons.badge_outlined), title: const Text('Jabatan'), subtitle: Text((p['jabatan'] ?? '') == '' ? 'Belum diisi' : p['jabatan'])),
                ListTile(leading: const Icon(Icons.phone_outlined), title: const Text('No. HP'), subtitle: Text((p['phone'] ?? '') == '' ? 'Belum diisi' : p['phone'])),
                if (desa != null) ListTile(leading: const Icon(Icons.place_outlined), title: Text('Desa ${desa['nama']}'), subtitle: Text('${RegExp(r'^kec', caseSensitive: false).hasMatch(desa['kecamatan'] ?? '') ? desa['kecamatan'] : 'Kec. ${desa['kecamatan']}'}, ${desa['kabupaten']}')),
                ListTile(leading: const Icon(Icons.edit_outlined), title: const Text('Ubah data pribadi'), trailing: const Icon(Icons.chevron_right), onTap: () => _edit(context, ref, p)),
              ]),
            ),
            const SizedBox(height: 10),
            Card(
              child: Column(children: [
                ListTile(
                  leading: const Icon(Icons.key_outlined), title: const Text('Ganti kata sandi'), trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChangePasswordPage())),
                ),
                ListTile(leading: const Icon(Icons.info_outline), title: const Text('Versi aplikasi'), subtitle: Text('${ref.watch(_versionProvider).valueOrNull ?? '—'} · $apiUrl')),
                ListTile(
                  leading: const Icon(Icons.logout, color: danger), title: const Text('Keluar', style: TextStyle(color: danger)),
                  onTap: () async {
                    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
                      title: const Text('Keluar dari aplikasi?'),
                      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Keluar'))],
                    ));
                    if (ok == true) await ref.read(authControllerProvider.notifier).logout();
                  },
                ),
              ]),
            ),
            const SizedBox(height: 80),
          ]);
        },
      ),
    );
  }
}
