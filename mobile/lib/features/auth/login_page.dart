import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../app/config.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/theme.dart';

/// Akun Bhabin demo (Polda Metro Jaya), satu per kabupaten/kota.
const _demoPassword = 'BrsDemo2026';
const _demoBhabin = [
  ('31010005', 'Aipda Iwan Wijaya', 'Pulau Harapan · Kepulauan Seribu'),
  ('31710005', 'Aiptu Rina Siregar', 'Gambir · Jakarta Pusat'),
  ('31720005', 'Aiptu Agus Mahendra', 'Kamal Muara · Jakarta Utara'),
  ('31730005', 'Brigpol Teuku Wibowo', 'Duri Kosambi · Jakarta Barat'),
  ('31740005', 'Aipda Dedi Pratama', 'Menteng Dalam · Jakarta Selatan'),
  ('31750005', 'Brigpol Ketut Sitompul', 'Utan Kayu Selatan · Jakarta Timur'),
];

final _appVersion = FutureProvider((_) async => (await PackageInfo.fromPlatform()).version);

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _nrp = TextEditingController();
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  bool _show = false;
  String? _error;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).login(_nrp.text.trim(), _password.text);
    } catch (e) {
      setState(() => _error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Pilih akun Bhabin demo → isi NRP & sandi lalu langsung masuk.
  Future<void> _pickDemo() async {
    final nrp = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 4),
            child: Text('Login cepat Bhabin (demo)', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text('Pilih akun untuk langsung masuk. Sandi semua akun: $_demoPassword', style: TextStyle(color: muted, fontSize: 12.5)),
          ),
          for (final (nrp, nama, desa) in _demoBhabin)
            ListTile(
              leading: CircleAvatar(backgroundColor: success.withValues(alpha: 0.12), child: const Icon(Icons.local_police_outlined, color: success)),
              title: Text(nama, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('$desa · $nrp'),
              trailing: const Icon(Icons.arrow_forward, size: 18),
              onTap: () => Navigator.pop(ctx, nrp),
            ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (nrp == null) return;
    _nrp.text = nrp;
    _password.text = _demoPassword;
    await _submit();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(colors: [brandDeep, brand], begin: Alignment.topLeft, end: Alignment.bottomRight)),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                Image.asset('assets/logo.png', height: 110),
                const SizedBox(height: 12),
                const Text('Lapor Bhabinkamtibmas', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                const Text('Pelaporan kegiatan & absensi lapangan', style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 28),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Form(
                      key: _formKey,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        TextFormField(
                          controller: _nrp,
                          keyboardType: TextInputType.number,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(labelText: 'NRP', prefixIcon: Icon(Icons.badge_outlined)),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'NRP wajib diisi' : null,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _password,
                          obscureText: !_show,
                          decoration: InputDecoration(
                            labelText: 'Kata sandi',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(icon: Icon(_show ? Icons.visibility_off : Icons.visibility), onPressed: () => setState(() => _show = !_show)),
                          ),
                          validator: (v) => (v == null || v.isEmpty) ? 'Kata sandi wajib diisi' : null,
                          onFieldSubmitted: (_) => _submit(),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(color: danger.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)),
                            child: Text(_error!, style: const TextStyle(color: danger)),
                          ),
                        ],
                        const SizedBox(height: 20),
                        FilledButton(onPressed: _loading ? null : _submit, child: Text(_loading ? 'Memproses…' : 'Masuk')),
                      ]),
                    ),
                  ),
                ),
                if (demoLogin) ...[
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    onPressed: _loading ? null : _pickDemo,
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white54), shape: const StadiumBorder()),
                    icon: const Icon(Icons.bolt, size: 18),
                    label: const Text('Login cepat Bhabin (demo)'),
                  ),
                ],
                const SizedBox(height: 18),
                Text('Versi ${ref.watch(_appVersion).valueOrNull ?? '-'}${demoLogin ? ' · demo' : ''}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
