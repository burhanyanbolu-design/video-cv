import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Session, Profile, ProfileVisibility } from "@video-cv/types";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface SessionWithProfile extends Session {
  profile?: Profile;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<SessionWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const list = await apiClient.sessions.list();
      // Fetch profiles for completed sessions
      const enriched = await Promise.all(
        list.map(async (s) => {
          if (s.profileId) {
            try {
              const profile = await apiClient.profiles.get(s.profileId);
              return { ...s, profile };
            } catch {
              return s;
            }
          }
          return s;
        })
      );
      setSessions(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleVisibility(session: SessionWithProfile) {
    if (!session.profile) return;
    setTogglingId(session.id);
    try {
      const newVisibility: ProfileVisibility =
        session.profile.visibility === "discoverable" ? "private" : "discoverable";
      const updated = await apiClient.profiles.update(session.profile.id, { visibility: newVisibility });
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, profile: updated } : s))
      );
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteProfile(session: SessionWithProfile) {
    if (!session.profile) return;
    if (!confirm("Delete this profile? This cannot be undone.")) return;
    setDeletingId(session.id);
    try {
      await apiClient.profiles.delete(session.profile.id);
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, profile: undefined, profileId: null } : s))
      );
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const statusBadge = (status: Session["status"]) => {
    const map: Record<Session["status"], { label: string; cls: string }> = {
      pending: { label: "Pending", cls: "bg-gray-100 text-gray-600" },
      transcribing: { label: "Transcribing", cls: "bg-blue-100 text-blue-700" },
      cleaning: { label: "Cleaning", cls: "bg-blue-100 text-blue-700" },
      extracting: { label: "Extracting", cls: "bg-purple-100 text-purple-700" },
      building: { label: "Building CV", cls: "bg-purple-100 text-purple-700" },
      processing: { label: "Processing", cls: "bg-yellow-100 text-yellow-700" },
      complete: { label: "Complete", cls: "bg-green-100 text-green-700" },
      error: { label: "Error", cls: "bg-red-100 text-red-700" },
    };
    const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
    return (
      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold text-brand-600">Video CV</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button onClick={handleLogout} className="btn-secondary text-sm py-1.5">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My sessions</h1>
          <Link href="/record" className="btn-primary">
            + New recording
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-4">🎬</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No recordings yet</h2>
            <p className="text-gray-500 text-sm mb-6">Record your first Video CV to get started.</p>
            <Link href="/record" className="btn-primary">Start recording</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge(session.status)}
                      {session.profile && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          session.profile.visibility === "discoverable"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {session.profile.visibility === "discoverable" ? "Discoverable" : "Private"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(session.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5 font-mono truncate">{session.id}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {session.status === "pending" || (session.status !== "complete" && session.status !== "error") ? (
                      session.status !== "pending" && (
                        <Link href={`/sessions/${session.id}/progress`} className="btn-secondary text-xs py-1">
                          View progress
                        </Link>
                      )
                    ) : null}

                    {session.status === "complete" && session.profile && (
                      <>
                        <Link href={`/sessions/${session.id}/review`} className="btn-secondary text-xs py-1">
                          Edit CV
                        </Link>
                        <Link href={`/profiles/${session.profile.slug}`} className="btn-secondary text-xs py-1">
                          View profile
                        </Link>
                        <button
                          onClick={() => toggleVisibility(session)}
                          disabled={togglingId === session.id}
                          className="btn-secondary text-xs py-1"
                        >
                          {togglingId === session.id
                            ? "…"
                            : session.profile.visibility === "discoverable"
                            ? "Make private"
                            : "Make discoverable"}
                        </button>
                        <button
                          onClick={() => deleteProfile(session)}
                          disabled={deletingId === session.id}
                          className="btn-danger text-xs py-1"
                        >
                          {deletingId === session.id ? "Deleting…" : "Delete profile"}
                        </button>
                      </>
                    )}

                    {session.status === "error" && (
                      <Link href="/record" className="btn-primary text-xs py-1">
                        Re-record
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
