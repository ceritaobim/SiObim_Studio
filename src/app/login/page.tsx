"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Origami, Lock, User, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";

const LOCAL_STORAGE_KEY = "ceritaobim_saved_credentials_v1";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { u?: string; p?: string };
        if (parsed.u) setUsername(parsed.u);
        if (parsed.p) setPassword(parsed.p);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login gagal.");
      }

      if (rememberDevice) {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({ u: username.trim(), p: password })
        );
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-md sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
            <Origami className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-lg font-bold text-stone-900 sm:text-xl">
            CeritaObim Studio
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Masuk sekali untuk menyimpan sesi di HP / Browser Anda selama 1 tahun.
          </p>
        </div>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs sm:text-sm">
          <div>
            <label
              htmlFor="username"
              className="block font-semibold text-stone-700"
            >
              Username
            </label>
            <div className="relative mt-1">
              <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="obim_creator_studio"
                className="w-full rounded-xl border border-stone-300 bg-stone-50 pl-9 pr-3 py-2 text-stone-900 focus:border-amber-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-semibold text-stone-700"
            >
              Password
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••••••••••"
                className="w-full rounded-xl border border-stone-300 bg-stone-50 pl-9 pr-10 py-2 text-stone-900 focus:border-amber-600 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-2 text-stone-500 hover:text-stone-800"
                aria-label="Tampilkan atau sembunyikan password"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="rounded border-stone-300 text-amber-600"
            />
            <span>Simpan riwayat login di perangkat / HP ini (365 Hari)</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{loading ? "Memverifikasi..." : "Masuk ke Studio"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
