import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200">404</h1>
        <p className="mt-4 text-lg text-gray-600">Page not found</p>
        <Link href="/" className="mt-6 inline-block btn-primary">Go home</Link>
      </div>
    </div>
  );
}
