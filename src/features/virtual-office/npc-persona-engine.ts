import type { StoreSnapshot } from "@/features/telegram/studio-store-manager";
import type { FlowProfileAccount } from "@/lib/providers/flow-accounts-service";
import { listContentItems } from "@/lib/db/repository";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import type { ContentItemRecord } from "@/types/domain";
import { NPC_PERSONA_CATALOG, type NpcPersonaProfile } from "./npc-personas";

export { NPC_PERSONA_CATALOG, type NpcPersonaProfile };

export interface NpcAssignedWorkContext {
  persona: NpcPersonaProfile;
  account: FlowProfileAccount | null;
  lastCompletedItem: ContentItemRecord;
  currentAssignedItem: ContentItemRecord;
  allAssignedItems: ContentItemRecord[];
}

/**
 * Resolves the real database content items and Chrome profile status specifically assigned to an NPC!
 */
export async function getNpcAssignedWorkContext(
  memberId: string,
  profileIndex: number | undefined,
  accounts: FlowProfileAccount[]
): Promise<NpcAssignedWorkContext> {
  const persona =
    NPC_PERSONA_CATALOG[memberId] ||
    (profileIndex ? NPC_PERSONA_CATALOG[`editor-p${profileIndex}`] : undefined) ||
    NPC_PERSONA_CATALOG["pic-video"]!;

  const resolvedProfileIndex = profileIndex ?? persona.profileIndex;
  const account = resolvedProfileIndex
    ? accounts.find((a) => a.index === resolvedProfileIndex) ?? null
    : null;

  const allItems = await listContentItems(DEFAULT_OWNER_ID);

  // Match items by persona.assignedCodes first, plus deterministic modulo distribution across items
  const matchedByCode = allItems.filter((item) =>
    persona.assignedCodes.includes(item.contentCode.toUpperCase())
  );

  // Also include deterministic index-based items if database has more items
  const seedIndex = resolvedProfileIndex ? resolvedProfileIndex - 1 : 0;
  const fallbackItem1 = allItems[seedIndex % Math.max(1, allItems.length)]!;
  const fallbackItem2 = allItems[(seedIndex + 4) % Math.max(1, allItems.length)]!;

  const assignedList =
    matchedByCode.length > 0 ? matchedByCode : [fallbackItem1, fallbackItem2].filter(Boolean);

  const lastCompletedItem = assignedList[0] || fallbackItem1;
  const currentAssignedItem = assignedList[1] || assignedList[0] || fallbackItem2;

  return {
    persona,
    account,
    lastCompletedItem,
    currentAssignedItem,
    allAssignedItems: assignedList,
  };
}

/**
 * Generates a role-authentic, personalized response for an NPC when the CEO talks to them in the 3D Virtual Office.
 */
