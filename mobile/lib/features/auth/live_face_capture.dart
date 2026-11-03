import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../../core/ui/theme.dart';

enum _Step { position, blink, turn, done }

/// Perekaman wajah langsung (seperti aplikasi perbankan): video kamera depan dengan bingkai oval, dianalisis di HP
/// oleh ML Kit. Urutan: wajah lurus di dalam oval → foto 1 otomatis → kedipkan mata → toleh → foto 2 otomatis.
/// Kedua foto tetap diverifikasi ulang di server (pemutus akhir).
class LiveFaceCapture extends StatefulWidget {
  const LiveFaceCapture({super.key, required this.onCaptured, required this.onUnavailable});

  /// Dipanggil setelah dua foto didapat; galat dilempar balik agar perekaman bisa diulang.
  final Future<void> Function(XFile frontal, XFile turned) onCaptured;

  /// Kamera/ML Kit tidak tersedia (izin ditolak, perangkat tidak mendukung): tampilkan cara manual.
  final void Function(String reason) onUnavailable;

  @override
  State<LiveFaceCapture> createState() => _LiveFaceCaptureState();
}

class _LiveFaceCaptureState extends State<LiveFaceCapture> {
  CameraController? _cam;
  final _detector = FaceDetector(options: FaceDetectorOptions(enableClassification: true, performanceMode: FaceDetectorMode.fast, minFaceSize: 0.2));
  _Step _step = _Step.position;
  String _hint = 'Menyiapkan kamera…';
  bool _ok = false;
  bool _processing = false;
  bool _capturing = false;
  bool _sending = false;
  DateTime? _stableSince;
  bool _closedSeen = false;
  XFile? _frontal;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      final cams = await availableCameras();
      final front = cams.firstWhere((c) => c.lensDirection == CameraLensDirection.front, orElse: () => cams.first);
      final cam = CameraController(front, ResolutionPreset.medium, enableAudio: false, imageFormatGroup: Platform.isAndroid ? ImageFormatGroup.nv21 : ImageFormatGroup.bgra8888);
      await cam.initialize();
      if (!mounted) return await cam.dispose();
      setState(() => _cam = cam);
      await cam.startImageStream(_onFrame);
      _say('Posisikan wajah di dalam oval');
    } catch (e) {
      widget.onUnavailable(e is CameraException && e.code.contains('Denied') ? 'Izin kamera ditolak. Izinkan kamera di pengaturan aplikasi.' : 'Kamera langsung tidak tersedia di perangkat ini.');
    }
  }

  @override
  void dispose() {
    _cam?.dispose();
    _detector.close();
    super.dispose();
  }

  void _say(String hint, {bool ok = false}) {
    if (mounted && (hint != _hint || ok != _ok)) setState(() => (_hint = hint, _ok = ok));
  }

  InputImage? _toInput(CameraImage img) {
    final rotation = InputImageRotationValue.fromRawValue(_cam!.description.sensorOrientation);
    final format = InputImageFormatValue.fromRawValue(img.format.raw);
    if (rotation == null || format == null || img.planes.isEmpty) return null;
    return InputImage.fromBytes(
      bytes: img.planes.first.bytes,
      metadata: InputImageMetadata(size: Size(img.width.toDouble(), img.height.toDouble()), rotation: rotation, format: format, bytesPerRow: img.planes.first.bytesPerRow),
    );
  }

  Future<void> _onFrame(CameraImage img) async {
    if (_processing || _capturing || _sending || _step == _Step.done) return;
    _processing = true;
    try {
      final input = _toInput(img);
      if (input == null) return;
      final faces = await _detector.processImage(input);
      // Ukuran gambar setelah diputar sesuai orientasi sensor (portrait: lebar & tinggi tertukar).
      final rotated = _cam!.description.sensorOrientation % 180 != 0;
      final w = (rotated ? img.height : img.width).toDouble(), h = (rotated ? img.width : img.height).toDouble();
      await _evaluate(faces, w, h);
    } catch (_) {
      // satu bingkai gagal dianalisis: abaikan, tunggu bingkai berikutnya
    } finally {
      _processing = false;
    }
  }

  Future<void> _evaluate(List<Face> faces, double w, double h) async {
    if (faces.isEmpty) {
      _stableSince = null;
      return _say(_step == _Step.turn ? 'Toleh sedikit, wajah tetap terlihat' : 'Arahkan wajah ke kamera');
    }
    if (faces.length > 1) {
      _stableSince = null;
      return _say('Pastikan hanya satu wajah yang terlihat');
    }
    final f = faces.first;
    final cx = f.boundingBox.center.dx / w, cy = f.boundingBox.center.dy / h, size = f.boundingBox.width / w;
    final yaw = f.headEulerAngleY ?? 0;
    final eyes = [f.leftEyeOpenProbability, f.rightEyeOpenProbability];

    switch (_step) {
      case _Step.position:
        if (size < 0.32) return _ready(false, 'Dekatkan wajah ke kamera');
        if (size > 0.85) return _ready(false, 'Jauhkan sedikit wajah dari kamera');
        if ((cx - 0.5).abs() > 0.15 || (cy - 0.45).abs() > 0.2) return _ready(false, 'Posisikan wajah di tengah oval');
        if (yaw.abs() > 12) return _ready(false, 'Hadapkan wajah lurus ke kamera');
        if (eyes.any((e) => e != null && e < 0.5)) return _ready(false, 'Buka mata Anda');
        _ready(true, 'Tahan sebentar…');
        if (_stableSince != null && DateTime.now().difference(_stableSince!) > const Duration(milliseconds: 700)) {
          _frontal = await _shoot();
          if (_frontal != null) _go(_Step.blink, 'Kedipkan mata Anda');
        }
      case _Step.blink:
        if (eyes.every((e) => e != null && e < 0.25)) _closedSeen = true;
        if (_closedSeen && eyes.every((e) => e != null && e > 0.6)) _go(_Step.turn, 'Toleh perlahan ke kiri atau kanan');
      case _Step.turn:
        if (yaw.abs() < 22) return _say('Toleh perlahan ke kiri atau kanan');
        final turned = await _shoot();
        if (turned == null) {
          final cam = _cam;
          if (cam != null && !cam.value.isStreamingImages) unawaited(cam.startImageStream(_onFrame));
          return;
        }
        _go(_Step.done, 'Mencocokkan wajah…', ok: true);
        await _submit(turned);
      case _Step.done:
        break;
    }
  }

  void _ready(bool ok, String hint) {
    if (!ok) _stableSince = null;
    if (ok) _stableSince ??= DateTime.now();
    _say(hint, ok: ok);
  }

  void _go(_Step step, String hint, {bool ok = false}) {
    if (!mounted) return;
    setState(() {
      _step = step;
      _hint = hint;
      _ok = ok;
      _stableSince = null;
    });
  }

  /// Ambil foto resolusi penuh: hentikan analisis video sejenak, potret, lalu lanjutkan.
  Future<XFile?> _shoot() async {
    final cam = _cam;
    if (cam == null || _capturing) return null;
    _capturing = true;
    try {
      await cam.stopImageStream();
      return await cam.takePicture();
    } catch (_) {
      return null;
    } finally {
      _capturing = false;
      if (mounted && _step != _Step.turn && !cam.value.isStreamingImages) unawaited(cam.startImageStream(_onFrame));
    }
  }

  Future<void> _submit(XFile turned) async {
    setState(() => _sending = true);
    try {
      await widget.onCaptured(_frontal!, turned);
    } catch (_) {
      // Ditolak server: ulangi dari awal (pesan galat ditampilkan oleh halaman induk).
      if (!mounted) return;
      _capturing = false;
      _closedSeen = false;
      _frontal = null;
      _go(_Step.position, 'Ulangi: posisikan wajah di dalam oval');
      final cam = _cam;
      if (cam != null && !cam.value.isStreamingImages) unawaited(cam.startImageStream(_onFrame));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cam = _cam;
    final color = _ok ? success : Colors.white;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AspectRatio(
        aspectRatio: 3 / 4,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: ColoredBox(
            color: Colors.black,
            child: cam == null || !cam.value.isInitialized
                ? const Center(child: CircularProgressIndicator(color: Colors.white))
                : Stack(fit: StackFit.expand, children: [
                    FittedBox(
                      fit: BoxFit.cover,
                      child: SizedBox(width: cam.value.previewSize!.height, height: cam.value.previewSize!.width, child: CameraPreview(cam)),
                    ),
                    CustomPaint(painter: _OvalMask(color: color)),
                    Positioned(
                      left: 16, right: 16, top: 16,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(14)),
                        child: Row(children: [
                          if (_sending) const Padding(padding: EdgeInsets.only(right: 10), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))),
                          Expanded(child: Text(_hint, textAlign: TextAlign.center, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 15))),
                        ]),
                      ),
                    ),
                  ]),
          ),
        ),
      ),
      const SizedBox(height: 14),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        for (final (i, label) in [(0, 'Lurus'), (1, 'Kedip'), (2, 'Toleh')]) ...[
          if (i > 0) Container(width: 28, height: 2, color: _step.index > i - 1 ? success : muted.withValues(alpha: 0.3)),
          _Dot(label: label, done: _step.index > i, active: _step.index == i),
        ],
      ]),
    ]);
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.label, required this.done, required this.active});
  final String label;
  final bool done, active;

  @override
  Widget build(BuildContext context) => Column(mainAxisSize: MainAxisSize.min, children: [
        CircleAvatar(
          radius: 13,
          backgroundColor: done ? success : active ? brand : muted.withValues(alpha: 0.25),
          child: Icon(done ? Icons.check : Icons.circle, size: done ? 15 : 7, color: Colors.white),
        ),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 11, fontWeight: active ? FontWeight.w700 : FontWeight.w500, color: active ? brand : muted)),
      ]);
}

/// Lapisan gelap dengan lubang oval di tengah; garis oval hijau saat posisi wajah sudah tepat.
class _OvalMask extends CustomPainter {
  _OvalMask({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final oval = Rect.fromCenter(center: Offset(size.width / 2, size.height * 0.47), width: size.width * 0.66, height: size.height * 0.62);
    final mask = Path()
      ..fillType = PathFillType.evenOdd
      ..addRect(Offset.zero & size)
      ..addOval(oval);
    canvas.drawPath(mask, Paint()..color = Colors.black.withValues(alpha: 0.5));
    canvas.drawOval(oval, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..color = color);
  }

  @override
  bool shouldRepaint(_OvalMask old) => old.color != color;
}
