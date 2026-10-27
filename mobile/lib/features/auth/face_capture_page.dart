import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/responsive.dart';
import '../../core/ui/theme.dart';

/// Verifikasi wajah: [faceToken] terisi = langkah 2 login; kosong = pendaftaran wajah (orientasi pengguna baru).
/// Dua foto kamera depan: menghadap lurus, lalu menoleh sedikit — uji kehidupan diperiksa server.
class FaceCapturePage extends ConsumerStatefulWidget {
  const FaceCapturePage({super.key, this.faceToken});
  final String? faceToken;

  @override
  ConsumerState<FaceCapturePage> createState() => _FaceCapturePageState();
}

class _FaceCapturePageState extends ConsumerState<FaceCapturePage> {
  XFile? _frontal;
  XFile? _turned;
  bool _busy = false;
  String? _error;

  bool get _login => widget.faceToken != null;

  Future<void> _take(bool frontal) async {
    final f = await ImagePicker().pickImage(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front, maxWidth: 1280, maxHeight: 1280, imageQuality: 85);
    if (f == null) return;
    setState(() {
      if (frontal) {
        _frontal = f;
      } else {
        _turned = f;
      }
      _error = null;
    });
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = ref.read(authControllerProvider.notifier);
    try {
      if (_login) {
        await auth.faceLogin(widget.faceToken!, _frontal!.path, _turned!.path);
      } else {
        await auth.enrollFace(_frontal!.path, _turned!.path);
      }
      // Router mengarahkan ke beranda / langkah orientasi berikutnya sesuai status akun.
    } catch (e) {
      final expired = e.toString().contains('FACE_SESSION_EXPIRED');
      setState(() => _error = apiErrorMessage(e));
      if (expired && mounted) context.go('/login');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ready = _frontal != null && _turned != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(_login ? 'Verifikasi wajah' : 'Daftarkan wajah'),
        actions: [
          TextButton(
            onPressed: _busy ? null : () => _login ? context.go('/login') : ref.read(authControllerProvider.notifier).logout(),
            child: Text(_login ? 'Batal' : 'Keluar'),
          ),
        ],
      ),
      body: ListView(padding: contentPadding(context, top: 16, bottom: 32), children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: brand.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(14)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.face_retouching_natural, color: brand),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                _login
                    ? 'Untuk keamanan, cocokkan wajah Anda dengan yang terdaftar. Ambil dua foto dengan kamera depan.'
                    : 'Langkah terakhir: daftarkan wajah Anda. Wajah akan dicocokkan setiap kali masuk. Yang disimpan hanya sidik wajah terenkripsi, bukan fotonya.',
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 16),
        CardColumns(minItemWidth: 260, spacing: 12, children: [
          _Shot(step: 1, title: 'Hadap lurus ke kamera', hint: 'Wajah di tengah, cahaya cukup, tanpa masker/kacamata hitam.', file: _frontal, onTap: _busy ? null : () => _take(true)),
          _Shot(step: 2, title: 'Toleh sedikit ke kiri atau kanan', hint: 'Putar kepala ±30°, wajah tetap terlihat.', file: _turned, onTap: _busy ? null : () => _take(false)),
        ]),
        if (_error != null)
          Container(
            margin: const EdgeInsets.only(top: 14),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: danger.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              const Icon(Icons.error_outline, color: danger, size: 20),
              const SizedBox(width: 8),
              Expanded(child: Text(_error!, style: const TextStyle(color: danger, fontSize: 13))),
            ]),
          ),
        const SizedBox(height: 18),
        FilledButton.icon(
          onPressed: ready && !_busy ? _submit : null,
          icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.verified_user_outlined),
          label: Text(_busy ? 'Mencocokkan wajah…' : _login ? 'Verifikasi & masuk' : 'Simpan wajah'),
        ),
      ]),
    );
  }
}

class _Shot extends StatelessWidget {
  const _Shot({required this.step, required this.title, required this.hint, required this.file, required this.onTap});
  final int step;
  final String title, hint;
  final XFile? file;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                CircleAvatar(radius: 12, backgroundColor: file != null ? success : brand, child: file != null ? const Icon(Icons.check, size: 14, color: Colors.white) : Text('$step', style: const TextStyle(fontSize: 12, color: Colors.white))),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700))),
              ]),
              const SizedBox(height: 4),
              Text(hint, style: const TextStyle(fontSize: 12, color: muted)),
              const SizedBox(height: 10),
              AspectRatio(
                aspectRatio: 3 / 4,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: file != null
                      ? Image.file(File(file!.path), fit: BoxFit.cover)
                      : Container(
                          color: brand.withValues(alpha: 0.06),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Icon(step == 1 ? Icons.face : Icons.face_6, size: 48, color: brand.withValues(alpha: 0.6)),
                            const SizedBox(height: 6),
                            const Text('Ketuk untuk foto', style: TextStyle(color: brand, fontSize: 12)),
                          ]),
                        ),
                ),
              ),
              if (file != null) const Padding(padding: EdgeInsets.only(top: 6), child: Text('Ketuk untuk mengulang', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: muted))),
            ]),
          ),
        ),
      );
}
