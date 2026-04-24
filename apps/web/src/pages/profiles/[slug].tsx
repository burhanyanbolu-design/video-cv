import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import type { Profile, CV_Data } from "@video-cv/types";
import { createVideoCvClient } from "@video-cv/api-client";

interface Props {
  profile: Profile;
  cvData: CV_Data | null;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { slug } = ctx.params as { slug: string };
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  try {
    const client = createVideoCvClient({ baseUrl: apiUrl });
    const profile = await client.profiles.get(slug);

    // Fetch CV data from the associated session if available
    let cvData: CV_Data | null = null;
    if (profile.sessionId) {
      try {
        // We need the session's cvData — fetch via the API
        const res = await fetch(`${apiUrl}/sessions/${profile.sessionId}`, {
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const session = (await res.json()) as { cvData?: CV_Data };
          cvData = session.cvData ?? null;
        }
      } catch {
        // CV data is optional for display
      }
    }

    return { props: { profile, cvData } };
  } catch {
    return { notFound: true };
  }
};

export default function PublicProfilePage({
  profile,
  cvData,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const name = cvData?.name ?? "Video CV Profile";
  const title = cvData?.workExperience?.[0]?.role ?? "";

  return (
    <>
      <Head>
        <title>{name} — Video CV</title>
        <meta name="description" content={cvData?.professionalSummary ?? `${name}'s Video CV profile`} />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-brand-600">Video CV</Link>
            <Link href="/search" className="text-sm text-gray-500 hover:text-gray-700">Find candidates →</Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Profile header */}
          <div className="card mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
                {title && <p className="text-gray-500 mt-1">{title}</p>}
                {cvData?.contactDetails?.location && (
                  <p className="text-sm text-gray-400 mt-1">📍 {cvData.contactDetails.location}</p>
                )}
              </div>
              {profile.cvPdfUrl && (
                <a
                  href={profile.cvPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm"
                >
                  Download CV (PDF)
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Video player */}
            <div className="lg:col-span-3">
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Video introduction</h2>
                {profile.videoUrl ? (
                  <video
                    controls
                    className="w-full rounded-lg bg-black aspect-video"
                    src={profile.videoUrl}
                  >
                    Your browser does not support the video element.
                  </video>
                ) : (
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-gray-400 text-sm">Video not available</p>
                  </div>
                )}
              </div>
            </div>

            {/* CV sidebar */}
            <div className="lg:col-span-2 space-y-4">
              {cvData?.professionalSummary && (
                <div className="card">
                  <h2 className="text-base font-semibold text-gray-900 mb-2">Summary</h2>
                  <p className="text-sm text-gray-600 leading-relaxed">{cvData.professionalSummary}</p>
                </div>
              )}

              {cvData?.skills && cvData.skills.length > 0 && (
                <div className="card">
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {cvData.skills.map((skill) => (
                      <span key={skill} className="inline-block bg-brand-50 text-brand-700 text-xs font-medium px-2.5 py-1 rounded-full border border-brand-100">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {cvData?.workExperience && cvData.workExperience.length > 0 && (
                <div className="card">
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Experience</h2>
                  <div className="space-y-4">
                    {cvData.workExperience.map((exp, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-gray-900">{exp.role}</p>
                        <p className="text-xs text-gray-500">{exp.employer}</p>
                        {(exp.startDate || exp.endDate) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {exp.startDate ?? "?"} – {exp.endDate ?? "Present"}
                          </p>
                        )}
                        {exp.responsibilities.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {exp.responsibilities.slice(0, 3).map((r, j) => (
                              <li key={j} className="text-xs text-gray-600 flex gap-1.5">
                                <span className="text-gray-300 mt-0.5">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cvData?.education && cvData.education.length > 0 && (
                <div className="card">
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Education</h2>
                  <div className="space-y-3">
                    {cvData.education.map((edu, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-gray-900">{edu.qualification}</p>
                        <p className="text-xs text-gray-500">{edu.institution}</p>
                        {(edu.startDate || edu.endDate) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {edu.startDate ?? "?"} – {edu.endDate ?? "Present"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="border-t border-gray-200 mt-12 py-6 text-center text-xs text-gray-400">
          Powered by Video CV
        </footer>
      </div>
    </>
  );
}
