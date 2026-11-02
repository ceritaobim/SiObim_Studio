"use client";

import { useState, useEffect, type FormEvent } from "react";
import {
  KeyRound,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit3,
  Sparkles,
  Volume2,
  Check,
  Info,
  Zap,
} from "lucide-react";
import type {
  ElevenLabsModelId,
  ElevenLabsQuotaInfo,
  MaskedProviderProfile,
} from "@/lib/providers/account-profiles";
import type { FlowProfileAccount } from "@/lib/providers/flow-accounts-service";

interface AccountProfileSwitcherProps {
  focusMode?: "elevenlabs" | "all";
  defaultExpanded?: boolean;
  onProfileChanged?: (profile: MaskedProviderProfile) => void;
}

export function AccountProfileSwitcher({
  focusMode = "all",
  defaultExpanded = false,
  onProfileChanged,
}: AccountProfileSwitcherProps) {
  const [profiles, setProfiles] = useState<MaskedProviderProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [quotas, setQuotas] = useState<ElevenLabsQuotaInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkingLiveAll, setCheckingLiveAll] = useState<boolean>(false);
  const [checkingLiveId, setCheckingLiveId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<boolean>(false);
  const [showAddEditForm, setShowAddEditForm] =
    useState<boolean>(defaultExpanded);
  const [flowAccounts, setFlowAccounts] = useState<FlowProfileAccount[]>([]);

  // Form state for adding/editing an account bundle
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState("");
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState(
    "UgBBYS2sOqTuMpoF3BR0"
  );
  const [elevenlabsModelId, setElevenlabsModelId] =
    useState<ElevenLabsModelId>("eleven_flash_v2_5");
  const [localCreditLimit, setLocalCreditLimit] = useState<number>(10000);
  const [localUsedCredits, setLocalUsedCredits] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [savingForm, setSavingForm] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadVault = async (options?: {
    live?: boolean;
    profileId?: string;
  }) => {
    if (options?.profileId) {
      setCheckingLiveId(options.profileId);
    } else if (options?.live) {
      setCheckingLiveAll(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (options?.live) params.set("live", "1");
      if (options?.profileId) params.set("profileId", options.profileId);

      const res = await fetch(
        `/api/account-profiles${params.toString() ? `?${params.toString()}` : ""}`
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
        setActiveProfileId(data.activeProfileId);

        if (options?.profileId && Array.isArray(data.quotas)) {
          const updatedSingle = (data.quotas as ElevenLabsQuotaInfo[]).find(
            (q) => q.profileId === options.profileId
          );
          if (updatedSingle) {
            setQuotas((prev) =>
              prev.map((q) =>
                q.profileId === options.profileId ? updatedSingle : q
              )
            );
          }
        } else {
          setQuotas(data.quotas ?? []);
        }

        if (options?.live) {
          void loadFlowAccounts();
          setFeedback({
            type: "success",
            text: options.profileId
              ? "Pengecekan Real-Time API (ElevenLabs & Google Gemini) selesai untuk akun ini!"
              : "Pengecekan Real-Time seluruh akun selesai!",
          });
        }
      }
    } catch {
      // ignore initial fetch error
    } finally {
      setLoading(false);
      setCheckingLiveAll(false);
      setCheckingLiveId(null);
    }
  };

  const loadFlowAccounts = async () => {
    try {
      const res = await fetch("/api/flow-accounts");
      const data = await res.json();
      if (res.ok && Array.isArray(data.accounts)) {
        setFlowAccounts(data.accounts);
      }
    } catch {}
  };

  useEffect(() => {
    void loadVault();
    void loadFlowAccounts();
  }, []);

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;

  const handleSelectProfile = async (profileId: string) => {
    if (profileId === activeProfileId) return;
    setSwitching(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/account-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_active",
          profileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengganti profil akun.");
      }
      setProfiles(data.profiles);
      setActiveProfileId(data.activeProfileId);
      setQuotas(data.quotas ?? []);
      const newlyActive = (data.profiles as MaskedProviderProfile[]).find(
        (p) => p.id === data.activeProfileId
      );
      if (newlyActive) {
        setFeedback({
          type: "success",
          text: `Berpindah ke akun aktif: ${newlyActive.label} ${
            newlyActive.googleEmail ? `(${newlyActive.googleEmail})` : ""
          }`,
        });
        if (onProfileChanged) {
          onProfileChanged(newlyActive);
        }
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal mengganti profil akun.",
      });
    } finally {
      setSwitching(false);
    }
  };

  const handleChangeModel = async (newModel: ElevenLabsModelId) => {
    if (!activeProfile) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/account-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          id: activeProfile.id,
          label: activeProfile.label,
          elevenlabsModelId: newModel,
          setAsActive: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfiles(data.profiles);
        setActiveProfileId(data.activeProfileId);
        setQuotas(data.quotas ?? []);
      }
    } finally {
      setSwitching(false);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setLabel(`Akun Google ${profiles.length + 1}`);
    setGoogleEmail("");
    setGeminiApiKey("");
    setElevenlabsApiKey("");
    setElevenlabsVoiceId(
      activeProfile?.elevenlabsVoiceId || "UgBBYS2sOqTuMpoF3BR0"
    );
    setElevenlabsModelId(
      activeProfile?.elevenlabsModelId || "eleven_flash_v2_5"
    );
    setLocalCreditLimit(10000);
    setLocalUsedCredits(0);
    setNotes("");
    setShowAddEditForm(true);
  };

  const openEditForm = (p: MaskedProviderProfile) => {
    setEditingId(p.id);
    setLabel(p.label);
    setGoogleEmail(p.googleEmail || "");
    setGeminiApiKey("");
    setElevenlabsApiKey("");
    setElevenlabsVoiceId(p.elevenlabsVoiceId || "UgBBYS2sOqTuMpoF3BR0");
    setElevenlabsModelId(p.elevenlabsModelId || "eleven_flash_v2_5");
    setLocalCreditLimit(p.localCreditLimit || 10000);
    setLocalUsedCredits(p.localUsedCredits || 0);
    setNotes(p.notes || "");
    setShowAddEditForm(true);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingForm(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/account-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          id: editingId || undefined,
          label,
          googleEmail,
          geminiApiKey,
          elevenlabsApiKey,
          elevenlabsVoiceId,
          elevenlabsModelId,
          localCreditLimit: Number(localCreditLimit) || 10000,
          localUsedCredits: Number(localUsedCredits) || 0,
          notes,
          setAsActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan akun.");
      }
      setProfiles(data.profiles);
      setActiveProfileId(data.activeProfileId);
      setQuotas(data.quotas ?? []);
      if (!defaultExpanded) {
        setShowAddEditForm(false);
      }
      setFeedback({
        type: "success",
        text: editingId
          ? `Profil "${label}" berhasil diperbarui & diaktifkan!`
          : `Profil baru "${label}" berhasil ditambahkan & langsung diaktifkan!`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menyimpan profil.",
      });
    } finally {
      setSavingForm(false);
    }
  };

  const handleDeleteProfile = async (
    profileId: string,
    profileLabel: string
  ) => {
    setSwitching(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/account-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          profileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus profil.");
      }
      setProfiles(data.profiles);
      setActiveProfileId(data.activeProfileId);
      setQuotas(data.quotas ?? []);
      setFeedback({
        type: "success",
        text: `Profil "${profileLabel}" dihapus.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menghapus profil.",
      });
    } finally {
      setSwitching(false);
    }
  };

  const totalRemainingAllAccounts = quotas.reduce(
    (sum, q) => sum + (q.remainingCharacters ?? 0),
    0
  );
  const totalLimitAllAccounts = quotas.reduce(
    (sum, q) => sum + (q.characterLimit ?? 10000),
    0
  );
  const totalGeminiTtsRemaining = profiles.reduce((sum, p) => {
    const q = quotas.find((item) => item.profileId === p.id);
    const rem = q?.geminiTtsRemainingToday ?? p.geminiTtsRemainingToday ?? 0;
    return sum + (p.hasGeminiKey ? rem : 0);
  }, 0);
  const totalGeminiTtsLimit = profiles.reduce(
    (sum, p) => sum + (p.hasGeminiKey ? p.geminiTtsLimitPerDay || 10 : 0),
    0
  );
  const totalFlowCredits = flowAccounts.reduce((sum, fa) => sum + fa.credits, 0);
  const totalFlowMax = flowAccounts.length > 0 ? flowAccounts.length * 50 : 500;
  const totalFlowVideos = Math.floor(totalFlowCredits / 3);
  const anyMissingUserRead = quotas.some((q) => q.missingUserReadPermission);

  return (
    <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/80 via-white to-amber-50/40 p-4 shadow-xs space-y-3.5">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-900">
                Daftar Akun Produksi & Cek Real-Time Kuota ({profiles.length} Akun)
              </span>
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-950">
                Total Sisa Google Flow: {totalFlowCredits} / {totalFlowMax} Kredit (~{totalFlowVideos} Video Siap)
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-950">
                Total Sisa Gemini TTS Hari Ini: {totalGeminiTtsRemaining} /{" "}
                {totalGeminiTtsLimit} Audio (Reset Setiap Hari)
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                Total Sisa ElevenLabs:{" "}
                {totalRemainingAllAccounts.toLocaleString("id-ID")} /{" "}
                {totalLimitAllAccounts.toLocaleString("id-ID")} kredit
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Setiap akun memiliki <strong>Google Flow Chrome Profil (target 50 kredit)</strong>, <strong>kuota harian Gemini AI</strong> (
              <strong>10 Audio TTS/hari</strong> untuk suara Obim{" "}
              <strong>10 Audio TTS/hari</strong> untuk suara Obim{" "}
              <em>Puck Bold</em> + <strong>1.500 Text Request/hari</strong>,
              reset setiap hari) serta{" "}
              <strong>kredit bulanan ElevenLabs</strong> (10.000 kredit/akun).
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {focusMode === "elevenlabs" || focusMode === "all" ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5">
              <Volume2 className="h-3.5 w-3.5 text-sky-600" />
              <span className="text-[11px] font-semibold text-stone-500">
                Mode:
              </span>
              <select
                aria-label="Pilih Model ElevenLabs"
                disabled={switching}
                value={
                  activeProfile?.elevenlabsModelId || "eleven_flash_v2_5"
                }
                onChange={(e) =>
                  handleChangeModel(e.target.value as ElevenLabsModelId)
                }
                className="rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-900 focus:outline-none"
              >
                <option value="eleven_flash_v2_5">
                  ⚡ Flash v2.5 (Hemat 50% • 0.5 kredit/huruf)
                </option>
                <option value="eleven_turbo_v2_5">
                  🚀 Turbo v2.5 (Hemat 50% • 0.5 kredit/huruf)
                </option>
                <option value="eleven_multilingual_v2">
                  🎙️ Multilingual v2 (Standar • 1 kredit/huruf)
                </option>
              </select>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void loadVault({ live: true })}
            disabled={loading || checkingLiveAll || switching}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 font-bold text-white shadow-2xs hover:bg-amber-700 disabled:opacity-50"
          >
            <Zap
              className={`h-3.5 w-3.5 ${checkingLiveAll ? "animate-pulse" : ""}`}
            />
            <span>
              {checkingLiveAll
                ? "Mengecek Real-Time..."
                : "⚡ Trigger Cek Real-Time Semua Akun"}
            </span>
          </button>

          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 font-bold text-white shadow-2xs hover:bg-sky-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Tambah Akun Baru</span>
          </button>
        </div>
      </div>

      {/* Important Banner if ElevenLabs API Key is missing User -> Read permission */}
      {anyMissingUserRead ? (
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">
                ⚠️ Kenapa Kredit Asli ElevenLabs Belum Bisa Ditarik Langsung dari Server?
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900">
                Saat kami menembak server ElevenLabs, API Key Anda menjawab:{" "}
                <code className="rounded bg-amber-100 px-1 font-mono">
                  missing_permissions: user_read
                </code>{" "}
                (dan <strong>Akun Google 5</strong> key ElevenLabs-nya tidak valid / 401). Supaya angka kredit yang tampil adalah{" "}
                <strong>100% angka asli dari server ElevenLabs</strong> (misal sisa 8.312 kredit), silakan buka{" "}
                <strong>ElevenLabs &rarr; Developers &rarr; API Keys &rarr; Edit Key</strong> lalu aktifkan izin{" "}
                <strong>User: Read</strong> (atau pilih <em>Unrestricted</em>), lalu klik tombol{" "}
                <strong>⚡ Trigger Cek Real-Time</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Stacked List of All Accounts & Their Quotas */}
      <div className="space-y-2.5">
        {profiles.map((p, index) => {
          const isSelected = p.id === activeProfileId;
          const q = quotas.find((item) => item.profileId === p.id);
          const rem =
            q?.remainingCharacters ?? p.localCreditLimit - p.localUsedCredits;
          const lim = q?.characterLimit || p.localCreditLimit || 10000;
          const used = q?.characterCount ?? p.localUsedCredits;
          const pctRemaining = Math.min(
            100,
            Math.max(0, Math.round((rem / Math.max(1, lim)) * 100))
          );
          const isFlash =
            (p.elevenlabsModelId || "eleven_flash_v2_5") !==
            "eleven_multilingual_v2";
          const estVideos = Math.max(
            0,
            Math.floor((isFlash ? rem * 2 : rem) / 650)
          );
          const isCheckingThis = checkingLiveId === p.id;
          const matchingFlow =
            flowAccounts.find((fa) => {
              if (
                p.googleEmail &&
                fa.email &&
                p.googleEmail.trim().toLowerCase() === fa.email.trim().toLowerCase()
              ) {
                return true;
              }
              const matchNum = p.label.match(/\d+/);
              if (matchNum && Number(matchNum[0]) === fa.index) {
                return true;
              }
              return false;
            }) ||
            flowAccounts[index] ||
            null;

          return (
            <div
              key={p.id}
              className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 transition-all lg:flex-row lg:items-center ${
                isSelected
                  ? "border-sky-500 bg-white shadow-xs ring-2 ring-sky-500/20"
                  : "border-stone-200 bg-white/85 hover:border-sky-300 hover:bg-white"
              }`}
            >
              {/* Col 1: Account Number, Label, Email */}
              <div className="flex items-start gap-3 lg:w-56 xl:w-64">
                <button
                  type="button"
                  disabled={switching}
                  onClick={() => handleSelectProfile(p.id)}
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-bold text-xs transition-colors ${
                    isSelected
                      ? "bg-emerald-600 text-white"
                      : "border border-stone-300 bg-stone-100 text-stone-600 hover:bg-sky-100 hover:text-sky-800"
                  }`}
                  title={isSelected ? "Sedang Aktif" : "Klik untuk Mengaktifkan"}
                >
                  {isSelected ? <Check className="h-4 w-4" /> : index + 1}
                </button>

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-900 sm:text-sm">
                      {p.label}
                    </span>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        ● AKTIF
                      </span>
                    ) : null}
                  </div>
                  {p.googleEmail ? (
                    <span className="block truncate font-mono text-[11px] font-semibold text-stone-600">
                      {p.googleEmail}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Col 2: ElevenLabs Real-Time Credit Box */}
              <div className="flex-1 rounded-xl border border-stone-200/90 bg-stone-50/70 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                  <span className="inline-flex items-center gap-1 font-bold text-stone-800">
                    <Volume2 className="h-3.5 w-3.5 text-sky-600" />
                    <span>ElevenLabs:</span>
                    <code className="font-mono text-[11px] font-normal text-stone-500">
                      {p.elevenlabsKeyPreview}
                    </code>
                  </span>

                  {q?.status === "ok" ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      ✓ Real-Time Server ElevenLabs
                    </span>
                  ) : q?.elevenlabsTtsReady === false ? (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                      ✗ Key Error / 401 Tidak Valid
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                      ✓ TTS Ready (Butuh Izin User Read utk Angka Server)
                    </span>
                  )}
                </div>

                {p.hasElevenlabsKey ? (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-700">
                        Sisa Kredit:{" "}
                        <strong
                          className={`font-mono text-xs ${
                            q?.elevenlabsTtsReady === false || rem < 1000
                              ? "text-rose-600"
                              : "text-emerald-700"
                          }`}
                        >
                          {q?.elevenlabsTtsReady === false
                            ? "0 (Key Salah)"
                            : rem.toLocaleString("id-ID")}
                        </strong>{" "}
                        / {lim.toLocaleString("id-ID")}
                        <span className="ml-1 text-[10px] text-stone-400">
                          (Terpakai: {used.toLocaleString("id-ID")})
                        </span>
                      </span>
                      <span className="font-bold text-sky-800">
                        ~{q?.elevenlabsTtsReady === false ? 0 : estVideos} Video
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                      <div
                        className={`h-full transition-all ${
                          q?.elevenlabsTtsReady === false || rem < 1000
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${
                            q?.elevenlabsTtsReady === false ? 100 : pctRemaining
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] italic text-rose-600">
                    Belum ada API Key ElevenLabs
                  </p>
                )}
              </div>

              {/* Col 3: Google Gemini Real-Time Quota Box */}
              <div className="flex-1 rounded-xl border border-stone-200/90 bg-stone-50/70 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                  <span className="inline-flex items-center gap-1 font-bold text-stone-800">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    <span>Google Gemini AI:</span>
                    <code className="font-mono text-[11px] font-normal text-stone-500">
                      {p.geminiKeyPreview}
                    </code>
                  </span>

                  {q?.geminiStatus === "ok" ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      ✓ Kuota Tersedia
                    </span>
                  ) : q?.geminiStatus === "quota_exceeded" ? (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                      ✗ 429 Kuota TTS Habis Hari Ini
                    </span>
                  ) : q?.geminiStatus === "error" ? (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                      Key Error
                    </span>
                  ) : (
                    <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">
                      Belum Diisi
                    </span>
                  )}
                </div>

                {p.hasGeminiKey ? (
                  (() => {
                    const gLim =
                      q?.geminiTtsLimitPerDay ?? p.geminiTtsLimitPerDay ?? 10;
                    const gUsed =
                      q?.geminiTtsUsedToday ?? p.geminiTtsUsedToday ?? 0;
                    const gRem =
                      q?.geminiTtsRemainingToday ??
                      p.geminiTtsRemainingToday ??
                      Math.max(0, gLim - gUsed);
                    const gPct = Math.min(
                      100,
                      Math.max(0, Math.round((gRem / Math.max(1, gLim)) * 100))
                    );

                    return (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-stone-700">
                            Sisa Audio TTS Hari Ini:{" "}
                            <strong
                              className={`font-mono text-xs ${
                                gRem <= 0 ? "text-rose-600" : "text-emerald-700"
                              }`}
                            >
                              {gRem}
                            </strong>{" "}
                            / {gLim} Audio
                            <span className="ml-1 text-[10px] text-stone-400">
                              (Terpakai: {gUsed})
                            </span>
                          </span>
                          <span className="font-bold text-amber-800">
                            Text: 1.500/hari
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                          <div
                            className={`h-full transition-all ${
                              gRem <= 0
                                ? "bg-rose-500"
                                : gRem <= 3
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${gRem <= 0 ? 100 : gPct}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="mt-1 text-[11px] italic text-rose-600">
                    API Key Gemini belum diisi
                  </p>
                )}
              </div>

              {/* Col 4: Google Flow Chrome Profile Credit Box */}
              <div className="flex-1 rounded-xl border border-stone-200/90 bg-stone-50/70 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                  <span className="inline-flex items-center gap-1 font-bold text-stone-800">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Google Flow:</span>
                    <code className="font-mono text-[11px] font-normal text-stone-500">
                      {matchingFlow
                        ? `Profil #${matchingFlow.index} (${matchingFlow.dirName})`
                        : "Profil Chrome"}
                    </code>
                  </span>

                  {matchingFlow ? (
                    matchingFlow.credits >= 15 ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        ✓ Kuota Siap
                      </span>
                    ) : matchingFlow.credits > 0 ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                        ⚠️ Menipis
                      </span>
                    ) : (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                        ✗ Limit / 0 Kredit
                      </span>
                    )
                  ) : (
                    <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">
                      Chrome Profil
                    </span>
                  )}
                </div>

                {matchingFlow ? (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-700">
                        Sisa Kredit:{" "}
                        <strong
                          className={`font-mono text-xs ${
                            matchingFlow.credits <= 0
                              ? "text-rose-600"
                              : matchingFlow.credits < 15
                              ? "text-amber-600"
                              : "text-indigo-700"
                          }`}
                        >
                          {matchingFlow.credits}
                        </strong>{" "}
                        / 50
                        <span className="ml-1 text-[10px] text-stone-400">
                          (Terpakai: {50 - matchingFlow.credits})
                        </span>
                      </span>
                      <span className="font-bold text-indigo-700">
                        ~{Math.floor(matchingFlow.credits / 3)} Video
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                      <div
                        className={`h-full transition-all ${
                          matchingFlow.credits <= 0
                            ? "bg-rose-500"
                            : matchingFlow.credits < 15
                            ? "bg-amber-500"
                            : "bg-indigo-600"
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round((matchingFlow.credits / 50) * 100)
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] italic text-stone-500">
                    Buka Makro Menu [5] untuk sinkron kredit profil
                  </p>
                )}
              </div>

              {/* Col 5: Trigger Real-Time Check & Switch Actions */}
              <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
                <button
                  type="button"
                  disabled={isCheckingThis || checkingLiveAll}
                  onClick={() => void loadVault({ live: true, profileId: p.id })}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  title="Cek Real-Time Kuota ElevenLabs & Gemini untuk akun ini"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${isCheckingThis ? "animate-spin" : ""}`}
                  />
                  <span>{isCheckingThis ? "Cek..." : "Cek Real-Time"}</span>
                </button>

                {!isSelected ? (
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => handleSelectProfile(p.id)}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 font-bold text-white shadow-2xs hover:bg-sky-700 disabled:opacity-50"
                  >
                    Pakai
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => openEditForm(p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-stone-700 hover:bg-stone-100"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Edit</span>
                </button>

                {profiles.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(p.id, p.label)}
                    className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                    title="Hapus Akun"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {feedback ? (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      {/* Add / Edit Account Form */}
      {showAddEditForm ? (
        <form
          onSubmit={handleSaveProfile}
          className="space-y-3 rounded-xl border border-sky-200 bg-white p-4 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sky-800">
              {editingId
                ? `Edit Paket Akun: ${label}`
                : "Tambah Paket Akun Google Baru"}
            </h4>
            {editingId ? (
              <button
                type="button"
                onClick={openAddForm}
                className="text-[11px] font-semibold text-sky-700 underline"
              >
                + Buat Akun Baru Saja
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[11px] font-bold text-stone-700">
                1. Nama Label Akun *
              </label>
              <input
                type="text"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Contoh: Akun Google 3"
                className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700">
                2. Email Akun Google
              </label>
              <input
                type="text"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                placeholder="emailakun@gmail.com"
                className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700">
                3. 🔊 ElevenLabs API Key (`sk_...`)
              </label>
              <input
                type="password"
                value={elevenlabsApiKey}
                onChange={(e) => setElevenlabsApiKey(e.target.value)}
                placeholder={
                  editingId
                    ? "Kosongkan jika tidak ganti key"
                    : "Tempel sk_..."
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 font-mono text-xs focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700">
                4. ✨ Gemini API Key (Opsional)
              </label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder={
                  editingId
                    ? "Kosongkan jika tidak ganti key"
                    : "AIza... / AQ...."
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 font-mono text-xs focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700">
                Voice ID ElevenLabs (Mark Default)
              </label>
              <input
                type="text"
                value={elevenlabsVoiceId}
                onChange={(e) => setElevenlabsVoiceId(e.target.value)}
                placeholder="UgBBYS2sOqTuMpoF3BR0"
                className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 font-mono text-xs focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700">
                Kuota Awal Akun (Default Gratis = 10.000)
              </label>
              <input
                type="number"
                value={localCreditLimit}
                onChange={(e) => setLocalCreditLimit(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 font-mono text-xs focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700">
                Kredit yang Sudah Terpakai Saat Ini
              </label>
              <input
                type="number"
                value={localUsedCredits}
                onChange={(e) => setLocalUsedCredits(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 font-mono text-xs focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {!defaultExpanded ? (
              <button
                type="button"
                onClick={() => setShowAddEditForm(false)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                Tutup Form
              </button>
            ) : null}
            <button
              type="submit"
              disabled={savingForm}
              className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {savingForm
                ? "Menyimpan..."
                : editingId
                ? "Simpan Perubahan Akun"
                : "Simpan & Aktifkan Akun"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
