import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type {
  AssetRecord,
  ContentItemRecord,
  ContentStatus,
  DuplicateTopicWarning,
  SceneRecord,
  VerificationStatus,
} from "@/types/domain";
import {
  ContentItemInputSchema,
  type ContentItemInput,
} from "@/lib/validation/schemas";
import { findDuplicateTopicWarnings } from "@/features/content-library/duplicate-detector";

export const CONTENT_PLAN_SHEET_NAME = "ContentPlan";

export const CONTENT_PLAN_COLUMNS = [
  "Content ID",
  "Publish Date",
  "Title",
  "Category",
  "Topic",
  "Hook",
  "Narration",
  "Target Duration (sec)",
  "Factual Claims",
  "Source URLs",
  "Verification Status",
  "TikTok Caption",
  "YouTube Description",
  "Instagram Caption",
  "CTA",
  "Production Status",
  "Notes",
] as const;

export interface ParsedImportRow {
  rowNumber: number;
  status: "valid_new" | "conflict_existing_code" | "invalid_row" | "placeholder_skipped";
  item?: ContentItemInput;
  errors: string[];
  duplicateTopicWarnings: DuplicateTopicWarning[];
}

export interface ImportPreviewReport {
  totalRowsRead: number;
  validNewCount: number;
  conflictCodeCount: number;
  invalidRowCount: number;
  skippedPlaceholderCount: number;
  rows: ParsedImportRow[];
}

function parseJsonOrDelimitedArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  const str = String(raw ?? "").trim();
  if (!str || str === "[]") return [];

  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      // fall through to line/semicolon split
    }
  }

  return str
    .split(/\r?\n|;/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeVerificationStatus(raw: unknown): VerificationStatus {
  const val = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    val === "draft" ||
    val === "needs_verification" ||
    val === "verified" ||
    val === "rejected"
  ) {
    return val;
  }
  return "needs_verification";
}

function normalizeContentStatus(raw: unknown): ContentStatus {
  const val = String(raw ?? "")
    .trim()
    .toLowerCase();
  const allowed: ContentStatus[] = [
    "idea",
    "planned",
    "script_approved",
    "in_production",
    "assembled",
    "approved",
    "ready_to_publish",
    "published",
    "archived",
  ];
  if (allowed.includes(val as ContentStatus)) {
    return val as ContentStatus;
  }
  return "idea";
}

/**
 * Parses an XLSX or CSV buffer and validates each row against existing Content Library records.
 * Never overwrites existing contentCodes silently.
 */
