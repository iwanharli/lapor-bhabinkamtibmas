'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, cn, ErrorText } from '@/components/ui';

type Step = 'lurus' | 'kedip' | 'toleh' | 'kirim';
const STEPS: { key: Step; label: string }[] = [{ key: 'lurus', label: 'Lurus' }, { key: 'kedip', label: 'Kedip' }, { key: 'toleh', label: 'Toleh' }];

/** Aset MediaPipe disimpan sendiri (public/mediapipe): jaringan internal bisa memblokir CDN. */
const ASSETS = '/mediapipe';
const FRONTAL_MAX = 0.2;
const TURNED_MIN = 0.5;

/** Perekaman wajah langsung: lurus → kedip → toleh, foto diambil otomatis. Keputusan akhir tetap di server. Tanpa detektor: dua foto manual. */
export function LiveFaceCapture({ onCaptured }: { onCaptured: (frontal: Blob, turned: Blob) => Promise<void> }) {
  const video = useRef<HTMLVideoElement>(null);
  const state = useRef<{ step: Step; frontal?: Blob; closed: boolean; stable: number }>({ step: 'lurus', closed: false, stable: 0 });
  const callback = useRef(onCaptured);
  callback.current = onCaptured;
  const [step, setStep] = useState<Step>('lurus');
  const [hint, setHint] = useState('Menyiapkan kamera…');
  const [ok, setOk] = useState(false);
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState(false);
  const [fatal, setFatal] = useState('');
  const [error, setError] = useState('');

  const go = useCallback((next: Step) => {
    state.current.step = next;
    setStep(next);
  }, []);

  const snap = useCallback(() => new Promise<Blob>((resolve, reject) => {
    const v = video.current!;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')!.drawImage(v, 0, 0);
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal mengambil foto'))), 'image/jpeg', 0.9);
  }), []);

  const restart = useCallback(() => {
    state.current = { step: 'lurus', closed: false, stable: 0 };
    go('lurus');
  }, [go]);

  const submit = useCallback(async (turned: Blob) => {
    go('kirim');
    setHint('Mencocokkan wajah…');
    setError('');
    try {
      await callback.current(state.current.frontal!, turned);
    } catch (e) {
      setError((e as Error).message);
      restart();
    }
  }, [go, restart]);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    let landmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => { faceLandmarks: { x: number; y: number }[][]; faceBlendshapes: { categories: { categoryName: string; score: number }[] }[] }; close: () => void } | undefined;

    const evaluate = async (now: number) => {
      const s = state.current;
      const v = video.current;
      if (stopped || !v || !landmarker || s.step === 'kirim' || v.readyState < 2) return;
      const res = landmarker.detectForVideo(v, now);
      const faces = res.faceLandmarks;
      if (faces.length !== 1) {
        s.stable = 0;
        setOk(false);
        return setHint(faces.length ? 'Pastikan hanya satu wajah yang terlihat' : 'Arahkan wajah ke kamera');
      }
      const f = faces[0];
      const left = f[234], right = f[454], nose = f[1];
      const width = Math.abs(right.x - left.x);
      const yaw = Math.abs((nose.x - (left.x + right.x) / 2) / (width / 2));
      const score = (name: string) => res.faceBlendshapes[0]?.categories.find((c) => c.categoryName === name)?.score ?? 0;
      const blink = Math.min(score('eyeBlinkLeft'), score('eyeBlinkRight'));

      if (s.step === 'lurus') {
        const cx = (left.x + right.x) / 2;
        const good = width >= 0.22 && width <= 0.8 && Math.abs(cx - 0.5) <= 0.15 && yaw <= FRONTAL_MAX && blink < 0.4;
        setOk(good);
        if (!good) {
          s.stable = 0;
          return setHint(width < 0.22 ? 'Dekatkan wajah ke kamera' : width > 0.8 ? 'Jauhkan sedikit wajah' : Math.abs(cx - 0.5) > 0.15 ? 'Posisikan wajah di tengah oval' : blink >= 0.4 ? 'Buka mata Anda' : 'Hadapkan wajah lurus ke kamera');
        }
        setHint('Tahan sebentar…');
        s.stable ||= now;
        if (now - s.stable > 700) {
          s.frontal = await snap();
          go('kedip');
          setOk(false);
          setHint('Kedipkan mata Anda');
        }
      } else if (s.step === 'kedip') {
        if (blink > 0.5) s.closed = true;
        if (s.closed && blink < 0.25) {
          go('toleh');
          setHint('Toleh perlahan ke kiri atau kanan');
        }
      } else if (s.step === 'toleh' && yaw >= TURNED_MIN) {
        setOk(true);
        await submit(await snap());
      }
    };

    const loop = async () => {
      if (stopped) return;
      try {
        await evaluate(performance.now());
      } catch {
        // satu bingkai gagal dianalisis: tunggu bingkai berikutnya
      }
      raf = requestAnimationFrame(loop);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      } catch (e) {
        return setFatal((e as Error).name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu muat ulang halaman.' : 'Kamera tidak dapat dibuka. Pastikan perangkat punya kamera dan halaman memakai HTTPS.');
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      video.current!.srcObject = stream;
      await video.current!.play().catch(() => undefined);
      setReady(true);
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const files = await FilesetResolver.forVisionTasks(ASSETS);
        landmarker = await FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: `${ASSETS}/face_landmarker.task` }, runningMode: 'VIDEO', numFaces: 2, outputFaceBlendshapes: true,
        }) as unknown as typeof landmarker;
        if (stopped) return landmarker?.close();
        setHint('Posisikan wajah di dalam oval');
        loop();
      } catch {
        setManual(true);
        setHint('Ambil dua foto secara manual');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
    };
  }, [go, snap, submit]);

  async function manualShot() {
    const blob = await snap();
    if (!state.current.frontal) {
      state.current.frontal = blob;
      go('toleh');
      return setHint('Toleh ke kiri atau kanan, lalu ambil foto kedua');
    }
    await submit(blob);
    if (state.current.step === 'lurus') setHint('Ulangi: hadap lurus, lalu ambil foto');
  }

  if (fatal) return <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{fatal}</p>;
  const index = STEPS.findIndex((x) => x.key === step);
  const sending = step === 'kirim';

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black sm:aspect-[4/3]">
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <defs><mask id="oval-mask"><rect width="100" height="100" fill="white" /><ellipse cx="50" cy="47" rx="30" ry="38" fill="black" /></mask></defs>
          <rect width="100" height="100" fill="black" fillOpacity="0.5" mask="url(#oval-mask)" />
          <ellipse cx="50" cy="47" rx="30" ry="38" fill="none" stroke={ok ? '#4ade80' : '#fff'} strokeWidth="0.8" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
        </svg>
        <p role="status" className={cn('absolute inset-x-4 top-3 flex items-center justify-center gap-2 rounded-xl bg-black/60 px-3 py-2 text-center text-sm font-semibold', ok ? 'text-green-400' : 'text-white')}>
          {(!ready || sending) && <Loader2 size={15} className="animate-spin" />}{hint}
        </p>
      </div>
      {manual ? (
        <Button className="w-full" icon={<Camera size={16} />} disabled={!ready || sending} onClick={manualShot}>{state.current.frontal ? 'Ambil foto kedua (menoleh)' : 'Ambil foto pertama (lurus)'}</Button>
      ) : (
        <ol className="flex items-center justify-center gap-2 text-xs">
          {STEPS.map((x, i) => (
            <li key={x.key} className={cn('rounded-full px-3 py-1 font-medium', sending || i < index ? 'bg-success-soft text-success' : i === index ? 'bg-primary text-white' : 'bg-bg text-muted')}>{i + 1}. {x.label}</li>
          ))}
        </ol>
      )}
      <ErrorText>{error}</ErrorText>
      <p className="text-center text-xs text-muted">Yang disimpan hanya sidik wajah terenkripsi, bukan fotonya.</p>
    </div>
  );
}
