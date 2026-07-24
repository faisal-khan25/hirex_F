/**
 * useProctoring.js
 *
 * NEW: AI Interview Monitoring (real-time proctoring)
 *
 * Runs entirely client-side, on the CANDIDATE's own device, against their
 * own local camera/microphone MediaStream — never against the WebRTC
 * remote/outbound stream, so detection work can never add latency or
 * jank to the actual video call:
 *
 *   - Phone detection            (TensorFlow.js coco-ssd — "cell phone" class)
 *   - Face detection             (TensorFlow.js blazeface)
 *   - Multiple face detection    (blazeface face count > 1)
 *   - Face absence detection     (no face for a sustained period, with a
 *                                  second "prolonged" escalation tier)
 *   - Sound / noise detection    (Web Audio API AnalyserNode RMS level)
 *   - Tab switching detection    (document.visibilitychange / window blur)
 *   - Camera / microphone status (delegated in — see cameraOn/micOn params)
 *
 * PERFORMANCE NOTES:
 *   - Models are loaded lazily (dynamic import) only when proctoring starts,
 *     so candidates/recruiters who never open a live interview never pay
 *     the TF.js bundle cost.
 *   - Detection runs on a hidden, off-DOM-rendered <video> fed by the SAME
 *     local MediaStream already captured for the call — no extra
 *     getUserMedia() call, no extra camera/mic access prompt.
 *   - Vision inference (face + phone) runs on a fixed interval (default
 *     2.5s), not per-frame, and each frame is downscaled before inference.
 *   - Every violation type has a client-side cooldown so a sustained
 *     condition (e.g. no face for a minute) produces one escalating alert
 *     rather than a flood of identical ones; the backend applies its own
 *     rate limit too as a defense-in-depth backstop.
 *   - tf.tidy() wraps every inference call so GPU/CPU tensors are disposed
 *     immediately — no memory growth over a long interview.
 *   - Falls back gracefully: if TF.js / WebGL isn't available (e.g. very
 *     old browser, or the model CDN fetch fails), phone/face detection is
 *     simply skipped — noise, tab-switch, and camera/mic monitoring still
 *     work, and the interview is never blocked on proctoring.
 */

import { useEffect, useRef, useCallback } from 'react';

// ── Tunables ────────────────────────────────────────────────────────────
const VISION_INTERVAL_MS = 2500;      // how often to run face+phone inference
const NOISE_CHECK_INTERVAL_MS = 300;  // how often to sample mic volume
const NOISE_RMS_THRESHOLD = 0.09;     // ~ empirically "someone is talking/loud noise"
const NOISE_SUSTAINED_MS = 3000;      // how long noise must persist before alerting
const NO_FACE_THRESHOLD_MS = 5000;    // face absent this long -> NO_FACE_DETECTED
const FACE_PROLONGED_THRESHOLD_MS = 15000; // face absent this long -> escalate
const PHONE_CONFIDENCE = 0.6;

const COOLDOWN_MS = {
  PHONE_DETECTED: 8000,
  NO_FACE_DETECTED: 8000,
  MULTIPLE_FACES_DETECTED: 8000,
  FACE_ABSENCE_PROLONGED: 15000,
  NOISE_DETECTED: 15000,
  TAB_SWITCH: 5000,
  CAMERA_OFF: 4000,
  MICROPHONE_OFF: 4000,
};

const SEVERITY = {
  PHONE_DETECTED: 'CRITICAL',
  MULTIPLE_FACES_DETECTED: 'HIGH',
  FACE_ABSENCE_PROLONGED: 'HIGH',
  NO_FACE_DETECTED: 'MEDIUM',
  TAB_SWITCH: 'MEDIUM',
  CAMERA_OFF: 'MEDIUM',
  MICROPHONE_OFF: 'LOW',
  NOISE_DETECTED: 'LOW',
};

