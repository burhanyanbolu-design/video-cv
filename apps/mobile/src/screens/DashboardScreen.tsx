import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../navigation/AppNavigator";
import type { Session, SessionUpdatedEvent, WebSocketEvent } from "@video-cv/types";
import { apiClient } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

type Props = NativeStackScreenProps<AppStackParamList, "Dashboard">;

const STATUS_LABELS: Record<Session["status"], string> = {
  pending: "Pending",
  transcribing: "Transcribing",
  cleaning: "Cleaning",
  extracting: "Extracting",
  building: "Building CV",
  processing: "Processing",
  complete: "Complete",
  error: "Error",
};

const STATUS_COLORS: Record<Session["status"], { bg: string; text: string }> = {
  pending: { bg: "#f3f4f6", text: "#6b7280" },
  transcribing: { bg: "#dbeafe", text: "#1d4ed8" },
  cleaning: { bg: "#dbeafe", text: "#1d4ed8" },
  extracting: { bg: "#ede9fe", text: "#7c3aed" },
  building: { bg: "#ede9fe", text: "#7c3aed" },
  processing: { bg: "#fef9c3", text: "#a16207" },
  complete: { bg: "#dcfce7", text: "#16a34a" },
  error: { bg: "#fef2f2", text: "#dc2626" },
};

export default function DashboardScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef(apiClient.ws);

  const loadSessions = useCallback(async () => {
    try {
      const list = await apiClient.sessions.list();
      setSessions(list);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
    }
  }, []);

  useEffect(() => {
    loadSessions().finally(() => setLoading(false));
  }, [loadSessions]);

  // WebSocket listener for real-time session updates.
  // The server keys channels by userId; we connect per active session.
  // For the dashboard we listen on each in-progress session.
  useEffect(() => {
    if (sessions.length === 0) return;

    // Find the most recent in-progress session to subscribe to
    const inProgress = sessions.find(
      (s) =>
        s.status !== "pending" &&
        s.status !== "complete" &&
        s.status !== "error"
    );
    if (!inProgress) return;

    const ws = wsRef.current;
    ws.connect(inProgress.id);

    const unsubscribe = ws.on((event: WebSocketEvent) => {
      if (event.type === "session:updated") {
        const e = event as SessionUpdatedEvent;
        setSessions((prev) =>
          prev.map((s) =>
            s.id === e.sessionId ? { ...s, cvData: e.cvData } : s
          )
        );
      } else if (event.type === "pipeline:complete") {
        // Refresh list to pick up new profileId
        loadSessions();
      } else if (event.type === "pipeline:progress") {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === event.sessionId ? { ...s, status: event.stage } : s
          )
        );
      }
    });

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, [sessions, loadSessions]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  }

  async function handleLogout() {
    await logout();
  }

  function navigateToSession(session: Session) {
    if (session.status === "complete" && session.profileId) {
      navigation.navigate("Profile", { profileId: session.profileId });
    } else if (
      session.status !== "pending" &&
      session.status !== "complete" &&
      session.status !== "error"
    ) {
      navigation.navigate("Progress", { sessionId: session.id });
    }
  }

  function renderSession({ item: session }: { item: Session }) {
    const { bg, text } = STATUS_COLORS[session.status];
    const isComplete = session.status === "complete";
    const isInProgress =
      session.status !== "pending" &&
      session.status !== "complete" &&
      session.status !== "error";

    return (
      <View style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <View style={[styles.statusBadge, { backgroundColor: bg }]}>
            <Text style={[styles.statusText, { color: text }]}>
              {STATUS_LABELS[session.status]}
            </Text>
          </View>
          <Text style={styles.sessionDate}>
            {new Date(session.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>

        <Text style={styles.sessionId} numberOfLines={1}>
          {session.id}
        </Text>

        <View style={styles.sessionActions}>
          {isInProgress && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate("Progress", { sessionId: session.id })
              }
            >
              <Text style={styles.actionButtonText}>View progress</Text>
            </TouchableOpacity>
          )}

          {isComplete && session.profileId && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  navigation.navigate("Review", {
                    sessionId: session.id,
                    profileId: session.profileId!,
                  })
                }
              >
                <Text style={styles.actionButtonText}>Edit CV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  navigation.navigate("Profile", {
                    profileId: session.profileId!,
                  })
                }
              >
                <Text style={styles.actionButtonText}>View profile</Text>
              </TouchableOpacity>
            </>
          )}

          {session.status === "error" && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={() => navigation.navigate("Record")}
            >
              <Text style={styles.actionButtonPrimaryText}>Re-record</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My sessions</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          renderItem={renderSession}
          contentContainerStyle={
            sessions.length === 0 ? styles.emptyContainer : styles.listContent
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎬</Text>
              <Text style={styles.emptyTitle}>No recordings yet</Text>
              <Text style={styles.emptySubtitle}>
                Record your first Video CV to get started.
              </Text>
              <TouchableOpacity
                style={styles.newButton}
                onPress={() => navigation.navigate("Record")}
              >
                <Text style={styles.newButtonText}>Start recording</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      {sessions.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate("Record")}
        >
          <Text style={styles.fabText}>+ New</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  logoutText: { fontSize: 14, color: "#4f46e5" },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fca5a5",
    padding: 12,
  },
  errorBannerText: { color: "#dc2626", fontSize: 13 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1 },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  newButton: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  newButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  sessionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  sessionDate: { fontSize: 12, color: "#9ca3af" },
  sessionId: { fontSize: 11, color: "#d1d5db", fontFamily: "monospace", marginBottom: 12 },
  sessionActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionButtonText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  actionButtonPrimary: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  actionButtonPrimaryText: { fontSize: 13, color: "#fff", fontWeight: "500" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: "#4f46e5",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
