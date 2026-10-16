/**
 * PoseTracker — real-time webcam pose detection using MediaPipe Pose.
 *
 * PRIVACY GUARANTEE:
 *  • Video is NEVER recorded, stored, uploaded or saved anywhere.
 *  • The <video> element has no controls and no download attribute.
 *  • The MediaRecorder API is intentionally NOT used.
 *  • All camera tracks are stopped immediately on unmount.
 *  • Only individual frames are sent to MediaPipe for landmark detection.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CameraOffIcon, ShieldCheckIcon } from 'lucide-react';

/* ─── MediaPipe CDN loader (loaded once, on demand) ─────────────────────── */
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404';

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

/* ─── Skeleton drawing helpers ────────────────────────────────────────────── */
const POSE_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
    [27, 29], [29, 31], [28, 30], [30, 32],
];

const JOINT_COLOR = '#22d3ee';
const BONE_COLOR = 'rgba(34,211,238,0.6)';
const DIM_COLOR = 'rgba(100,116,139,0.4)';

function drawSkeleton(ctx, landmarks, W, H) {
    if (!landmarks || landmarks.length === 0) return;
    ctx.clearRect(0, 0, W, H);

    // Draw connections (bones)
    POSE_CONNECTIONS.forEach(([a, b]) => {
        const pa = landmarks[a], pb = landmarks[b];
        if (!pa || !pb) return;
        const visible = pa.visibility > 0.4 && pb.visibility > 0.4;
        ctx.beginPath();
        ctx.moveTo(pa.x * W, pa.y * H);
        ctx.lineTo(pb.x * W, pb.y * H);
        ctx.strokeStyle = visible ? BONE_COLOR : DIM_COLOR;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
    });

    // Draw joints
    landmarks.forEach((lm) => {
        if (!lm) return;
        const visible = lm.visibility > 0.4;
        ctx.beginPath();
        ctx.arc(lm.x * W, lm.y * H, visible ? 4.5 : 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = visible ? JOINT_COLOR : DIM_COLOR;
        ctx.fill();
    });
}

/* ─── Joint angle calculator ─────────────────────────────────────────────── */
function calcAngle(a, b, c) {
    if (!a || !b || !c) return null;
    const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let deg = Math.abs(rad * 180 / Math.PI);
    if (deg > 180) deg = 360 - deg;
    return deg;
}

/* ─── Exercise-specific rep heuristics ──────────────────────────────────── */
// Returns { angle, upThreshold, downThreshold } given landmarks and exercise
function getRepConfig(lms, exerciseName) {
    const name = (exerciseName || '').toLowerCase();

    if (name.includes('push') || name.includes('press')) {
        // elbow angle: wrist-elbow-shoulder (right side: 16-14-12)
        return { angle: calcAngle(lms[16], lms[14], lms[12]), up: 160, down: 90 };
    }
    if (name.includes('squat') || name.includes('lunge')) {
        // knee angle: hip-knee-ankle (right: 24-26-28)
        return { angle: calcAngle(lms[24], lms[26], lms[28]), up: 160, down: 90 };
    }
    if (name.includes('curl') || name.includes('bicep')) {
        // elbow curl: shoulder-elbow-wrist (right: 12-14-16)
        return { angle: calcAngle(lms[12], lms[14], lms[16]), up: 160, down: 50 };
    }
    if (name.includes('shoulder') || name.includes('raise') || name.includes('row')) {
        // shoulder: elbow-shoulder-hip (right: 14-12-24)
        return { angle: calcAngle(lms[14], lms[12], lms[24]), up: 160, down: 70 };
    }
    if (name.includes('sit') || name.includes('crunch') || name.includes('ab')) {
        // hip angle: shoulder-hip-knee (right: 12-24-26)
        return { angle: calcAngle(lms[12], lms[24], lms[26]), up: 160, down: 80 };
    }
    // Default: generic move using right elbow
    return { angle: calcAngle(lms[16], lms[14], lms[12]), up: 155, down: 95 };
}

/* ─── Form quality detector ──────────────────────────────────────────────── */
function getFormStatus(landmarks) {
    if (!landmarks || landmarks.length === 0) return 'detecting';
    const keyJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26];
    const avgVis = keyJoints.reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0) / keyJoints.length;
    if (avgVis > 0.75) return 'good';
    if (avgVis > 0.45) return 'adjust';
    return 'detecting';
}

/* ─── Rep state machine ──────────────────────────────────────────────────── */
function useRepCounter() {
    const stateRef = useRef('up'); // 'up' | 'down'
    const [reps, setReps] = useState(0);

    const feed = useCallback((angle, upThr, downThr) => {
        if (angle === null) return;
        if (stateRef.current === 'up' && angle < downThr) {
            stateRef.current = 'down';
        } else if (stateRef.current === 'down' && angle > upThr) {
            stateRef.current = 'up';
            setReps((r) => r + 1);
        }
    }, []);

    const reset = useCallback(() => { stateRef.current = 'up'; setReps(0); }, []);
    return { reps, feed, reset };
}