export async function generatePersonalizedNpcReply(params: {
  memberId: string;
  memberName: string;
  memberRole: string;
  profileIndex?: number;
  userText: string;
  snapshot: StoreSnapshot;
  accounts: FlowProfileAccount[];
}): Promise<string> {
  const ctx = await getNpcAssignedWorkContext(
    params.memberId,
    params.profileIndex,
    params.accounts
  );
  const { persona, account, lastCompletedItem, currentAssignedItem, allAssignedItems } = ctx;
  const q = params.userText.toLowerCase().trim();

  const creditStatusText = account
    ? account.credits === 0
      ? `sedang istirahat di Lounge Warkop Obim karena kuota akun Chrome \`${account.name}\` habis (*0/${account.maxCredits} credits*)`
      : `standby di ${persona.workstationLabel} dengan sisa kuota *${account.credits}/${account.maxCredits} credits* pada akun Chrome \`${account.name}\``
    : `aktif bertugas di *${persona.workstationLabel}*`;

  // ==========================================================================
  // 1. PERTANYAAN TENTANG VIDEO / NASKAH / TUGAS TERAKHIR YANG DI-GENERATE / DIKERJAKAN
  // ==========================================================================
  const isAskingLastVideoOrWork =
    q.includes("terakhir") ||
    q.includes("terahir") ||
    q.includes("generate") ||
    q.includes("bikin apa") ||
    q.includes("buat apa") ||
    q.includes("ngerjain apa") ||
    q.includes("kerjakan") ||
    q.includes("garap apa") ||
    q.includes("video apa") ||
    q.includes("naskah apa") ||
    q.includes("proyek apa") ||
    q === "last_work";

  if (isAskingLastVideoOrWork) {
    if (persona.division === "video-prod" && !persona.memberId.startsWith("pic")) {
      return (
        `🎬 *Laporan Render ${persona.name} (${persona.workstationLabel})*\n\n` +
        `Video terakhir yang saya generate di Google Flow menggunakan profil Chrome \`${account?.name || `Profil ${persona.profileIndex}`}\` adalah:\n` +
        `• *Kode & Judul:* \`${lastCompletedItem.contentCode}\` — *"${lastCompletedItem.title}"*\n` +
        `• *Kategori:* ${lastCompletedItem.category} (~${lastCompletedItem.targetDurationSeconds} detik)\n` +
        `• *Spesialisasi Adegan Saya:* ${persona.sceneFocus}\n` +
        `• *Hook Visual:* _"${lastCompletedItem.hook}"_\n\n` +
        `📌 *Antrean Tugas Berikutnya di Meja Saya:* \`${currentAssignedItem.contentCode}\` (*"${currentAssignedItem.title}"*).\n` +
        ` Saat ini saya ${creditStatusText}.`
      );
    }

    if (persona.memberId === "pic-video") {
      const top11 = params.accounts.slice(0, 11);
      const activeCount = top11.filter((a) => a.credits > 0).length;
      const restingCount = top11.filter((a) => a.credits === 0).length;
      return (
        `👑 *Laporan Komando Produksi Video — ${persona.name}*\n\n` +
        `Sebagai PIC Produksi Video, batch perakitan \`00Final.mp4\` terakhir yang saya supervisi bersama 11 Profil Chrome adalah:\n` +
        `• *Batch Selesai:* \`${lastCompletedItem.contentCode}\` (*"${lastCompletedItem.title}"*) — 8 klip scene origami telah dirakit utuh (${lastCompletedItem.targetDurationSeconds} detik).\n` +
        `• *Sedang Diproses Tim:* \`${currentAssignedItem.contentCode}\` (*"${currentAssignedItem.title}"*).\n` +
        `• *Kondisi Pasukan Render:* *${activeCount} profil* standby di meja kerja, *${restingCount} profil* sedang istirahat di Warkop Obim.\n\n` +
        `Kalau Bos mau cek detail klip per editor, tiap meja Profil 1 s/d 11 memegang segmen dan topik berbeda!`
      );
    }

    if (persona.memberId === "pic-script") {
      return (
        `✍️ *Laporan Produser & Kepala Naskah — ${persona.name}*\n\n` +
        `Naskah terakhir yang saya finalisasi dan setujui untuk masuk dapur produksi adalah:\n` +
        `• *Judul Naskah:* \`${lastCompletedItem.contentCode}\` — *"${lastCompletedItem.title}"*\n` +
        `• *Hook 3 Detik Pertama:* _"${lastCompletedItem.hook}"_\n` +
        `• *CTA Penutup:* _"${lastCompletedItem.cta}"_\n\n` +
        `Saat ini saya sedang menggodok struktur narasi \`${currentAssignedItem.contentCode}\` (*"${currentAssignedItem.title}"*) agar retensi penonton tetap di atas 65%!`
      );
    }

    if (persona.memberId === "script-writer-1") {
      const claim =
        lastCompletedItem.factualClaims?.[0] ||
        lastCompletedItem.topic ||
        "Riset psikologi & biologi populer terverifikasi";
      return (
        `🔬 *Laporan Riset Fakta Ilmiah — ${persona.name}*\n\n` +
        `Topik riset terakhir yang selesai saya verifikasi datanya adalah:\n` +
        `• *Topik Konten:* \`${lastCompletedItem.contentCode}\` — *"${lastCompletedItem.title}"*\n` +
        `• *Landasan Ilmiah:* ${claim}\n` +
        `• *Status Verifikasi:* Terverifikasi (${lastCompletedItem.category})\n\n` +
        `Sekarang saya sedang membedah jurnal untuk konten \`${currentAssignedItem.contentCode}\` (*"${currentAssignedItem.title}"*) supaya penjelasannya akurat tapi tetap ringan didengar!`
      );
    }

    if (persona.memberId === "script-prompt-eng") {
      return (
        `🎨 *Laporan Prompt Architect Stop-Motion — ${persona.name}*\n\n` +
        `Batch prompt visual terakhir yang saya rancang untuk Google Flow Veo adalah:\n` +
        `• *Konten:* \`${lastCompletedItem.contentCode}\` — *"${lastCompletedItem.title}"*\n` +
        `• *Fokus Visual:* ${persona.sceneFocus}\n` +
        `• *Contoh Prompt Master:* _"Handmade folded origami paper stop-motion diorama, matte textured paper craft character illustrating ${lastCompletedItem.category.toLowerCase()}, warm miniature studio lighting, 9:16 vertical, no realistic humans, no text or subtitles."_\n\n` +
        `Saat ini saya sedang menyusun 8 prompt adegan untuk \`${currentAssignedItem.contentCode}\` (*"${currentAssignedItem.title}"*).`
      );
    }

    if (persona.memberId === "pic-qc") {
      return (
        `🔍 *Laporan Quality Control (QC) — ${persona.name}*\n\n` +
        `File master \`00Final.mp4\` terakhir yang lulus inspeksi meja QC saya adalah:\n` +
        `• *Konten Lulus QC:* \`${lastCompletedItem.contentCode}\` — *"${lastCompletedItem.title}"*\n` +
        `• *Durasi & Audio:* ${lastCompletedItem.targetDurationSeconds} detik (Sinkronisasi narasi MP3 & transisi lipatan kertas 100% bersih tanpa watermark/subtitle).\n` +
        `• *Antrean Cek Berikutnya:* \`${currentAssignedItem.contentCode}\` (*"${currentAssignedItem.title}"*).\n\n` +
        `Begitu lulus dari meja saya, file langsung saya serahkan ke *Buffer* di sebelah kanan untuk dijadwalkan tayang!`
      );
    }

    if (persona.memberId === "qc-operator") {
      const nextUp = params.snapshot.nextVideoToUpload;
      const latestPub = params.snapshot.publishedItems[0];
      const latestCode = latestPub ? latestPub.code : lastCompletedItem.contentCode;
      const latestTitle = latestPub ? latestPub.title : lastCompletedItem.title;
      return (
        `🎞️ *Laporan Distribusi & Galeri Jadwal Tayang — ${persona.name}*\n\n` +
        `Sebagai Publisher resmi di Ruangan Buffer:\n` +
        `• *Video Terakhir yang Saya Tayangkan:* \`${latestCode}\` — *"${latestTitle}"*\n` +
        `• *Antrean Siap Tayang Berikutnya:* ${
          nextUp
            ? `\`${nextUp.code}\` — *"${nextUp.title}"* (Jam tayang default: ${params.snapshot.settings.defaultUploadHour} WIB)`
            : "Seluruh antrean siap tayang sudah terjadwal"
        }\n` +
        `• *Total Galeri Buffer:* ${params.snapshot.inventory.scheduledCount} Terjadwal | ${params.snapshot.inventory.readyCount} Siap Masuk Slot | ${params.snapshot.inventory.publishedCount} Sudah Tayang di TikTok, Shorts & Reels.`
      );
    }
  }

  // ==========================================================================
  // 2. PERTANYAAN TENTANG IDENTITAS / PERAN / SPESIALISASI / SIAPA KAMU
  // ==========================================================================
  const isAskingWhoOrRole =
    q.includes("siapa kamu") ||
    q.includes("peran kamu") ||
    q.includes("tugas kamu") ||
    q.includes("spesialis") ||
    q.includes("divisi apa") ||
    q.includes("kerjaan kamu") ||
    q === "my_role";

  if (isAskingWhoOrRole) {
    return (
      `👋 *${persona.signatureGreeting}*\n\n` +
      `• *Nama & Jabatan:* ${persona.name} — ${persona.role}\n` +
      `• *Pos Kerja:* ${persona.workstationLabel}\n` +
      `• *Spesialisasi Utama:* ${persona.specialty}\n` +
      `• *Fokus Adegan/Tugas:* ${persona.sceneFocus}\n` +
      `• *Konten Tanggung Jawab Saya:* ${allAssignedItems
        .map((i) => `\`${i.contentCode}\` (_"${i.title}"_)`)
        .join(", ")}\n` +
      `• *Status Saat Ini:* Saya ${creditStatusText}.`
    );
  }

  // ==========================================================================
  // 3. PERTANYAAN TENTANG SISA KUOTA / KENAPA ISTIRAHAT DI LOUNGE
  // ==========================================================================
  const isAskingCredits =
    q.includes("sisa kuota") ||
    q.includes("berapa kuota") ||
    q.includes("berapa credit") ||
    q.includes("kenapa istirahat") ||
    q.includes("kenapa di lounge");

  if (isAskingCredits && account) {
    return account.credits === 0
      ? `☕ *Status Kuota ${persona.name}: HABIS (0/${account.maxCredits} kr)*\n\nAkun Chrome saya (\`${account.name}\` • ${account.email}) kehabisan kuota setelah merender adegan untuk \`${lastCompletedItem.contentCode}\` (*"${lastCompletedItem.title}"*). Makanya saya otomatis berjalan ke kursi istirahat Warkop Obim. Klik tombol *Refill Penuh (+50)* di bawah supaya saya langsung balik ke ${persona.workstationLabel}!`
      : `💻 *Status Kuota ${persona.name}: ${account.credits}/${account.maxCredits} kr (${account.percentage}%)*\n\nAkun Chrome saya (\`${account.name}\` • ${account.email}) masih sehat dan standby di ${persona.workstationLabel}. Dengan sisa ${account.credits} kr, saya masih bisa merender sekitar *${Math.floor(account.credits / 3)} klip video origami* lagi untuk \`${currentAssignedItem.contentCode}\`!`;
  }

  // ==========================================================================
  // 4. GEMINI AI COPILOT DENGAN PERSONA KARAKTER SPESIFIK (JIKA ADA API KEY)
  // ==========================================================================
  let apiKey = (process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "").trim();
  apiKey = apiKey.replace(/^["']|["']$/g, "").trim();

  if (apiKey) {
    try {
      let model = (
        process.env.LLM_MODEL ||
        process.env.GEMINI_MODEL ||
        "gemini-3-flash-preview"
      ).trim();
      model = model.replace(/^["']|["']$/g, "").trim();

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const systemPrompt = `Kamu sedang berperan sebagai karakter NPC bernama "${persona.name}" dengan jabatan "${persona.role}" di dalam Kantor Virtual 3D CeritaObim Studio.
Lawan bicaramu saat ini adalah CEO Obim (pemilik studio) yang sedang menghampiri mejamu secara langsung di dunia 3D.

PROFIL & KEPRIBADIANMU (WAJIB DIIKUTI 100%):
- Nama Karakter: ${persona.name}
- Jabatan & Pos: ${persona.role} (${persona.workstationLabel})
- Spesialisasi: ${persona.specialty}
- Fokus Tugas: ${persona.sceneFocus}
- Sifat & Kepribadian: ${persona.personalityTraits}
- Gaya Bicara: ${persona.speakingStyle}
- Status Kerja Saat Ini: ${creditStatusText}

DATA PEKERJAAN SPESIFIK MILIKMU DI DATABASE STUDIO:
- Video/Konten Terakhir yang Kamu Kerjakan: [${lastCompletedItem.contentCode}] "${lastCompletedItem.title}" (Kategori: ${lastCompletedItem.category}, Durasi: ${lastCompletedItem.targetDurationSeconds} detik, Hook: "${lastCompletedItem.hook}")
- Video/Konten yang Sedang Kamu Garap Berikutnya: [${currentAssignedItem.contentCode}] "${currentAssignedItem.title}" (Kategori: ${currentAssignedItem.category}, Hook: "${currentAssignedItem.hook}")
- Daftar Semua Konten Tanggung Jawabmu: ${allAssignedItems.map((i) => `[${i.contentCode}] "${i.title}"`).join("; ")}

DATA UMUM STUDIO SAAT INI:
- Total Konten Studio: ${params.snapshot.inventory.total} topik (${params.snapshot.inventory.publishedCount} sudah tayang, ${params.snapshot.inventory.scheduledCount} terjadwal di Buffer, ${params.snapshot.inventory.readyCount} siap upload)
- Jam Upload Default Buffer: ${params.snapshot.settings.defaultUploadHour} WIB (${params.snapshot.settings.dailyVideoTarget} konten/hari)

ATURAN MENJAWAB:
1. Jawablah 100% menggunakan sudut pandang orang pertama ("saya") sebagai ${persona.name} sesuai peran dan spesialisasimu! JANGAN PERNAH menjawab dengan format robotik "[Status] || [Judul]"!
2. Jika CEO bertanya tentang video terakhir yang kamu generate/kerjakan, sebutkan secara spesifik konten tanggung jawabmu yaitu [${lastCompletedItem.contentCode}] "${lastCompletedItem.title}" beserta detail adegan "${persona.sceneFocus}" yang kamu kerjakan, bukan konten milik orang lain.
3. Gunakan Bahasa Indonesia yang natural, hidup, sesuai gaya bicaramu, ringkas (maksimal 2-3 paragraf pendek), dan gunakan tanda *teks* untuk menebalkan poin penting.`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: params.userText }] }],
          generationConfig: { temperature: 0.45, maxOutputTokens: 600 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidateText) {
          return candidateText.replace(/\*\*(.*?)\*\*/g, "*$1*");
        }
      }
    } catch {
      // Fallback to deterministic persona response below
    }
  }

  // ==========================================================================
  // 5. DETERMINISTIC FALLBACK SESUAI PERAN MASING-MASING NPC (JIKA TANPA GEMINI)
  // ==========================================================================
  return (
    `💬 *${persona.name} (${persona.role}):*\n\n` +
    `${persona.signatureGreeting} Terkait pesan Bos (*"${params.userText}"*):\n` +
    `Saat ini di *${persona.workstationLabel}*, fokus utama saya adalah *${persona.specialty}*.\n\n` +
    `• *Pekerjaan Terakhir Saya:* \`${lastCompletedItem.contentCode}\` — *"${lastCompletedItem.title}"* (${persona.sceneFocus})\n` +
    `• *Proyek Aktif Berikutnya:* \`${currentAssignedItem.contentCode}\` — *"${currentAssignedItem.title}"*\n` +
    `• *Status Saya:* ${creditStatusText}.`
  );
}