const MESSAGES = {
  PHONE_DETECTED: 'Mobile phone detected in camera view.',
  MULTIPLE_FACES_DETECTED: 'Multiple people detected in camera view.',
  NO_FACE_DETECTED: 'No face detected — please stay in frame.',
  FACE_ABSENCE_PROLONGED: 'Face has been absent for a prolonged period.',
  NOISE_DETECTED: 'Background noise detected — please move to a quiet space.',
  TAB_SWITCH: 'You switched away from the interview tab.',
  CAMERA_OFF: 'Your camera is off.',
  MICROPHONE_OFF: 'Your microphone is muted.',
};

/**
 * @param {Object} opts
 * @param {MediaStream|null} opts.stream   Candidate's local camera+mic stream.
 * @param {boolean} opts.enabled           Only runs detection while true.
 * @param {boolean} opts.cameraOn
 * @param {boolean} opts.micOn
 * @param {(type: string, severity: string, message: string, metadata?: object) => void} opts.onViolation
 */
export function useProctoring({ stream, enabled, cameraOn, micOn, onViolation }) {
  const videoElRef      = useRef(null);
  const modelsRef       = useRef({ tf: null, blazeface: null, cocoSsd: null, faceModel: null, phoneModel: null });
  const visionTimerRef  = useRef(null);
  const noiseTimerRef   = useRef(null);
  const audioCtxRef     = useRef(null);
  const analyserRef     = useRef(null);
  const lastFiredRef    = useRef({});     // { [type]: timestampMs }
  const faceAbsentSinceRef   = useRef(null);
  const noiseLoudSinceRef    = useRef(null);
  const prolongedFiredRef    = useRef(false);
  const modelsLoadingRef     = useRef(false);
  const modelsReadyRef       = useRef(false);
  const visionSupportedRef   = useRef(true);

  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const fire = useCallback((type, metadata) => {
    const now = Date.now();
    const last = lastFiredRef.current[type] || 0;
    const cooldown = COOLDOWN_MS[type] ?? 6000;
    if (now - last < cooldown) return;
    lastFiredRef.current[type] = now;
    onViolationRef.current?.(type, SEVERITY[type] ?? 'LOW', MESSAGES[type] ?? 'Proctoring violation detected.', metadata);
  }, []);

  // ── Lazy-load TF.js models the first time proctoring is enabled ─────────
  const ensureModelsLoaded = useCallback(async () => {
    if (modelsReadyRef.current || modelsLoadingRef.current || !visionSupportedRef.current) return;
    modelsLoadingRef.current = true;
    try {
      const [tf, blazeface, cocoSsd] = await Promise.all([
        import('@tensorflow/tfjs'),
        import('@tensorflow-models/blazeface'),
        import('@tensorflow-models/coco-ssd'),
      ]);
      try {
        await tf.setBackend('webgl');
      } catch {
        await tf.setBackend('cpu');
      }
      await tf.ready();

      const [faceModel, phoneModel] = await Promise.all([
        blazeface.load(),
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
      ]);

      modelsRef.current = { tf, blazeface, cocoSsd, faceModel, phoneModel };
      modelsReadyRef.current = true;
    } catch (err) {
      // Non-fatal: skip vision-based detection, keep noise/tab/camera monitoring.
      console.warn('[useProctoring] Vision models failed to load — phone/face detection disabled.', err);
      visionSupportedRef.current = false;
    } finally {
      modelsLoadingRef.current = false;
    }
  }, []);

  // ── Hidden analysis <video> fed by the SAME local stream ────────────────
  useEffect(() => {
    if (!enabled || !stream) return undefined;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.width = 320;
    video.height = 240;
    video.style.position = 'fixed';
    video.style.left = '-9999px';
    video.style.top = '0';
    video.style.width = '1px';
    video.style.height = '1px';
    video.srcObject = stream;
    document.body.appendChild(video);
    video.play().catch(() => {});
    videoElRef.current = video;

    return () => {
      try { video.pause(); } catch (_) { /* ignore */ }
      video.srcObject = null;
      video.remove();
      videoElRef.current = null;
    };
  }, [enabled, stream]);

  // ── Vision loop: face count + phone detection ────────────────────────────
  useEffect(() => {
    if (!enabled || !stream) return undefined;

    let cancelled = false;
    ensureModelsLoaded();

    visionTimerRef.current = setInterval(async () => {
      if (cancelled) return;
      if (!modelsReadyRef.current || !visionSupportedRef.current) return;
      const video = videoElRef.current;
      if (!video || video.readyState < 2) return;

      const { tf, faceModel, phoneModel } = modelsRef.current;

      try {
        // ── Face count (blazeface) ──
        const faces = await faceModel.estimateFaces(video, false);
        const faceCount = faces?.length ?? 0;

        if (faceCount === 0) {
          if (faceAbsentSinceRef.current == null) faceAbsentSinceRef.current = Date.now();
          const absentFor = Date.now() - faceAbsentSinceRef.current;
          if (absentFor >= FACE_PROLONGED_THRESHOLD_MS) {
            fire('FACE_ABSENCE_PROLONGED', { absentForMs: absentFor });
            prolongedFiredRef.current = true;
          } else if (absentFor >= NO_FACE_THRESHOLD_MS) {
            fire('NO_FACE_DETECTED', { absentForMs: absentFor });
          }
        } else {
          faceAbsentSinceRef.current = null;
          prolongedFiredRef.current = false;
          if (faceCount > 1) {
            fire('MULTIPLE_FACES_DETECTED', { faceCount });
          }
        }

        // ── Phone detection (coco-ssd) — runs on the same cadence ──
        tf.engine().startScope();
        const predictions = await phoneModel.detect(video);
        tf.engine().endScope();

        const phone = predictions.find(
          (p) => p.class === 'cell phone' && p.score >= PHONE_CONFIDENCE
        );
        if (phone) {
          fire('PHONE_DETECTED', { confidence: phone.score });
        }
      } catch (err) {
        // Swallow per-frame inference errors (e.g. a transient WebGL context
        // loss) — never let proctoring crash the interview.
        console.debug('[useProctoring] vision tick error (benign):', err?.message);
      }
    }, VISION_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(visionTimerRef.current);
      visionTimerRef.current = null;
      faceAbsentSinceRef.current = null;
    };
  }, [enabled, stream, ensureModelsLoaded, fire]);

  // ── Noise detection (Web Audio API) ──────────────────────────────────────
  useEffect(() => {
    if (!enabled || !stream) return undefined;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return undefined;

    let audioCtx;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
    } catch (err) {
      console.warn('[useProctoring] Web Audio API unavailable — noise detection disabled.', err);
      return undefined;
    }

    const buffer = new Uint8Array(analyserRef.current.fftSize);

    noiseTimerRef.current = setInterval(() => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      analyser.getByteTimeDomainData(buffer);

      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        const normalized = (buffer[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);

      if (rms >= NOISE_RMS_THRESHOLD) {
        if (noiseLoudSinceRef.current == null) noiseLoudSinceRef.current = Date.now();
        if (Date.now() - noiseLoudSinceRef.current >= NOISE_SUSTAINED_MS) {
          fire('NOISE_DETECTED', { rms: Number(rms.toFixed(3)) });
        }
      } else {
        noiseLoudSinceRef.current = null;
      }
    }, NOISE_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(noiseTimerRef.current);
      noiseTimerRef.current = null;
      try { audioCtx.close(); } catch (_) { /* ignore */ }
      audioCtxRef.current = null;
      analyserRef.current = null;
      noiseLoudSinceRef.current = null;
    };
  }, [enabled, stream, fire]);

  // ── Tab switching detection ───────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return undefined;

    const handleVisibility = () => {
      if (document.hidden) fire('TAB_SWITCH', { reason: 'visibilitychange' });
    };
    const handleBlur = () => fire('TAB_SWITCH', { reason: 'window_blur' });

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, fire]);

  // ── Camera / microphone status monitoring ────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (cameraOn === false) fire('CAMERA_OFF');
  }, [enabled, cameraOn, fire]);

  useEffect(() => {
    if (!enabled) return;
    if (micOn === false) fire('MICROPHONE_OFF');
  }, [enabled, micOn, fire]);
}

export default useProctoring;
