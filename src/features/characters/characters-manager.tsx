"use client";

import { useState, type FormEvent } from "react";
import {
  Users,
  Plus,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit3,
  Copy,
  Star,
  UserPlus,
  Image as ImageIcon,
  Volume2,
  ExternalLink,
} from "lucide-react";
import type {
  CharacterRoleType,
  StudioCharacterRecord,
} from "@/lib/characters/character-store";
import {
  DEFAULT_FREE_ELEVENLABS_VOICE_ID,
  ELEVENLABS_FREE_PREMADE_VOICES,
} from "@/lib/providers/tts/tts-provider";

interface CharactersManagerProps {
  initialCharacters: StudioCharacterRecord[];
}

export function CharactersManager({
  initialCharacters,
}: CharactersManagerProps) {
  const [characters, setCharacters] =
    useState<StudioCharacterRecord[]>(initialCharacters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<CharacterRoleType>("main");
  const [voiceId, setVoiceId] = useState<string>(
    DEFAULT_FREE_ELEVENLABS_VOICE_ID
  );
  const [visualCharacteristics, setVisualCharacteristics] = useState("");
  const [personalityTraits, setPersonalityTraits] = useState("");
  const [promptKeywordsEn, setPromptKeywordsEn] = useState("");
  const [isActiveDefault, setIsActiveDefault] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const mainCharacters = characters.filter((c) => c.role === "main");
  const supportingCharacters = characters.filter(
    (c) => c.role === "supporting"
  );

  const selectedVoiceOption =
    ELEVENLABS_FREE_PREMADE_VOICES.find((v) => v.id === voiceId) ??
    ELEVENLABS_FREE_PREMADE_VOICES[0]!;

  const resetForm = (defaultRole: CharacterRoleType = "supporting") => {
    setEditingId(null);
    setName("");
    setRole(defaultRole);
    setVoiceId(DEFAULT_FREE_ELEVENLABS_VOICE_ID);
    setVisualCharacteristics("");
    setPersonalityTraits("");
    setPromptKeywordsEn("");
    setIsActiveDefault(true);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleEdit = (char: StudioCharacterRecord) => {
    setEditingId(char.id);
    setName(char.name);
    setRole(char.role);
    setVoiceId(char.voiceId || DEFAULT_FREE_ELEVENLABS_VOICE_ID);
    setVisualCharacteristics(char.visualCharacteristics);
    setPersonalityTraits(char.personalityTraits);
    setPromptKeywordsEn(char.promptKeywordsEn);
    setIsActiveDefault(char.isActiveDefault);
    setSelectedFile(null);
    setPreviewUrl(
      char.imageFilename
        ? `/api/characters/image?file=${encodeURIComponent(char.imageFilename)}`
        : null
    );
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const voiceObj =
        ELEVENLABS_FREE_PREMADE_VOICES.find((v) => v.id === voiceId) ??
        ELEVENLABS_FREE_PREMADE_VOICES[0]!;

      const formData = new FormData();
      if (editingId) formData.append("id", editingId);
      formData.append("name", name);
      formData.append("role", role);
      formData.append("voiceId", voiceObj.id);
      formData.append("voiceName", voiceObj.name);
      formData.append("visualCharacteristics", visualCharacteristics);
      formData.append("personalityTraits", personalityTraits);
      formData.append("promptKeywordsEn", promptKeywordsEn);
      formData.append("isActiveDefault", String(isActiveDefault));
      if (selectedFile) {
        formData.append("imageFile", selectedFile);
      }

      const res = await fetch("/api/characters", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan karakter.");
      }

      setCharacters(data.characters);
      setFeedback({
        type: "success",
        text: editingId
          ? `Karakter "${name}" (Suara: ${voiceObj.name}) berhasil diperbarui!`
          : `Karakter baru "${name}" dengan suara "${voiceObj.name}" berhasil disimpan!`,
      });
      resetForm("supporting");
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menyimpan karakter.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (char: StudioCharacterRecord) => {
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_active",
          id: char.id,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.characters)) {
        setCharacters(data.characters);
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (char: StudioCharacterRecord) => {
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id: char.id,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.characters)) {
        setCharacters(data.characters);
        setFeedback({
          type: "success",
          text: `Karakter "${char.name}" telah dihapus.`,
        });
      }
    } catch {
      // ignore
    }
  };

  const handleCopyPrompt = async (char: StudioCharacterRecord) => {
    await navigator.clipboard.writeText(char.promptKeywordsEn);
    setFeedback({
      type: "success",
      text: `Deskripsi prompt "${char.name}" berhasil disalin ke clipboard!`,
    });
  };

  const renderCharacterCard = (char: StudioCharacterRecord) => {
    const matchedVoice = ELEVENLABS_FREE_PREMADE_VOICES.find(
      (v) => v.id === char.voiceId
    );

    return (
      <div
        key={char.id}
        className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-xs transition-all ${
          char.isActiveDefault
            ? "border-amber-300 bg-white ring-1 ring-amber-300/50"
            : "border-stone-200 bg-stone-50/70"
        }`}
      >
        <div className="flex items-start gap-3.5">
          {/* Reference Image Thumbnail */}
          <div className="relative h-28 w-22 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 flex items-center justify-center">
            {char.imageFilename ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/characters/image?file=${encodeURIComponent(
                  char.imageFilename
                )}`}
                alt={char.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-2 text-center text-[10px] text-stone-400">
                <ImageIcon className="h-5 w-5 mb-1 text-stone-400" />
                <span>Belum ada foto</span>
              </div>
            )}
          </div>

          {/* Character Info */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm font-bold text-stone-900">{char.name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    char.role === "main"
                      ? "bg-amber-600 text-white"
                      : "bg-sky-100 text-sky-900"
                  }`}
                >
                  {char.role === "main"
                    ? "★ Karakter Utama"
                    : "Karakter Sampingan"}
                </span>
                {char.isActiveDefault ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    ● Aktif Dipakai
                  </span>
                ) : (
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                    Nonaktif Sementara
                  </span>
                )}
              </div>
            </div>

            {/* Dedicated Voice Badge + Inline Audio Preview */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-sky-950">
                  <Volume2 className="h-3.5 w-3.5 text-sky-600" />
                  <span>
                    Suara Karakter:{" "}
                    {matchedVoice?.name ||
                      char.voiceName ||
                      "Puck Bold (Gemini AI) — Anak Laki-Laki Optimis, Semangat & Bold"}
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                    ⚡ Mode Creative (Dinamis)
                  </span>
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-sky-800">
                    ID: {char.voiceId || DEFAULT_FREE_ELEVENLABS_VOICE_ID}
                  </code>
                </div>
              </div>
              {matchedVoice?.previewUrl ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <audio
                    controls
                    preload="none"
                    src={matchedVoice.previewUrl}
                    className="h-7 w-52 sm:w-64"
                  />
                  <a
                    href={matchedVoice.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline"
                  >
                    <span>Buka sampel di tab baru</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : null}
            </div>

            <div className="text-xs text-stone-700 space-y-1">
              <p>
                <strong className="text-stone-900">Ciri Visual Origami:</strong>{" "}
                {char.visualCharacteristics || "-"}
              </p>
              <p>
                <strong className="text-stone-900">Sifat / Gestur Khas:</strong>{" "}
                {char.personalityTraits || "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5 text-xs">
          <button
            type="button"
            onClick={() => handleToggleActive(char)}
            className={`rounded-lg px-2.5 py-1.5 font-semibold ${
              char.isActiveDefault
                ? "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {char.isActiveDefault
              ? "Nonaktifkan Karakter"
              : "Jadikan Aktif"}
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleCopyPrompt(char)}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-stone-700 hover:bg-stone-100"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Prompt</span>
            </button>

            <button
              type="button"
              onClick={() => handleEdit(char)}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 font-bold text-white hover:bg-amber-700"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Karakter & Suara</span>
            </button>

            {characters.length > 1 ? (
              <button
                type="button"
                onClick={() => handleDelete(char)}
                className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                title="Hapus Karakter"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs sm:text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-rose-200 bg-rose-50 text-rose-950"
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

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left 7 Cols: Character List (Main + Supporting) */}
        <div className="space-y-5 lg:col-span-7">
          {/* Main Characters Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
                  Karakter Utama ({mainCharacters.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => resetForm("main")}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Karakter Utama</span>
              </button>
            </div>
            <div className="space-y-3">
              {mainCharacters.map(renderCharacterCard)}
            </div>
          </div>

          {/* Supporting Characters Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
                  Karakter Sampingan / Pendukung ({supportingCharacters.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => resetForm("supporting")}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-900 hover:bg-sky-100"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>+ Tambah Karakter Sampingan</span>
              </button>
            </div>

            {supportingCharacters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center">
                <Users className="mx-auto h-7 w-7 text-stone-400" />
                <p className="mt-2 text-xs font-bold text-stone-700">
                  Belum Ada Karakter Sampingan
                </p>
                <p className="mt-1 text-[11px] text-stone-500">
                  Tambahkan karakter teman, bos, dokter, atau orang tua di
                  formulir sebelah kanan beserta suara khusus mereka.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {supportingCharacters.map(renderCharacterCard)}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Add / Edit Character Form with Voice Selector & Preview */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleSubmit}
            className="sticky top-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  {editingId ? "Mode Edit Karakter & Suara" : "Tambah Karakter Baru"}
                </span>
                <h3 className="text-sm font-bold text-stone-900">
                  {editingId
                    ? `Edit Karakter: ${name}`
                    : "1 Karakter = 1 Gambar & 1 Suara"}
                </h3>
              </div>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => resetForm("supporting")}
                  className="text-xs font-semibold text-sky-700 underline"
                >
                  + Buat Baru
                </button>
              ) : null}
            </div>

            {/* Image Upload Box */}
            <div>
              <label className="block text-xs font-bold text-stone-800">
                1. Gambar Referensi Karakter
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-stone-300 bg-stone-100 flex items-center justify-center">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Upload className="h-5 w-5 text-stone-400" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleFileChange(e.target.files?.[0] ?? null)
                    }
                    className="block w-full text-xs text-stone-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-amber-900 hover:file:bg-amber-200"
                  />
                  <p className="mt-1 text-[11px] text-stone-500">
                    Upload gambar kertas origami karakter (PNG/JPG).
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-stone-800">
                  2. Nama Karakter *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Obim / Raka"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-xs focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800">
                  3. Peran Karakter *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as CharacterRoleType)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                >
                  <option value="main">★ Karakter Utama</option>
                  <option value="supporting">👥 Karakter Sampingan</option>
                </select>
              </div>
            </div>

            {/* Dedicated Voice Selector with Live Audio Preview */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 space-y-2">
              <label className="block text-xs font-bold text-sky-950">
                4. 🎙️ Pilih Suara Khusus Karakter Ini (21 Suara Gratis API) *
              </label>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-stone-900 focus:border-sky-600 focus:outline-none"
              >
                {ELEVENLABS_FREE_PREMADE_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.gender === "male"
                      ? "👨"
                      : v.gender === "female"
                      ? "👩"
                      : "🧑"}{" "}
                    {v.name} — ({v.characterFit})
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <audio
                  key={selectedVoiceOption.id}
                  controls
                  preload="none"
                  src={selectedVoiceOption.previewUrl}
                  className="h-8 w-52 sm:w-60"
                />
                <a
                  href={selectedVoiceOption.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:underline"
                >
                  <span>Dengar di Tab Baru</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-[11px] text-sky-900">
                Cocok untuk: <strong>{selectedVoiceOption.characterFit}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800">
                5. Ciri Visual & Fisik (Warna Kertas, Pakaian, Aksesoris) *
              </label>
              <textarea
                rows={3}
                required
                value={visualCharacteristics}
                onChange={(e) => setVisualCharacteristics(e.target.value)}
                placeholder="Contoh: Karakter lipatan kertas origami warna hijau mint, memakai kacamata kertas hitam tebal..."
                className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-xs focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800">
                6. Sifat / Karakteristik & Gestur Khas
              </label>
              <textarea
                rows={2}
                value={personalityTraits}
                onChange={(e) => setPersonalityTraits(e.target.value)}
                placeholder="Contoh: Santai, suka ngopi, sering mengangguk setuju..."
                className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-xs focus:border-amber-600 focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isActiveDefault}
                onChange={(e) => setIsActiveDefault(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-amber-600"
              />
              <span>
                Aktifkan karakter & suaranya untuk produksi saat ini
              </span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50"
            >
              {saving
                ? "Menyimpan Karakter & Suara..."
                : editingId
                ? "Simpan Perubahan Karakter & Suara"
                : "+ Simpan Karakter & Suara"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
