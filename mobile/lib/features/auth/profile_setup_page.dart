import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/responsive.dart';
import '../../core/ui/theme.dart';

final _phone = RegExp(r'^(\+?62|0)8\d{7,12}$');

/// Orientasi pengguna baru: seluruh data profil wajib dilengkapi sebelum memakai aplikasi.
class ProfileSetupPage extends ConsumerStatefulWidget {
  const ProfileSetupPage({super.key});

  @override
  ConsumerState<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends ConsumerState<ProfileSetupPage> {
  final _form = GlobalKey<FormState>();
  late final _nama = TextEditingController(text: _me?.json['nama'] as String?);
  late final _pangkat = TextEditingController(text: _me?.json['pangkat'] as String?);
  late final _jabatan = TextEditingController(text: _me?.json['jabatan'] as String?);
  late final _hp = TextEditingController(text: _me?.json['phone'] as String?);
  bool _busy = false;
  String? _error;

  Me? get _me => ref.read(authControllerProvider).valueOrNull;

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(dioProvider).patch('/auth/profile', data: {
        'nama': _nama.text.trim(), 'pangkat': _pangkat.text.trim(), 'jabatan': _jabatan.text.trim(), 'phone': _hp.text.trim(),
      });
      await ref.read(authControllerProvider.notifier).renewSession();
    } catch (e) {
      setState(() => _error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _required(String? v) => (v == null || v.trim().isEmpty) ? 'Wajib diisi' : null;

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(authControllerProvider).valueOrNull;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lengkapi profil'),
        automaticallyImplyLeading: false,
        actions: [TextButton(onPressed: () => ref.read(authControllerProvider.notifier).logout(), child: const Text('Keluar'))],
      ),
      body: Form(
        key: _form,
        child: ListView(padding: contentPadding(context, top: 16, bottom: 32), children: [
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(color: brand.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
            child: Text('Halo${me != null ? ', ${me.nama}' : ''}. Lengkapi seluruh data profil Anda sebelum memakai aplikasi. NRP ${me?.nrp ?? ''} · ${me?.unitNama ?? ''}.'),
          ),
          TextFormField(controller: _nama, decoration: const InputDecoration(labelText: 'Nama lengkap'), validator: _required, textCapitalization: TextCapitalization.words),
          const SizedBox(height: 14),
          TextFormField(controller: _pangkat, decoration: const InputDecoration(labelText: 'Pangkat', hintText: 'mis. Bripka'), validator: _required),
          const SizedBox(height: 14),
          TextFormField(controller: _jabatan, decoration: const InputDecoration(labelText: 'Jabatan', hintText: 'mis. Bhabinkamtibmas Desa Selong'), validator: _required),
          const SizedBox(height: 14),
          TextFormField(
            controller: _hp, keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'No. HP / WhatsApp', hintText: '08xxxxxxxxxx'),
            validator: (v) => _required(v) ?? (_phone.hasMatch(v!.trim()) ? null : 'Nomor tidak valid (mis. 0812xxxxxxxx)'),
          ),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(_error!, style: const TextStyle(color: danger))),
          const SizedBox(height: 22),
          FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Menyimpan…' : 'Simpan & lanjut')),
        ]),
      ),
    );
  }
}
