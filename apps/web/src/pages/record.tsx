import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { apiClient } from "@/lib/api";

const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const WARN_DURATION_MS = 30 * 1000; // 30 seconds

type RecordState = "idle" | "recording" | "uploading" | "error";

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RecordPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [shortWarning, setShortWarning] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Start camera preview on mount
  useEffect(() => {
    let cancelled = false;
    async function startPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException
            ? err.name === "NotAllowedError"
              ? "Camera and microphone access was denied. Please allow access in your browser settings and reload."
              : err.name === "NotFoundError"
              ? "No camera or microphone found. Please connect a device and reload."
              : `Device error: ${err.message}`
            : "Could not access camera or microphone.";
        setDeviceError(msg);
      }
    }
    startPreview();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setShortWarning(false);
    setUploadError(null);

    const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm;codecs=vp9,opus" });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = () => handleRecordingStop();

    mr.start(1000); // collect chunks every second
    startTimeRef.current = Date.now();
    setState("recording");

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsed(elapsed);
      if (elapsed >= MAX_DURATION_MS) {
        mr.stop();
      }
    }, 500);
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const handleRecordingStop = useCallback(async () => {
    const durationMs = Date.now() - startTimeRef.current;
    if (durationMs < WARN_DURATION_MS) {
      setShortWarning(true);
      setState("idle");
      return;
    }

    setState("uploading");
    setUploadError(null);

    try {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });

      // Create session and get pre-signed upload URL
      const { sessionId, uploadUrl } = await apiClient.sessions.create();

      // Upload directly to S3 via pre-signed URL
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "video/webm" },
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed with status ${uploadRes.status}`);
      }

      await router.push(`/sessions/${sessionId}/progress`);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setState("idle");
    }
  }, [router]);

  if (deviceError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full card text-center">
          <div className="text-4xl mb-4">📷</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Camera unavailable</h2>
          <p className="text-gray-600 text-sm mb-6">{deviceError}</p>
          <Link href="/dashboard" className="btn-secondary">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-white font-semibold text-lg">Record your Video CV</h1>
          <div className="w-24" />
        </div>

        {/* Camera preview */}
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-4">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Recording indicator */}
          {state === "recording" && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-mono">{formatTime(elapsed)}</span>
            </div>
          )}

          {/* 10-min cap warning */}
          {state === "recording" && elapsed >= MAX_DURATION_MS - 60_000 && (
            <div className="absolute top-4 right-4 bg-yellow-500 text-black text-xs font-semibold rounded-full px-3 py-1">
              {formatTime(MAX_DURATION_MS - elapsed)} left
            </div>
          )}

          {/* Uploading overlay */}
          {state === "uploading" && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-white font-medium">Uploading your recording…</p>
            </div>
          )}
        </div>

        {/* Warnings / errors */}
        {shortWarning && (
          <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            Your recording was under 30 seconds. Please record a longer video for best results.
          </div>
        )}
        {uploadError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {uploadError}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {state === "idle" && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-3 transition-colors"
            >
              <span className="w-3 h-3 rounded-full bg-white" />
              Start recording
            </button>
          )}

          {state === "recording" && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-full bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-3 transition-colors"
            >
              <span className="w-3 h-3 rounded bg-gray-900" />
              Stop recording
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-gray-400 text-xs">
          Maximum recording length: 10 minutes. Speak clearly about your experience, skills, and goals.
        </p>
      </div>
    </div>
  );
}
