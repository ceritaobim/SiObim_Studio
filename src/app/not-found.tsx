import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-stone-50 text-stone-900">
      <h1 className="text-4xl font-extrabold text-stone-800">404</h1>
      <p className="mt-2 text-sm text-stone-600">
        Halaman yang Anda tuju tidak ditemukan di CeritaObim Studio.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        Kembali ke Dashboard Monitor
      </Link>
    </div>
  );
}