/* ─── Main component ────────────────────────────────────────────────────── */
export function PoseTracker({ exerciseName = '' }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);     // MediaStream — stopped on unmount
    const poseRef = useRef(null);      // MediaPipe Pose instance
    const animRef = useRef(null);
    const exerciseNameRef = useRef(exerciseName);
    exerciseNameRef.current = exerciseName;

    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [errorMsg, setErrorMsg] = useState('');
    const [formStatus, setFormStatus] = useState('detecting');
    const { reps, feed, reset } = useRepCounter();

    /* Reset rep count when exercise changes */
    useEffect(() => { reset(); }, [exerciseName, reset]);

    /* ── Bootstrap MediaPipe ───────────────────────────────────────────────── */
    useEffect(() => {
        let cancelled = false;

        async function init() {
            try {
                /* 1. Load MediaPipe scripts from CDN */
                await loadScript(`${MEDIAPIPE_CDN}/pose.js`);

                if (cancelled) return;

                /* 2. Request camera — ONLY for live feed, never recorded */
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' },
                    audio: false,                  // no audio captured
                });
                if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
                streamRef.current = stream;

                const video = videoRef.current;
                video.srcObject = stream;
                // Prevent any accidental download / picture-in-picture
                video.disablePictureInPicture = true;
                await video.play();

                /* 3. Init MediaPipe Pose */
                const Pose = window.Pose;
                const pose = new Pose({
                    locateFile: (file) => `${MEDIAPIPE_CDN}/${file}`,
                });
                pose.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                pose.onResults((results) => {
                    if (cancelled) return;
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext('2d');
                    const lms = results.poseLandmarks || [];

                    drawSkeleton(ctx, lms, canvas.width, canvas.height);
                    setFormStatus(getFormStatus(lms));

                    if (lms.length > 0) {
                        const { angle, up, down } = getRepConfig(lms, exerciseNameRef.current);
                        feed(angle, up, down);
                    }
                });
                poseRef.current = pose;

                /* 4. Feed frames to MediaPipe via requestAnimationFrame */
                const tick = async () => {
                    if (cancelled) return;
                    if (video.readyState >= 2) {
                        await pose.send({ image: video });
                    }
                    animRef.current = requestAnimationFrame(tick);
                };
                animRef.current = requestAnimationFrame(tick);

                if (!cancelled) setStatus('ready');
            } catch (err) {
                if (cancelled) return;
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop());
                    streamRef.current = null;
                }
                if (videoRef.current) videoRef.current.srcObject = null;
                if (err.name === 'NotAllowedError') {
                    setErrorMsg('Camera permission denied. Please allow camera access and try again.');
                } else if (err.name === 'NotFoundError') {
                    setErrorMsg('No camera found on this device.');
                } else {
                    setErrorMsg('Could not start the camera. ' + err.message);
                }
                setStatus('error');
            }
        }

        init();

        /* Cleanup — ALWAYS stop camera on unmount */
        return () => {
            cancelled = true;
            if (animRef.current) cancelAnimationFrame(animRef.current);
            if (poseRef.current) poseRef.current.close?.();
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            if (videoRef.current) videoRef.current.srcObject = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Form chip colour ────────────────────────────────────────────────── */
    const formChip = {
        good: { label: '🟢 Good form', cls: 'bg-emerald-500/80 text-white' },
        adjust: { label: '🟡 Adjust position', cls: 'bg-amber-400/80 text-white' },
        detecting: { label: '⏳ Detecting…', cls: 'bg-slate-600/70 text-white' },
    }[formStatus];

    /* ── Render ──────────────────────────────────────────────────────────── */
    return (
        <div className="rounded-3xl overflow-hidden bg-[#0d1117] relative" style={{ minHeight: 280 }}>

            {/* Privacy notice strip */}
            <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-900/40 border-b border-emerald-700/30">
                <ShieldCheckIcon size={12} className="text-emerald-400 shrink-0" />
                <p className="text-[10px] font-semibold text-emerald-300 leading-none">
                    Camera is live only — no video is recorded or saved
                </p>
            </div>

            {/* Loading state */}
            <AnimatePresence>
                {status === 'loading' && (
                    <motion.div
                        initial={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0d1117]"
                    >
                        <div className="w-10 h-10 rounded-full border-4 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                        <p className="text-xs font-semibold text-slate-400">Starting camera & loading AI model…</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error state */}
            {status === 'error' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0d1117] p-6 text-center">
                    <CameraOffIcon size={32} className="text-slate-500" />
                    <p className="text-sm font-semibold text-slate-300">{errorMsg}</p>
                </div>
            )}

            {/* Webcam + canvas overlay */}
            <div className="relative" style={{ aspectRatio: '4/3' }}>
                {/* Live video — mirrored for natural selfie view. NO controls, NO recording. */}
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                    playsInline
                    muted
                    autoPlay
                    disablePictureInPicture
                // Explicitly no controls, no download, no loop
                />
                {/* Skeleton canvas — drawn over video, same mirror transform */}
                <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className="absolute inset-0 w-full h-full"
                    style={{ transform: 'scaleX(-1)' }}
                />

                {/* Overlays — only when ready */}
                {status === 'ready' && (
                    <>
                        {/* Rep counter — top left */}
                        <div className="absolute top-3 left-3 rounded-2xl bg-black/60 backdrop-blur px-3 py-2 flex flex-col items-center min-w-[56px]">
                            <span className="text-3xl font-extrabold text-white tabular-nums leading-none">{reps}</span>
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mt-0.5">Reps</span>
                        </div>

                        {/* Form chip — top right */}
                        <div className={`absolute top-3 right-3 rounded-full px-3 py-1 text-[11px] font-bold backdrop-blur ${formChip.cls}`}>
                            {formChip.label}
                        </div>

                        {/* Exercise name — bottom bar */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
                            <p className="text-xs font-bold text-white/80 uppercase tracking-widest truncate">
                                {exerciseName || 'Exercise'}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
