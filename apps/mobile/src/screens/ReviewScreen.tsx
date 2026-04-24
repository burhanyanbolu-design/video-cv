import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../navigation/AppNavigator";
import type { CV_Data, WorkExperience, Education } from "@video-cv/types";
import { apiClient } from "../lib/api";

type Props = NativeStackScreenProps<AppStackParamList, "Review">;

export default function ReviewScreen({ route, navigation }: Props) {
  const { sessionId, profileId } = route.params;
  const [cvData, setCvData] = useState<CV_Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient.sessions
      .get(sessionId)
      .then((s) => {
        setCvData(s.cvData);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load session data.");
        setLoading(false);
      });
  }, [sessionId]);

  function updateField<K extends keyof CV_Data>(key: K, value: CV_Data[K]) {
    setCvData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateContact(key: keyof CV_Data["contactDetails"], value: string) {
    setCvData((prev) =>
      prev
        ? { ...prev, contactDetails: { ...prev.contactDetails, [key]: value || null } }
        : prev
    );
  }

  function updateWorkExp(
    index: number,
    field: keyof WorkExperience,
    value: string | string[]
  ) {
    setCvData((prev) => {
      if (!prev) return prev;
      const updated = [...prev.workExperience];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, workExperience: updated };
    });
  }

  function updateEducation(index: number, field: keyof Education, value: string) {
    setCvData((prev) => {
      if (!prev) return prev;
      const updated = [...prev.education];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, education: updated };
    });
  }

  async function handleSave() {
    if (!cvData) return;
    setSaving(true);
    setError(null);
    try {
      const profile = await apiClient.profiles.update(profileId, { cvData });
      setSaved(true);
      navigation.replace("Profile", { profileId: profile.id });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!cvData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "No CV data found."}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const missing = new Set(cvData.missingFields as string[]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Review your CV</Text>

      {missing.size > 0 && (
        <View style={styles.missingBanner}>
          <Text style={styles.missingBannerText}>
            Some fields are missing — please fill them in before confirming.
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Name */}
      <View style={[styles.fieldGroup, missing.has("name") && styles.fieldGroupMissing]}>
        <Text style={[styles.label, missing.has("name") && styles.labelMissing]}>
          Full name{missing.has("name") ? " (missing)" : ""}
        </Text>
        <TextInput
          style={styles.input}
          value={cvData.name ?? ""}
          onChangeText={(v) => updateField("name", v || null)}
          placeholder="Your full name"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact details</Text>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={cvData.contactDetails.email ?? ""}
          onChangeText={(v) => updateContact("email", v)}
          placeholder="email@example.com"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={cvData.contactDetails.phone ?? ""}
          onChangeText={(v) => updateContact("phone", v)}
          placeholder="+44 7700 000000"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
        />
        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={cvData.contactDetails.location ?? ""}
          onChangeText={(v) => updateContact("location", v)}
          placeholder="City, Country"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Summary */}
      <View
        style={[
          styles.fieldGroup,
          missing.has("professionalSummary") && styles.fieldGroupMissing,
        ]}
      >
        <Text
          style={[
            styles.label,
            missing.has("professionalSummary") && styles.labelMissing,
          ]}
        >
          Professional summary{missing.has("professionalSummary") ? " (missing)" : ""}
        </Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={cvData.professionalSummary ?? ""}
          onChangeText={(v) => updateField("professionalSummary", v || null)}
          placeholder="A brief overview of your professional background…"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Skills */}
      <View
        style={[styles.fieldGroup, missing.has("skills") && styles.fieldGroupMissing]}
      >
        <Text
          style={[styles.label, missing.has("skills") && styles.labelMissing]}
        >
          Skills (comma-separated){missing.has("skills") ? " (missing)" : ""}
        </Text>
        <TextInput
          style={styles.input}
          value={cvData.skills.join(", ")}
          onChangeText={(v) =>
            updateField(
              "skills",
              v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="React, TypeScript, Node.js…"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Work experience */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Work experience</Text>
        {cvData.workExperience.length === 0 && (
          <Text style={styles.emptyNote}>
            No work experience extracted. Please add at least one entry.
          </Text>
        )}
        {cvData.workExperience.map((exp, i) => (
          <View key={i} style={styles.entryCard}>
            <Text style={styles.label}>Employer</Text>
            <TextInput
              style={styles.input}
              value={exp.employer}
              onChangeText={(v) => updateWorkExp(i, "employer", v)}
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.label}>Role</Text>
            <TextInput
              style={styles.input}
              value={exp.role}
              onChangeText={(v) => updateWorkExp(i, "role", v)}
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.label}>Start date</Text>
            <TextInput
              style={styles.input}
              value={exp.startDate ?? ""}
              onChangeText={(v) => updateWorkExp(i, "startDate", v)}
              placeholder="e.g. Jan 2020"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.label}>End date</Text>
            <TextInput
              style={styles.input}
              value={exp.endDate ?? ""}
              onChangeText={(v) => updateWorkExp(i, "endDate", v)}
              placeholder="Present"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.label}>Responsibilities (one per line)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={exp.responsibilities.join("\n")}
              onChangeText={(v) =>
                updateWorkExp(i, "responsibilities", v.split("\n").filter(Boolean))
              }
              multiline
              numberOfLines={3}
              placeholderTextColor="#9ca3af"
            />
          </View>
        ))}
      </View>

      {/* Education */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Education</Text>
        {cvData.education.map((edu, i) => (
          <View key={i} style={styles.entryCard}>
            <Text style={styles.label}>Institution</Text>
            <TextInput
              style={styles.input}
              value={edu.institution}
              onChangeText={(v) => updateEducation(i, "institution", v)}
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.label}>Qualification</Text>
            <TextInput
              style={styles.input}
              value={edu.qualification}
              onChangeText={(v) => updateEducation(i, "qualification", v)}
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.label}>Start date</Text>
            <TextInput
              style={styles.input}
              value={edu.startDate ?? ""}
              onChangeText={(v) => updateEducation(i, "startDate", v)}
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.label}>End date</Text>
            <TextInput
              style={styles.input}
              value={edu.endDate ?? ""}
              onChangeText={(v) => updateEducation(i, "endDate", v)}
              placeholderTextColor="#9ca3af"
            />
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.navigate("Dashboard")}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Confirm & save</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  missingBanner: {
    backgroundColor: "#fef9c3",
    borderWidth: 1,
    borderColor: "#fde047",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  missingBannerText: { color: "#854d0e", fontSize: 13 },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { color: "#dc2626", fontSize: 13 },
  fieldGroup: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  fieldGroupMissing: {
    backgroundColor: "#fefce8",
    borderColor: "#fde047",
  },
  section: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  label: { fontSize: 13, color: "#374151", fontWeight: "500", marginBottom: 4 },
  labelMissing: { color: "#92400e" },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    marginBottom: 10,
  },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  entryCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  emptyNote: {
    fontSize: 13,
    color: "#92400e",
    backgroundColor: "#fef9c3",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButtonText: { color: "#374151", fontSize: 15, fontWeight: "500" },
  saveButton: {
    flex: 2,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
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
