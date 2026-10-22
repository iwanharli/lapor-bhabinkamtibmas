import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/theme.dart';

/// Wajib saat login pertama (sandi awal dari admin), juga bisa dibuka dari Profil.
class ChangePasswordPage extends ConsumerStatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  ConsumerState<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends ConsumerState<ChangePasswordPage> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _again = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).changePassword(_current.text, _next.text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Kata sandi berhasil diganti')));
        if (Navigator.of(context).canPop()) Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final forced = ref.watch(authControllerProvider).valueOrNull?.mustChangePassword ?? false;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ganti kata sandi'),
        automaticallyImplyLeading: !forced,
        actions: [if (forced) TextButton(onPressed: () => ref.read(authControllerProvider.notifier).logout(), child: const Text('Keluar'))],
      ),
      body: Form(
        key: _formKey,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          if (forced)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(color: warn.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
              child: const Text('Anda masih memakai kata sandi awal. Ganti dulu sebelum memakai aplikasi.'),
            ),
          TextFormField(
            controller: _current, obscureText: true,
            decoration: const InputDecoration(labelText: 'Kata sandi saat ini'),
            validator: (v) => (v == null || v.isEmpty) ? 'Wajib diisi' : null,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _next, obscureText: true,
            decoration: const InputDecoration(labelText: 'Kata sandi baru', helperText: 'Minimal 10 karakter, berisi huruf dan angka'),
            validator: (v) => (v == null || v.length < 10 || !RegExp(r'[A-Za-z]').hasMatch(v) || !RegExp(r'\d').hasMatch(v))
                ? 'Minimal 10 karakter, berisi huruf dan angka' : null,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _again, obscureText: true,
            decoration: const InputDecoration(labelText: 'Ulangi kata sandi baru'),
            validator: (v) => v != _next.text ? 'Tidak sama dengan kata sandi baru' : null,
          ),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(_error!, style: const TextStyle(color: danger))),
          const SizedBox(height: 22),
          FilledButton(onPressed: _loading ? null : _submit, child: Text(_loading ? 'Menyimpan…' : 'Simpan kata sandi')),
        ]),
      ),
    );
  }
}
