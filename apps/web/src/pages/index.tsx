import Link from "next/link";
import Head from "next/head";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Video CV — Turn your voice into a career</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex flex-col">
        <header className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
          <span className="text-2xl font-bold text-brand-600">Video CV</span>
          <div className="flex gap-3">
            <Link href="/search" className="btn-secondary text-sm py-1.5">Find candidates</Link>
            <Link href="/login" className="btn-primary text-sm py-1.5">Sign in</Link>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight max-w-2xl">
            Turn your voice into a career
          </h1>
          <p className="mt-6 text-xl text-gray-500 max-w-xl">
            Record a short video, and we&apos;ll automatically transcribe, clean, and build a professional CV — ready to share in minutes.
          </p>
          <div className="mt-10 flex gap-4">
            <Link href="/register" className="btn-primary text-base px-8 py-3">
              Get started free
            </Link>
            <Link href="/search" className="btn-secondary text-base px-8 py-3">
              Browse candidates
            </Link>
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Video CV
        </footer>
      </div>
    </>
  );
}
