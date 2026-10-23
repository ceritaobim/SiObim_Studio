"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity,
  CalendarRange,
  Mic,
  Film,
  Users,
  UploadCloud,
  KeyRound,
  LayoutDashboard,
  Menu,
  X,
  Origami,
  LogOut,
} from "lucide-react";
import { PRIMARY_NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, ReactNode> = {
  "/": <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/content": <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/production": <Mic className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/assets": <Film className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/characters": <Users className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/publishing": (
    <UploadCloud className="h-4 w-4 shrink-0" aria-hidden="true" />
  ),
  "/models-usage": <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/settings": (
    <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
  ),
};

const MOBILE_BOTTOM_HREFS = [
  "/",
  "/content",
  "/production",
  "/assets",
  "/publishing",
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const mobileBottomItems = PRIMARY_NAV_ITEMS.filter((item) =>
    MOBILE_BOTTOM_HREFS.includes(item.href)
  );

  const handleLogout = async () => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-amber-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Lewati ke konten utama
      </a>

      {/* Desktop Sidebar */}
      <aside
        aria-label="Navigasi utama desktop"
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:border-stone-200 lg:bg-white"
      >
        <div className="flex items-center gap-3 border-b border-stone-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white shadow-xs">
            <Origami className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-stone-900">
              CeritaObim
            </p>
            <p className="truncate text-xs text-stone-500">
              AI Content Pipeline
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-amber-50 text-amber-900 border border-amber-200/80 font-semibold"
                    : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
                )}
              >
                <span className="flex items-center gap-3">
                  {ICON_MAP[item.href]}
                  <span>{item.label}</span>
                </span>
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                  {item.milestoneTag}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-stone-200 p-4 space-y-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white/95 px-3 py-2.5 backdrop-blur-xs lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white">
            <Origami className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <span className="block text-sm font-bold leading-none text-stone-900">
              CeritaObim
            </span>
            <span className="block text-[11px] text-stone-500">
              Monitor & Trigger AI
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-700"
          >
            Setting & Akun
          </Link>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen((prev) => !prev)}
            aria-expanded={mobileDrawerOpen}
            aria-label="Menu navigasi"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700"
          >
            {mobileDrawerOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileDrawerOpen ? (
        <div className="fixed inset-x-0 top-[53px] bottom-14 z-40 overflow-y-auto border-b border-stone-200 bg-white p-3 shadow-lg lg:hidden">
          <div className="space-y-1">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={cn(
                    "flex items-start justify-between rounded-lg p-2.5 text-sm",
                    active
                      ? "bg-amber-50 font-semibold text-amber-900 border border-amber-200"
                      : "text-stone-700 hover:bg-stone-100"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5">{ICON_MAP[item.href]}</span>
                    <div>
                      <span className="block">{item.label}</span>
                      <span className="block text-xs font-normal text-stone-500">
                        {item.description}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-800"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar Sesi</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64">
        <main
          id="main-content"
          className="mx-auto max-w-6xl px-3 pt-4 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar: Monitor, Planning, Audio, Video, Upload */}
      <nav
        aria-label="Navigasi bawah seluler"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-xs lg:hidden"
      >
        <div className="grid grid-cols-5">
          {mobileBottomItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileDrawerOpen(false)}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-1 text-[11px] font-medium transition-colors",
                  active
                    ? "text-amber-700 font-bold"
                    : "text-stone-600 hover:text-stone-900"
                )}
              >
                {ICON_MAP[item.href]}
                <span className="mt-1 truncate max-w-full">
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
