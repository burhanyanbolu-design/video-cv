import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import type { CV_Data, WorkExperience, Education } from "@video-cv/types";
import { apiClient } from "@/lib/api";

function FieldWrapper({
  label,
  missing,
  children,
}: {
  label: string;
  missing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg p-4 ${missing ? "bg-yellow-50 border border-yellow-300" : "bg-gray-50 border border-gray-200"}`}>
      <label className={`label ${missing ? "text-yellow-800" : ""}`}>
        {label}
        {missing && <span className="ml-2 text-xs font-normal text-yellow-600">(missing — please fill in)</span>}
      </label>
      {children}
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [session, setSession] = useState<{ profileId: string | null; cvData: CV_Data | null } | null>(null);
  const [cvData, setCvData] = useState<CV_Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState<{ slug: string; cvPdfUrl: string | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient.sessions.get(id).then((s) => {
      setSession({ profileId: s.profileId, cvData: s.cvData });
      setCvData(s.cvData);
      setLoading(false);
    }).catch(() => {
      setError("Could not load session data.");
      setLoading(false);
    });
  }, [id]);

  function updateField<K extends keyof CV_Data>(key: K, value: CV_Data[K]) {
    setCvData((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function updateContact(key: keyof CV_Data["contactDetails"], value: string) {
    setCvData((prev) =>
      prev ? { ...prev, contactDetails: { ...prev.contactDetails, [key]: value || null } } : prev
    );
  }

  function updateWorkExp(index: number, field: keyof WorkExperience, value: string | string[]) {
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
    if (!cvData || !session?.profileId) return;
    setSaving(true);
    setError(null);
    try {
      const profile = await apiClient.profiles.update(session.profileId, { cvData });
      setSavedProfile({ slug: profile.slug, cvPdfUrl: profile.cvPdfUrl });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!cvData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card text-center max-w-md">
          <p className="text-gray-600 mb-4">{error ?? "No CV data found for this session."}</p>
          <Link href="/dashboard" className="btn-secondary">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const missing = new Set(cvData.missingFields as string[]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">← Dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-900">Review your CV</h1>
          <div className="w-24" />
        </div>

        {missing.size > 0 && (
          <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
            <strong>Some fields are missing.</strong> Please fill them in before confirming.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        {savedProfile && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-center justify-between">
            <span>CV saved successfully!</span>
            <div className="flex gap-3">
              {savedProfile.cvPdfUrl && (
                <a href={savedProfile.cvPdfUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1">
                  Download PDF
                </a>
              )}
              <Link href={`/profiles/${savedProfile.slug}`} className="btn-primary text-xs py-1">
                View profile
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Name */}
          <FieldWrapper label="Full name" missing={missing.has("name")}>
            <input
              className="input"
              value={cvData.name ?? ""}
              onChange={(e) => updateField("name", e.target.value || null)}
              placeholder="Your full name"
            />
          </FieldWrapper>

          {/* Contact */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900">Contact details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input className="input" value={cvData.contactDetails.email ?? ""} onChange={(e) => updateContact("email", e.target.value)} placeholder="email@example.com" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={cvData.contactDetails.phone ?? ""} onChange={(e) => updateContact("phone", e.target.value)} placeholder="+44 7700 000000" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Location</label>
                <input className="input" value={cvData.contactDetails.location ?? ""} onChange={(e) => updateContact("location", e.target.value)} placeholder="City, Country" />
              </div>
            </div>
          </div>

          {/* Summary */}
          <FieldWrapper label="Professional summary" missing={missing.has("professionalSummary")}>
            <textarea
              className="input resize-none"
              rows={4}
              value={cvData.professionalSummary ?? ""}
              onChange={(e) => updateField("professionalSummary", e.target.value || null)}
              placeholder="A brief overview of your professional background…"
            />
          </FieldWrapper>

          {/* Skills */}
          <FieldWrapper label="Skills (comma-separated)" missing={missing.has("skills")}>
            <input
              className="input"
              value={cvData.skills.join(", ")}
              onChange={(e) => updateField("skills", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="React, TypeScript, Node.js…"
            />
          </FieldWrapper>

          {/* Work experience */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Work experience</h3>
            {cvData.workExperience.length === 0 && (
              <p className="text-sm text-yellow-700 bg-yellow-50 rounded p-3">No work experience extracted. Please add at least one entry.</p>
            )}
            {cvData.workExperience.map((exp, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 mb-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Employer</label>
                    <input className="input" value={exp.employer} onChange={(e) => updateWorkExp(i, "employer", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <input className="input" value={exp.role} onChange={(e) => updateWorkExp(i, "role", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Start date</label>
                    <input className="input" value={exp.startDate ?? ""} onChange={(e) => updateWorkExp(i, "startDate", e.target.value)} placeholder="e.g. Jan 2020" />
                  </div>
                  <div>
                    <label className="label">End date</label>
                    <input className="input" value={exp.endDate ?? ""} onChange={(e) => updateWorkExp(i, "endDate", e.target.value)} placeholder="Present" />
                  </div>
                </div>
                <div>
                  <label className="label">Responsibilities (one per line)</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    value={exp.responsibilities.join("\n")}
                    onChange={(e) => updateWorkExp(i, "responsibilities", e.target.value.split("\n").filter(Boolean))}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Education */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Education</h3>
            {cvData.education.map((edu, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 mb-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Institution</label>
                    <input className="input" value={edu.institution} onChange={(e) => updateEducation(i, "institution", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Qualification</label>
                    <input className="input" value={edu.qualification} onChange={(e) => updateEducation(i, "qualification", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Start date</label>
                    <input className="input" value={edu.startDate ?? ""} onChange={(e) => updateEducation(i, "startDate", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">End date</label>
                    <input className="input" value={edu.endDate ?? ""} onChange={(e) => updateEducation(i, "endDate", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Link href="/dashboard" className="btn-secondary">Cancel</Link>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Confirm & save"}
          </button>
        </div>
      </div>
    </div>
  );
}
