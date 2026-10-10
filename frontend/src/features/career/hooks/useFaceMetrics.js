// Camera presence metrics with MediaPipe Face Landmarker, computed entirely in the browser.
// Video frames never leave the device: only three numbers are reported per answer
// (frames analysed, face-in-frame ratio, facing-camera ratio). No emotion or personality detection.
// MediaPipe is loaded from a CDN at runtime, so it needs internet the first time.
import { useCallback, useEffect, useRef, useState } from "react";

const VERSION = "0.10.14";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const SAMPLE_EVERY_MS = 200; // ~5 checks per second is enough and keeps CPU use low
const FACING_LIMIT = 0.2;    // max nose offset (relative to eye distance) to count as facing the camera

async function createLandmarker() {
  const vision = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numFaces: 1,
  });
  try {
    return await vision.FaceLandmarker.createFromOptions(files, options("GPU"));
  } catch {
    return vision.FaceLandmarker.createFromOptions(files, options("CPU"));
  }
}

/** Head turned left/right? Compares the nose tip with the midpoint between the outer eye corners. */
export function isFacingCamera(landmarks) {
  const rightEye = landmarks[33];
  const leftEye = landmarks[263];
  const nose = landmarks[1];
  const eyeDistance = Math.abs(leftEye.x - rightEye.x);
  if (eyeDistance < 1e-6) return false;
  const yaw = (nose.x - (leftEye.x + rightEye.x) / 2) / eyeDistance;
  return Math.abs(yaw) < FACING_LIMIT;
}

export default function useFaceMetrics(enabled) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("off"); // off | loading | ready | error
  const [error, setError] = useState("");
  const [live, setLive] = useState({ face: false, facing: false });
  const counts = useRef({ frames: 0, face: 0, facing: 0 });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let stream;
    let landmarker;
    let raf;
    let lastSample = 0;
    let lastTimestamp = 0;
    setStatus("loading");
    setError("");

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        landmarker = await createLandmarker();
        if (cancelled) return landmarker.close();
        setStatus("ready");

        const loop = (now) => {
          raf = requestAnimationFrame(loop);
          if (now - lastSample < SAMPLE_EVERY_MS || video.readyState < 2) return;
          lastSample = now;
          lastTimestamp = Math.max(now, lastTimestamp + 1); // MediaPipe needs increasing timestamps
          const landmarks = landmarker.detectForVideo(video, lastTimestamp).faceLandmarks?.[0];
          const face = !!landmarks;
          const facing = face && isFacingCamera(landmarks);
          counts.current.frames += 1;
          if (face) counts.current.face += 1;
          if (facing) counts.current.facing += 1;
          setLive((prev) => (prev.face === face && prev.facing === facing ? prev : { face, facing }));
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e?.name === "NotAllowedError"
          ? "Camera permission was denied."
          : "Camera or face detection could not start. Check the camera and internet connection.");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
      setStatus("off");
    };
  }, [enabled]);

  const resetCounts = useCallback(() => {
    counts.current = { frames: 0, face: 0, facing: 0 };
  }, []);

  /** Numbers sent with an answer (null if nothing was analysed). */
  const getMetrics = useCallback(() => {
    const { frames, face, facing } = counts.current;
    if (!frames) return null;
    return { frames_analyzed: frames, face_presence_ratio: face / frames, facing_camera_ratio: facing / frames };
  }, []);

  return { videoRef, status, error, live, resetCounts, getMetrics };
}