export function parseContentPlanSpreadsheet(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  existingItems: Pick<
    ContentItemRecord,
    "id" | "contentCode" | "title" | "topic" | "contentStatus"
  >[]
): ImportPreviewReport {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    workbook.SheetNames.find(
      (n) => n.toLowerCase() === CONTENT_PLAN_SHEET_NAME.toLowerCase()
    ) ?? workbook.SheetNames[0];

  if (!sheetName) {
    return {
      totalRowsRead: 0,
      validNewCount: 0,
      conflictCodeCount: 0,
      invalidRowCount: 0,
      skippedPlaceholderCount: 0,
      rows: [],
    };
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      totalRowsRead: 0,
      validNewCount: 0,
      conflictCodeCount: 0,
      invalidRowCount: 0,
      skippedPlaceholderCount: 0,
      rows: [],
    };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const existingCodes = new Set(
    existingItems.map((i) => i.contentCode.trim().toUpperCase())
  );
  const seenCodesInFile = new Set<string>();

  const rows: ParsedImportRow[] = [];
  let validNewCount = 0;
  let conflictCodeCount = 0;
  let invalidRowCount = 0;
  let skippedPlaceholderCount = 0;

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // 1-indexed + header row
    const rawCode = String(
      raw["Content ID"] ?? raw["content_code"] ?? ""
    ).trim();
    const title = String(
      raw["Title"] ?? raw["title"] ?? raw["Judul"] ?? ""
    ).trim();
    const descriptionCol = String(raw["Deskripsi"] ?? "").trim();
    const narrationCol = String(
      raw["Narration"] ??
        raw["narration"] ??
        raw["Narasi (90 Detik)"] ??
        raw["Narasi"] ??
        ""
    ).trim();
    const uploadDateCol = String(
      raw["Publish Date"] ?? raw["Upload Date"] ?? ""
    ).trim();
    const topic = String(
      raw["Topic"] ?? raw["topic"] ?? (descriptionCol || title)
    ).trim();

    // Skip completely empty rows
    if (!rawCode && !title) {
      return;
    }

    // Auto-generate Content ID (CO-YYYY-NNN) if spreadsheet uses 5-column format without Content ID
    const year = new Date().getFullYear();
    const contentCode =
      rawCode ||
      `CO-${year}-${String(existingItems.length + validNewCount + 1).padStart(
        3,
        "0"
      )}`;

    // Detect untouched template placeholder row ("CO-YYYY-001")
    if (
      contentCode.toUpperCase() === "CO-YYYY-001" &&
      title.toLowerCase().includes("contoh judul")
    ) {
      skippedPlaceholderCount++;
      rows.push({
        rowNumber,
        status: "placeholder_skipped",
        errors: [
          "Baris placeholder template (CO-YYYY-001) dilewati secara otomatis.",
        ],
        duplicateTopicWarnings: [],
      });
      return;
    }

    const firstSentence =
      narrationCol.split(/(?<=[.!?])\s+/)[0]?.trim() || title;
    const lastSentence =
      narrationCol
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
        .slice(-1)[0]
        ?.trim() || "Tulis pendapatmu di kolom komentar!";

    const candidateInput = {
      contentCode,
      title,
      category:
        String(raw["Category"] ?? raw["category"] ?? "").trim() ||
        "Psikologi & Kehidupan Sehari-hari",
      topic,
      hook:
        String(raw["Hook"] ?? raw["hook"] ?? "").trim() || firstSentence,
      narration: narrationCol,
      targetDurationSeconds:
        Number(raw["Target Duration (sec)"] ?? raw["target_duration_seconds"]) ||
        80,
      factualClaims: parseJsonOrDelimitedArray(
        raw["Factual Claims"] ?? raw["factual_claims"]
      ),
      sourceUrls: parseJsonOrDelimitedArray(
        raw["Source URLs"] ?? raw["source_urls"]
      ),
      verificationStatus: normalizeVerificationStatus(
        raw["Verification Status"] ?? raw["verification_status"]
      ),
      tiktokCaption:
        String(raw["TikTok Caption"] ?? raw["tiktok_caption"] ?? "").trim() ||
        descriptionCol,
      youtubeDescription:
        String(
          raw["YouTube Description"] ?? raw["youtube_description"] ?? ""
        ).trim() || descriptionCol,
      instagramCaption:
        String(
          raw["Instagram Caption"] ?? raw["instagram_caption"] ?? ""
        ).trim() || descriptionCol,
      cta: String(raw["CTA"] ?? raw["cta"] ?? "").trim() || lastSentence,
      contentStatus: normalizeContentStatus(
        raw["Production Status"] ?? raw["content_status"]
      ),
      notes:
        String(raw["Notes"] ?? raw["notes"] ?? "").trim() ||
        (uploadDateCol ? `Jadwal Upload: ${uploadDateCol}` : ""),
      publishedAt: uploadDateCol || null,
      isDemo: false,
    };

    const parsed = ContentItemInputSchema.safeParse(candidateInput);
    if (!parsed.success) {
      invalidRowCount++;
      rows.push({
        rowNumber,
        status: "invalid_row",
        errors: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "row"}: ${i.message}`
        ),
        duplicateTopicWarnings: [],
      });
      return;
    }

    const upperCode = parsed.data.contentCode.toUpperCase();
    if (existingCodes.has(upperCode) || seenCodesInFile.has(upperCode)) {
      conflictCodeCount++;
      rows.push({
        rowNumber,
        status: "conflict_existing_code",
        item: parsed.data,
        errors: [
          existingCodes.has(upperCode)
            ? `Content ID "${parsed.data.contentCode}" sudah ada di database. Baris ini tidak akan menimpa data lama.`
            : `Content ID "${parsed.data.contentCode}" duplikat di dalam file impor yang sama.`,
        ],
        duplicateTopicWarnings: [],
      });
      return;
    }

    seenCodesInFile.add(upperCode);

    // Enforce PRD rule: if sourceUrls is empty and status was marked verified, downgrade to needs_verification
    const finalItem: ContentItemInput = {
      ...parsed.data,
      verificationStatus:
        parsed.data.sourceUrls.length === 0 &&
        parsed.data.verificationStatus === "verified"
          ? "needs_verification"
          : parsed.data.verificationStatus,
    };

    const duplicateTopicWarnings = findDuplicateTopicWarnings(
      {
        title: finalItem.title,
        topic: finalItem.topic,
        excludeCode: finalItem.contentCode,
      },
      existingItems
    );

    validNewCount++;
    rows.push({
      rowNumber,
      status: "valid_new",
      item: finalItem,
      errors: [],
      duplicateTopicWarnings,
    });
  });

  return {
    totalRowsRead: rows.length,
    validNewCount,
    conflictCodeCount,
    invalidRowCount,
    skippedPlaceholderCount,
    rows,
  };
}

export interface WorkbookTrackingContext {
  scenes?: SceneRecord[];
  assets?: AssetRecord[];
}

/**
 * Builds an XLSX buffer with stable column names matching `templates/contentplan_template.xlsx`
 * and includes a dedicated ProductionTracking sheet for live video status.
 */
export function buildContentPlanWorkbookBuffer(
  items: ContentItemRecord[],
  context?: WorkbookTrackingContext
): Buffer {
  const sheetRows = items.map((item) => ({
    "Content ID": item.contentCode,
    "Publish Date": item.publishedAt || item.scheduledPublishAt || "",
    Title: item.title,
    Category: item.category,
    Topic: item.topic,
    Hook: item.hook,
    Narration: item.narration,
    "Target Duration (sec)": item.targetDurationSeconds,
    "Factual Claims": JSON.stringify(item.factualClaims ?? []),
    "Source URLs": JSON.stringify(item.sourceUrls ?? []),
    "Verification Status": item.verificationStatus.toUpperCase(),
    "TikTok Caption": item.tiktokCaption,
    "YouTube Description": item.youtubeDescription,
    "Instagram Caption": item.instagramCaption,
    CTA: item.cta,
    "Production Status": item.contentStatus.toUpperCase(),
    Notes: item.notes,
  }));

  const workbook = XLSX.utils.book_new();
  const contentSheet = XLSX.utils.json_to_sheet(sheetRows, {
    header: [...CONTENT_PLAN_COLUMNS],
  });
  XLSX.utils.book_append_sheet(workbook, contentSheet, CONTENT_PLAN_SHEET_NAME);

  // Dedicated Production Tracking Sheet
  const scenes = context?.scenes ?? [];
  const assets = context?.assets ?? [];

  const trackingRows = items.map((item) => {
    const itemScenes = scenes.filter((s) => s.contentId === item.id);
    const itemAssets = assets.filter((a) => a.contentId === item.id);
    const voice = itemAssets.find((a) => a.assetType === "voice_audio");
    const finalVid = itemAssets.find((a) => a.assetType === "final_video");
    const completedClips = itemScenes.filter((s) =>
      itemAssets.some(
        (a) =>
          a.assetType === "scene_video" &&
          (a.sceneId === s.id || a.id === s.uploadedClipAssetId)
      )
    ).length;

    let finalVideoStatus = "BELUM LENGKAP";
    if (finalVid) {
      finalVideoStatus = "SUDAH DIRAKIT (MP4)";
    } else if (
      completedClips === itemScenes.length &&
      itemScenes.length > 0 &&
      voice
    ) {
      finalVideoStatus = "SIAP DIRAKIT";
    }

    return {
      "Content ID": item.contentCode,
      "Judul Video": item.title,
      "Kategori / Program": item.category,
      "Status Produksi": item.contentStatus.toUpperCase(),
      "Voiceover Obim": voice ? "SIAP (MP3)" : "BELUM",
      "Durasi Audio (dtk)":
        voice && voice.durationMs
          ? (voice.durationMs / 1000).toFixed(1)
          : item.targetDurationSeconds,
      "Progres Klip Scene":
        itemScenes.length > 0
          ? `${completedClips} / ${itemScenes.length} Klip`
          : "0 Klip",
      "Video Final 9:16": finalVideoStatus,
      "Nama File Final": finalVid
        ? finalVid.originalFilename || "final.mp4"
        : "-",
      "Jadwal Tayang": item.scheduledPublishAt || "-",
      "Tanggal Rilis": item.publishedAt || "-",
    };
  });

  const trackingSheet = XLSX.utils.json_to_sheet(trackingRows);
  XLSX.utils.book_append_sheet(workbook, trackingSheet, "ProductionTracking");

  const readmeSheet = XLSX.utils.json_to_sheet([
    {
      Field: "Tujuan",
      Keterangan:
        "Spreadsheet resmi CeritaObim Studio yang selalu tersinkronisasi otomatis dengan database studio.",
    },
    {
      Field: "Sheet: ContentPlan",
      Keterangan:
        "Daftar lengkap naskah, hook, klaim fakta, durasi, dan caption media sosial untuk setiap episode.",
    },
    {
      Field: "Sheet: ProductionTracking",
      Keterangan:
        "Tabel pelacakan langsung status produksi: kelengkapan audio voiceover, jumlah klip scene origami, dan video master 9:16.",
    },
    {
      Field: "Sinkronisasi",
      Keterangan:
        "File ini diperbarui otomatis setiap kali terjadi perubahan data di aplikasi studio.",
    },
  ]);
  XLSX.utils.book_append_sheet(workbook, readmeSheet, "Readme");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export const OWNER_SPREADSHEET_FILENAME = "ContentPlan_CeritaObim_Terbaru.xlsx";

/**
 * Automatically syncs the master spreadsheet to 00.FolderOwner/ContentPlan_CeritaObim_Terbaru.xlsx
 */
export function syncContentPlanSpreadsheetToOwnerFolder(
  items: ContentItemRecord[],
  context?: WorkbookTrackingContext,
  targetDir = path.join(process.cwd(), "00.FolderOwner")
): string | null {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = path.join(targetDir, OWNER_SPREADSHEET_FILENAME);
    const buffer = buildContentPlanWorkbookBuffer(items, context);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch {
    // Non-blocking in read-only / restricted environments
    return null;
  }
}
