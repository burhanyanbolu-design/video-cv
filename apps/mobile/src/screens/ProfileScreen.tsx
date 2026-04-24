import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../navigation/AppNavigator";
import type { Profile, ProfileVisibility } from "@video-cv/types";
import { apiClient } from "../lib/api";

type Props = NativeStackScreenProps<AppStackParamList, "Profile">;

export default function ProfileScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiClient.profiles
      .get(profileId)
      .then((p) => {
        setProfile(p);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load profile.");
        setLoading(false);
      });
  }, [profileId]);

  async function toggleVisibility() {
    if (!profile) return;
    setToggling(true);
    try {
      const newVisibility: ProfileVisibility =
        profile.visibility === "discoverable" ? "private" : "discoverable";
      const updated = await apiClient.profiles.update(profileId, {
        visibility: newVisibility,
      });
      setProfile(updated);
    } catch {
      Alert.alert("Error", "Failed to update visibility.");
    } finally {
      setToggling(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete profile",
      "This will permanently delete your profile. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ]
    );
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiClient.profiles.delete(profileId);
      navigation.replace("Dashboard");
    } catch {
      Alert.alert("Error", "Failed to delete profile.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!profile || error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Profile not found."}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cvData = null; // Profile doesn't carry cvData directly; shown via session

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Video player */}
      {profile.videoUrl ? (
        <Video
          source={{ uri: profile.videoUrl }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
        />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Text style={styles.videoPlaceholderText}>Video not available</Text>
        </View>
      )}

      {/* Visibility badge */}
      <View style={styles.visibilityRow}>
        <View
          style={[
            styles.badge,
            profile.visibility === "discoverable"
              ? styles.badgeDiscoverable
              : styles.badgePrivate,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              profile.visibility === "discoverable"
                ? styles.badgeTextDiscoverable
                : styles.badgeTextPrivate,
            ]}
          >
            {profile.visibility === "discoverable" ? "Discoverable" : "Private"}
          </Text>
        </View>
      </View>

      {/* Profile info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Profile ID</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {profile.slug}
        </Text>
        <Text style={styles.infoLabel}>Expires</Text>
        <Text style={styles.infoValue}>
          {new Date(profile.expiresAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
        {profile.cvPdfUrl && (
          <>
            <Text style={styles.infoLabel}>CV Document</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              PDF available
            </Text>
          </>
        )}
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[styles.toggleButton, toggling && styles.buttonDisabled]}
        onPress={toggleVisibility}
        disabled={toggling}
      >
        {toggling ? (
          <ActivityIndicator color="#4f46e5" />
        ) : (
          <Text style={styles.toggleButtonText}>
            {profile.visibility === "discoverable"
              ? "Make private"
              : "Make discoverable"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.deleteButton, deleting && styles.buttonDisabled]}
        onPress={confirmDelete}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator color="#dc2626" />
        ) : (
          <Text style={styles.deleteButtonText}>Delete profile</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  video: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
  },
  videoPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
  },
  videoPlaceholderText: { color: "#9ca3af", fontSize: 14 },
  visibilityRow: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 0,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeDiscoverable: { backgroundColor: "#dcfce7" },
  badgePrivate: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 13, fontWeight: "600" },
  badgeTextDiscoverable: { color: "#16a34a" },
  badgeTextPrivate: { color: "#6b7280" },
  infoCard: {
    margin: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 2,
  },
  infoValue: { fontSize: 15, color: "#111827" },
  toggleButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  toggleButtonText: { color: "#4f46e5", fontSize: 15, fontWeight: "600" },
  deleteButton: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteButtonText: { color: "#dc2626", fontSize: 15, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
  errorText: { color: "#dc2626", marginBottom: 16, textAlign: "center" },
  backButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButtonText: { color: "#374151" },
});
