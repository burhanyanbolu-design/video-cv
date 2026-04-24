import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from "react-native-vision-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../navigation/AppNavigator";
import { apiClient } from "../lib/api";

type Props = NativeStackScreenProps<AppStackParamList, "Record">;

const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const WARN_DURATION_MS = 30 * 1000; // 30 seconds

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

type RecordState = "idle" | "recording" | "uploading";

export default function RecordScreen({ navigation }: Props) {
  const { hasPermission: hasCam, requestPermission: requestCam } = useCameraPermission();
  const { hasPermission: hasMic, requestPermission: requestMic } = useMicrophonePermission();
  const device = useCameraDevice("front");

  const cameraRef = useRef<Camera>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordingPathRef = useRef<string | null>(null);
  const handleRecordingStopRef = useRef<() => void>(() => {});

  const [state, setState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [shortWarning, setShortWarning] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Request permissions on mount
  useEffect(() => {
    async function checkPermissions() {
      let camOk = hasCam;
      let micOk = hasMic;
      if (!camOk) camOk = await requestCam();
      if (!micOk) micOk = await requestMic();
      if (!camOk || !micOk) {
        setDeviceError(
          "Camera and microphone access is required to record your Video CV. Please enable permissions in Settings."
        );
      } else {
        setPermissionsReady(true);
      }
    }
    checkPermissions();
  }, [hasCam, hasMic, requestCam, requestMic]);

  useEffect(() => {
    if (permissionsReady && !device) {
      setDeviceError("No camera found on this device.");
    }
  }, [permissionsReady, device]);

  const startRecording = useCallback(() => {
    if (!cameraRef.current) return;
    setShortWarning(false);
    setUploadError(null);
    startTimeRef.current = Date.now();
    setState("recording");

    cameraRef.current.startRecording({
      onRecordingFinished: (video) => {
        recordingPathRef.current = video.path;
        // handleRecordingStop is called via ref to avoid stale closure
        handleRecordingStopRef.current();
      },
      onRecordingError: (error) => {
        setState("idle");
        setUploadError(`Recording error: ${error.message}`);
      },
    });

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsed(elapsed);
      if (elapsed >= MAX_DURATION_MS) {
        cameraRef.current?.stopRecording();
      }
    }, 500);
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    cameraRef.current?.stopRecording();
  }, []);

  const handleRecordingStop = useCallback(async () => {
    const durationMs = Date.now() - startTimeRef.current;
    if (durationMs < WARN_DURATION_MS) {
      setShortWarning(true);
      setState("idle");
      setElapsed(0);
      return;
    }

    const path = recordingPathRef.current;
    if (!path) {
      setState("idle");
      return;
    }

    setState("uploading");
    setUploadError(null);

    try {
      // Create session and get pre-signed upload URL
      const { sessionId, uploadUrl } = await apiClient.sessions.create();

      // Read the file and upload to S3 via pre-signed URL
      const fileUri = path.startsWith("file://") ? path : `file://${path}`;
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4" },
        body: await (await fetch(fileUri)).blob(),
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed with status ${uploadRes.status}`);
      }

      navigation.replace("Progress", { sessionId });
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
      setState("idle");
    }
  }, [navigation]);

  // Keep ref in sync so startRecording's closure can call the latest version
  handleRecordingStopRef.current = handleRecordingStop;

  if (deviceError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>📷</Text>
        <Text style={styles.errorTitle}>Camera unavailable</Text>
        <Text style={styles.errorMessage}>{deviceError}</Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permissionsReady || !device) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Requesting camera access…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera preview */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={state !== "uploading"}
        video
        audio
      />

      {/* Recording indicator overlay */}
      {state === "recording" && (
        <View style={styles.recordingBadge}>
          <View style={styles.recordingDot} />
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        </View>
      )}

      {/* Time-cap warning */}
      {state === "recording" && elapsed >= MAX_DURATION_MS - 60_000 && (
        <View style={styles.capWarning}>
          <Text style={styles.capWarningText}>
            {formatTime(MAX_DURATION_MS - elapsed)} left
          </Text>
        </View>
      )}

      {/* Uploading overlay */}
      {state === "uploading" && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadText}>Uploading your recording…</Text>
        </View>
      )}

      {/* Warnings */}
      {shortWarning && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Recording was under 30 seconds. Please record a longer video for best results.
          </Text>
        </View>
      )}
      {uploadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{uploadError}</Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {state === "idle" && (
          <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
            <View style={styles.recordButtonInner} />
          </TouchableOpacity>
        )}
        {state === "recording" && (
          <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
            <View style={styles.stopButtonInner} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.hint}>
        {state === "idle"
          ? "Tap to start recording (max 10 min)"
          : state === "recording"
          ? "Tap to stop recording"
          : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9fafb",
  },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8 },
  errorMessage: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 24 },
  loadingText: { marginTop: 16, color: "#6b7280" },
  recordingBadge: {
    position: "absolute",
    top: 20,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
    marginRight: 8,
  },
  timerText: { color: "#fff", fontVariant: ["tabular-nums"], fontSize: 14 },
  capWarning: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#eab308",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  capWarningText: { color: "#000", fontSize: 12, fontWeight: "600" },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  uploadText: { color: "#fff", fontSize: 16, fontWeight: "500" },
  warningBanner: {
    position: "absolute",
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: "#fef9c3",
    borderWidth: 1,
    borderColor: "#fde047",
    borderRadius: 8,
    padding: 12,
  },
  warningText: { color: "#854d0e", fontSize: 13 },
  errorBanner: {
    position: "absolute",
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 8,
    padding: 12,
  },
  errorBannerText: { color: "#dc2626", fontSize: 13 },
  controls: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ef4444",
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  stopButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  hint: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: "#374151", fontSize: 15 },
});
