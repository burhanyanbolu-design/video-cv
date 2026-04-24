import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import * as Notifications from "expo-notifications";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../navigation/AppNavigator";
import type {
  PipelineProgressEvent,
  PipelineCompleteEvent,
  PipelineErrorEvent,
  WebSocketEvent,
} from "@video-cv/types";
import { apiClient } from "../lib/api";

type Props = NativeStackScreenProps<AppStackParamList, "Progress">;

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STAGES = [
  { key: "transcribing", label: "Transcribing audio" },
  { key: "cleaning", label: "Cleaning transcript" },
  { key: "extracting", label: "Extracting CV data" },
  { key: "building", label: "Building CV document" },
  { key: "processing", label: "Processing video" },
  { key: "complete", label: "Publishing profile" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

interface StageState {
  status: "pending" | "active" | "done" | "error";
  percentage: number;
}

function buildInitialStages(): Record<StageKey, StageState> {
  return Object.fromEntries(
    STAGES.map((s) => [s.key, { status: "pending", percentage: 0 }])
  ) as Record<StageKey, StageState>;
}

export default function ProgressScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const [stages, setStages] = useState<Record<StageKey, StageState>>(buildInitialStages());
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const wsRef = useRef(apiClient.ws);

  useEffect(() => {
    // Register for push notifications
    Notifications.requestPermissionsAsync().catch(() => {/* ignore */});

    const ws = wsRef.current;
    ws.connect(sessionId);

    const unsubscribe = ws.on((event: WebSocketEvent) => {
      if (event.type === "pipeline:progress") {
        const e = event as PipelineProgressEvent;
        if (e.sessionId !== sessionId) return;
        const stageKey = e.stage as StageKey;
        setStages((prev) => {
          const next = { ...prev };
          // Mark previous stages as done
          let found = false;
          for (const s of STAGES) {
            if (s.key === stageKey) {
              found = true;
              next[s.key] = { status: "active", percentage: e.percentage };
            } else if (!found) {
              next[s.key] = { status: "done", percentage: 100 };
            }
          }
          return next;
        });
      } else if (event.type === "pipeline:complete") {
        const e = event as PipelineCompleteEvent;
        if (e.sessionId !== sessionId) return;
        setStages((prev) => {
          const next = { ...prev };
          for (const s of STAGES) {
            next[s.key] = { status: "done", percentage: 100 };
          }
          return next;
        });
        setProfileUrl(e.profileUrl);

        // Send push notification for background state
        Notifications.scheduleNotificationAsync({
          content: {
            title: "Video CV ready!",
            body: "Your Video CV has been processed. Tap to review.",
          },
          trigger: null,
        }).catch(() => {/* ignore */});

        // Extract profileId from URL (last segment)
        const parts = e.profileUrl.split("/");
        const profileId = parts[parts.length - 1];
        navigation.replace("Review", { sessionId, profileId });
      } else if (event.type === "pipeline:error") {
        const e = event as PipelineErrorEvent;
        if (e.sessionId !== sessionId) return;
        setPipelineError(e.message);
        const stageKey = e.stage as StageKey;
        setStages((prev) => ({
          ...prev,
          [stageKey]: { status: "error", percentage: prev[stageKey]?.percentage ?? 0 },
        }));
      }
    });

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, [sessionId, navigation]);

  const stageIcon = (status: StageState["status"]) => {
    if (status === "done") return "✓";
    if (status === "active") return "…";
    if (status === "error") return "✗";
    return "○";
  };

  const stageColor = (status: StageState["status"]) => {
    if (status === "done") return "#16a34a";
    if (status === "active") return "#4f46e5";
    if (status === "error") return "#dc2626";
    return "#9ca3af";
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Processing your Video CV</Text>
      <Text style={styles.subtitle}>This usually takes a few minutes.</Text>

      {pipelineError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Processing error</Text>
          <Text style={styles.errorMessage}>{pipelineError}</Text>
          <TouchableOpacity
            style={styles.rerecordButton}
            onPress={() => navigation.replace("Record")}
          >
            <Text style={styles.rerecordText}>Re-record</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.stageList}>
        {STAGES.map((stage) => {
          const s = stages[stage.key];
          return (
            <View key={stage.key} style={styles.stageRow}>
              <Text style={[styles.stageIcon, { color: stageColor(s.status) }]}>
                {stageIcon(s.status)}
              </Text>
              <View style={styles.stageInfo}>
                <Text style={[styles.stageLabel, { color: stageColor(s.status) }]}>
                  {stage.label}
                </Text>
                {s.status === "active" && (
                  <View style={styles.progressBar}>
                    <View
                      style={[styles.progressFill, { width: `${s.percentage}%` }]}
                    />
                  </View>
                )}
              </View>
              {s.status === "active" && (
                <Text style={styles.percentage}>{s.percentage}%</Text>
              )}
            </View>
          );
        })}
      </View>

      {profileUrl && (
        <Text style={styles.doneText}>Done! Navigating to review…</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#f9fafb",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 32,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#dc2626",
    marginBottom: 6,
  },
  errorMessage: { fontSize: 14, color: "#7f1d1d", marginBottom: 12 },
  rerecordButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  rerecordText: { color: "#fff", fontWeight: "600" },
  stageList: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  stageIcon: { fontSize: 18, width: 28, textAlign: "center" },
  stageInfo: { flex: 1, marginLeft: 12 },
  stageLabel: { fontSize: 15, fontWeight: "500" },
  progressBar: {
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4f46e5",
    borderRadius: 2,
  },
  percentage: { fontSize: 13, color: "#4f46e5", fontWeight: "600", marginLeft: 8 },
  doneText: {
    marginTop: 24,
    textAlign: "center",
    color: "#16a34a",
    fontWeight: "600",
  },
});
