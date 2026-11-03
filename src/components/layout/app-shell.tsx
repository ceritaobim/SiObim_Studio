"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Home,
  CalendarRange,
  Mic,
  Film,
  Send,
  Users,
  Wrench,
  BarChart3,
  Settings,
  KeyRound,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  LogOut,
  Building2,
} from "lucide-react";
import { PRIMARY_NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { StudioModeProvider } from "@/context/studio-mode-context";
import { ModeToggle } from "./mode-toggle";

const ICON_MAP: Record<string, ReactNode> = {
  "/": <Home className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/office": <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/content": <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/production": <Mic className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/assets": <Film className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/publishing": <Send className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/characters": <Users className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/models-usage": <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/tools": <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/analytics": <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />,
  "/settings": <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />,
};

const MOBILE_BOTTOM_HREFS = [
  "/",
  "/content",
  "/production",
  "/assets",
  "/publishing",
];

const PROGRAMS = [
  { name: "Ke Dapur Yuk!", color: "bg-amber-500", tag: "🍳 Dapur" },
  { name: "Kepikiran Aja", color: "bg-indigo-500", tag: "🌙 Pikiran" },
  { name: "Eh, Ternyata!", color: "bg-emerald-500", tag: "💡 Fakta" },
];

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      router.push("/login");
      router.refresh();
    } catch {
      window.location.href = "/login";
    }
  };

  const mobileBottomItems = PRIMARY_NAV_ITEMS.filter((item) =>
    MOBILE_BOTTOM_HREFS.includes(item.href)
  );

  const currentDateFormatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-[#F8F9FE] text-slate-900 flex flex-col lg:flex-row antialiased selection:bg-indigo-100 selection:text-indigo-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Lewati ke konten utama
      </a>

      {/* Desktop Sidebar (Inspired by modern clean reference UI) */}
      <aside
        aria-label="Navigasi utama desktop"
        className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:border-indigo-100/80 lg:bg-white/95 lg:backdrop-blur-md lg:shadow-xs z-30"
      >
        {/* User / Workspace Profile Card */}
        <div className="p-4 border-b border-indigo-50">
          <div className="flex items-center justify-between rounded-2xl bg-indigo-50/50 p-3 border border-indigo-100/60 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white font-black text-sm shadow-xs">
                <span>OB</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-tight text-slate-900">
                  CeritaObim
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="truncate text-[11px] font-medium text-slate-500">
                    Online • Auto-Pilot
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/settings"
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
                title="Pengaturan Studio"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
                title="Keluar / Ganti Akun"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-3 custom-scrollbar">
          <div className="space-y-1">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-indigo-50/90 text-indigo-700 font-bold shadow-2xs border border-indigo-100/60"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "transition-transform duration-150 group-hover:scale-110",
                        active ? "text-indigo-600" : "text-slate-400"
                      )}
                    >
                      {ICON_MAP[item.href]}
                    </span>
                    <span>{item.label}</span>
                  </span>
                  {item.href === "/publishing" ? (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      Buffer
                    </span>
                  ) : active ? (
                    <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                  ) : null}
                </Link>
              );
            })}
          </div>

          {/* Program Section (Matching "My Projects" in Reference UI) */}
          <div className="pt-6 pb-2">
            <div className="flex items-center justify-between px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <span>Program Konten</span>
              <span className="text-[10px] lowercase text-slate-400">3 format</span>
            </div>
            <div className="space-y-1">
              {PROGRAMS.map((prog) => (
                <Link
                  key={prog.name}
                  href={`/content?program=${encodeURIComponent(prog.name)}`}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${prog.color}`} />
                    <span>{prog.name}</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-400">
                    {prog.tag}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* Bottom Sidebar: Mode Switcher */}
        <div className="p-4 border-t border-indigo-50 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Mode UI</span>
            <ModeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-indigo-100/80 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-xs">
            OB
          </div>
          <div>
            <span className="block text-sm font-bold leading-none text-slate-900">
              CeritaObim Studio
            </span>
            <span className="block text-[10px] text-emerald-600 font-semibold">
              ● Online
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <button
            type="button"
            onClick={() => setMobileDrawerOpen((prev) => !prev)}
            aria-expanded={mobileDrawerOpen}
            aria-label="Menu navigasi"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs"
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
        <div className="fixed inset-x-0 top-[57px] bottom-14 z-40 overflow-y-auto border-b border-indigo-100 bg-white p-4 shadow-xl lg:hidden">
          <div className="space-y-1">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={cn(
                    "flex items-center justify-between rounded-xl p-3 text-sm transition-colors",
                    active
                      ? "bg-indigo-50 font-bold text-indigo-700 border border-indigo-100"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={active ? "text-indigo-600" : "text-slate-400"}>
                      {ICON_MAP[item.href]}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.href === "/publishing" && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      Buffer
                    </span>
                  )}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setMobileDrawerOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center justify-between rounded-xl p-3 text-sm text-rose-600 hover:bg-rose-50 transition-colors font-semibold mt-3 border border-rose-100"
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-4 w-4" />
                <span>Keluar / Ganti Akun</span>
              </div>
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Subtle Top Header bar with Greeting context */}
        <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-2">
          <div>
            <p className="text-xs font-semibold text-slate-400 capitalize">
              {currentDateFormatted}
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Halo, Creator Obim 👋
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200/60 shadow-2xs">
                <Sparkles className="h-3 w-3 text-purple-600" />
                Origami Papercraft
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ModeToggle />
            <Link
              href="/tools"
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3.5 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition-colors"
            >
              <Wrench className="h-3.5 w-3.5 text-indigo-600" />
              <span>Status Engine</span>
            </Link>
          </div>
        </header>

        <main
          id="main-content"
          className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-4 max-w-7xl w-full mx-auto space-y-6"
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi bawah seluler"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-indigo-100 bg-white/95 backdrop-blur-md lg:hidden"
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
                  "flex flex-col items-center justify-center py-2.5 px-1 text-[10px] font-semibold transition-colors",
                  active
                    ? "text-indigo-600 font-bold"
                    : "text-slate-500 hover:text-slate-900"
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

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <StudioModeProvider>
      <AppShellInner>{children}</AppShellInner>
    </StudioModeProvider>
  );
}
