import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import type { ProfileSearchDocument } from "@video-cv/types";
import { createVideoCvClient } from "@video-cv/api-client";

const PAGE_SIZE = 10;

interface SearchState {
  results: ProfileSearchDocument[];
  total: number;
  page: number;
  message?: string;
}

export default function SearchPage() {
  const [skills, setSkills] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(page = 1) {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const client = createVideoCvClient({ baseUrl: apiUrl });
      const res = await client.search.search({
        skills: skills.trim() || undefined,
        title: title.trim() || undefined,
        location: location.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setSearchState({ results: res.results, total: res.total, page: res.page, message: res.message });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(1);
  }

  const totalPages = searchState ? Math.ceil(searchState.total / PAGE_SIZE) : 0;

  return (
    <>
      <Head>
        <title>Find candidates — Video CV</title>
        <meta name="description" content="Search Video CV profiles by skills, job title, and location." />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-600">Video CV</Link>
            <Link href="/login" className="btn-secondary text-sm py-1.5">Sign in</Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Find candidates</h1>
            <p className="mt-2 text-gray-500">Search Video CV profiles — no account required.</p>
          </div>

          {/* Search form */}
          <div className="card mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Skills</label>
                  <input
                    className="input"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="e.g. React, Python"
                  />
                </div>
                <div>
                  <label className="label">Job title</label>
                  <input
                    className="input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Software Engineer"
                  />
                </div>
                <div>
                  <label className="label">Location</label>
                  <input
                    className="input"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. London"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={loading} className="btn-primary px-8">
                  {loading ? "Searching…" : "Search"}
                </button>
              </div>
            </form>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Results */}
          {searchState && (
            <>
              {searchState.results.length === 0 ? (
                <div className="card text-center py-12">
                  <div className="text-4xl mb-4">🔍</div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">No candidates found</h2>
                  <p className="text-gray-500 text-sm">
                    {searchState.message ?? "Try adjusting your search terms."}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    {searchState.total} candidate{searchState.total !== 1 ? "s" : ""} found
                  </p>

                  <div className="space-y-4">
                    {searchState.results.map((candidate) => (
                      <div key={candidate.profileId} className="card hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{candidate.jobTitle}</p>
                            {candidate.location && (
                              <p className="text-xs text-gray-400 mt-1">📍 {candidate.location}</p>
                            )}
                            {candidate.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {candidate.skills.slice(0, 6).map((skill) => (
                                  <span
                                    key={skill}
                                    className="inline-block bg-brand-50 text-brand-700 text-xs font-medium px-2 py-0.5 rounded-full border border-brand-100"
                                  >
                                    {skill}
                                  </span>
                                ))}
                                {candidate.skills.length > 6 && (
                                  <span className="text-xs text-gray-400">+{candidate.skills.length - 6} more</span>
                                )}
                              </div>
                            )}
                          </div>
                          <a
                            href={candidate.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary text-sm flex-shrink-0"
                          >
                            View profile
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => runSearch(searchState.page - 1)}
                        disabled={searchState.page <= 1 || loading}
                        className="btn-secondary text-sm py-1.5 px-3"
                      >
                        ← Previous
                      </button>
                      <span className="text-sm text-gray-500">
                        Page {searchState.page} of {totalPages}
                      </span>
                      <button
                        onClick={() => runSearch(searchState.page + 1)}
                        disabled={searchState.page >= totalPages || loading}
                        className="btn-secondary text-sm py-1.5 px-3"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>

        <footer className="border-t border-gray-200 mt-12 py-6 text-center text-xs text-gray-400">
          Powered by Video CV
        </footer>
      </div>
    </>
  );
}
