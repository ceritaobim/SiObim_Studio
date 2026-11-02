import type { ContentItemRecord } from "@/types/domain";
import {
  parseContentPlanSpreadsheet,
  type ImportPreviewReport,
} from "@/features/content-library/xlsx-service";

/**
 * Extracts the Google Spreadsheet ID and optional gid from any standard Google Sheets URL.
 */
export function extractGoogleSpreadsheetId(urlOrId: string): {
  spreadsheetId: string;
  gid: string;
} | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  // Direct ID format (alphanumeric + underscores/hyphens, 20-80 chars)
  if (/^[a-zA-Z0-9-_]{20,80}$/.test(trimmed)) {
    return { spreadsheetId: trimmed, gid: "0" };
  }

  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch?.[1]) {
    return null;
  }

  const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
  return {
    spreadsheetId: idMatch[1],
    gid: gidMatch?.[1] ?? "0",
  };
}

/**
 * Builds the direct XLSX export URL for a Google Sheet shared as "Anyone with the link can view".
 */
export function buildGoogleSheetXlsxExportUrl(urlOrId: string): string | null {
  const extracted = extractGoogleSpreadsheetId(urlOrId);
  if (!extracted) return null;
  return `https://docs.google.com/spreadsheets/d/${extracted.spreadsheetId}/export?format=xlsx`;
}

/**
 * Fetches a Google Spreadsheet as an XLSX buffer and parses it using the non-destructive ContentPlan parser.
 */
export async function fetchAndPreviewGoogleSheet(
  sheetUrlOrId: string,
  existingItems: Pick<
    ContentItemRecord,
    "id" | "contentCode" | "title" | "topic" | "contentStatus"
  >[]
): Promise<ImportPreviewReport> {
  const exportUrl = buildGoogleSheetXlsxExportUrl(sheetUrlOrId);
  if (!exportUrl) {
    throw new Error(
      "INVALID_GOOGLE_SHEET_URL: Masukkan link Google Spreadsheet yang valid (mis. https://docs.google.com/spreadsheets/d/xxxx/edit)."
    );
  }

  const response = await fetch(exportUrl, {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `GOOGLE_SHEET_FETCH_FAILED: Gagal mengunduh Google Sheet (HTTP ${response.status}). Pastikan akses berbagi disetel ke "Anyone with the link can view".`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error(
      "GOOGLE_SHEET_PRIVATE: Google Sheet masih bersifat privat. Di Google Sheets, klik tombol Share -> ubah General Access menjadi 'Anyone with the link' (Viewer)."
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return parseContentPlanSpreadsheet(Buffer.from(arrayBuffer), existingItems);
}

/**
 * Pushes (appends) content items to the user's Google Sheet via a Google Apps Script Web App URL.
 * The Web App receives an array of 17-column rows matching `contentplan_template.xlsx` and appends only new Content IDs.
 */
export const DEFAULT_GDRIVE_ROOT_FOLDER_ID =
  "1WV7zSGLishbjj9AnNf4Ro0XwYlkGa7f2";
export const DEFAULT_GDRIVE_ROOT_FOLDER_URL =
  "https://drive.google.com/drive/folders/1WV7zSGLishbjj9AnNf4Ro0XwYlkGa7f2?usp=sharing";

/**
 * Normalizes either a full Google Apps Script Web App URL (`https://script.google.com/macros/s/AKfy.../exec`)
 * OR a raw Deployment ID (`AKfy...`) into a valid `/exec` URL.
 */
export function normalizeAppsScriptWebAppUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // If user pasted the Deployment ID directly (e.g. AKfycby... or AKfkgoie...)
  if (/^AKf[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return `https://script.google.com/macros/s/${trimmed}/exec`;
  }

  if (/^https:\/\/script\.google\.com\/macros\/s\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function buildContentDriveFolderNames(
  item: Pick<ContentItemRecord, "contentCode" | "title">,
  fallbackIndex = 0
): {
  weekNumber: number;
  dayInWeek: number;
  weekFolderName: string;
  dayFolderName: string;
} {
  const codeNumMatch = item.contentCode.match(/(\d+)$/);
  const seqNum = codeNumMatch?.[1]
    ? parseInt(codeNumMatch[1], 10)
    : fallbackIndex + 1;
  const itemsPerWeek = 21;
  const weekNumber = Math.max(1, Math.ceil(seqNum / itemsPerWeek));
  const posInWeek = (seqNum - 1) % itemsPerWeek;
  const dayInWeek = Math.floor(posInWeek / 3) + 1;
  const programSlot = (posInWeek % 3) + 1;
  const safeTitle = item.title
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .trim()
    .slice(0, 48);

  const weekFolderName = `Week_${String(weekNumber).padStart(2, "0")}`;
  const dayFolderName = `Hari_${String(dayInWeek).padStart(2, "0")}_P${programSlot}_${item.contentCode}_${safeTitle}`;

  return {
    weekNumber,
    dayInWeek,
    weekFolderName,
    dayFolderName,
  };
}

/**
 * Pushes (appends) content items to the user's Google Sheet via a Google Apps Script Web App URL.
 */
export async function pushItemsToGoogleSheetWebApp(
  webAppUrlOrId: string,
  items: ContentItemRecord[]
): Promise<{ pushedCount: number; message: string }> {
  const normalizedUrl = normalizeAppsScriptWebAppUrl(webAppUrlOrId);
  if (!normalizedUrl) {
    throw new Error(
      "INVALID_WEBAPP_URL: Masukkan URL Aplikasi Web (https://script.google.com/macros/s/.../exec) atau ID Penerapan (AKf...)."
    );
  }

  const rowsPayload = items.map((item, idx) => {
    const { dayInWeek, weekFolderName, dayFolderName } =
      buildContentDriveFolderNames(item, idx);

    return {
      contentCode: item.contentCode,
      weekFolderName,
      dayFolderName,
      values: [
        item.contentCode,
        item.publishedAt ?? `Hari ${dayInWeek} - 19:00 WIB`,
        item.title,
        item.category,
        item.topic,
        item.hook,
        item.narration,
        item.targetDurationSeconds,
        JSON.stringify(item.factualClaims ?? []),
        JSON.stringify(item.sourceUrls ?? []),
        item.verificationStatus.toUpperCase(),
        item.tiktokCaption,
        item.youtubeDescription,
        item.instagramCaption,
        item.cta,
        item.contentStatus.toUpperCase(),
        item.notes,
      ],
    };
  });

  const payloadString = JSON.stringify({
    sheetName: "ContentPlan",
    rootDriveFolderId: DEFAULT_GDRIVE_ROOT_FOLDER_ID,
    createDriveFolders: true,
    rows: rowsPayload,
  });

  // Google Apps Script Web Apps respond to POST with a 302 redirect to script.googleusercontent.com.
  // Using manual redirect handling ensures we follow the redirect with GET as Google expects.
  let response = await fetch(normalizedUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: payloadString,
    redirect: "manual",
  });

  if (
    response.status === 301 ||
    response.status === 302 ||
    response.status === 303 ||
    response.status === 307 ||
    response.status === 308
  ) {
    const redirectLocation = response.headers.get("location");
    if (redirectLocation) {
      response = await fetch(redirectLocation, {
        method: "GET",
      });
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `GSHEETS_ACCESS_DENIED (Status ${response.status}): Di Apps Script, klik "Terapkan (Deploy)" -> "Kelola penerapan (Manage deployments)" -> klik ikon Pensil (Edit) -> ubah "Siapa yang memiliki akses (Who has access)" menjadi "Siapa saja (Anyone)" -> klik Terapkan.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `GSHEETS_PUSH_FAILED: Webhook Apps Script mengembalikan status ${response.status}.`
    );
  }

  let resultJson: {
    appendedCount?: number;
    foldersCreated?: number;
    message?: string;
  } = {};
  try {
    resultJson = await response.json();
  } catch {
    // Some Apps Script responses return plain text
  }

  return {
    pushedCount: resultJson.appendedCount ?? items.length,
    message:
      resultJson.message ||
      `Berhasil menyinkronkan ${items.length} konten ke Spreadsheet & membuat struktur folder otomatis di 01_Produksi_Harian.`,
  };
}

export interface DriveUploadFileEntry {
  filename: string;
  mimeType: string;
  base64Data: string;
}

export interface DriveUploadResult {
  uploaded: boolean;
  needsAppsScriptUpdate?: boolean;
  folderPath: string;
  dayFolderUrl?: string;
  uploadedFiles?: Array<{
    filename: string;
    fileId?: string;
    fileUrl?: string;
  }>;
  message: string;
}

/**
 * Automatically uploads generated audio (.wav / .mp3) and transcript/prompt pack (.txt)
 * into the content item's exact Google Drive folder:
 * `01_Produksi_Harian / Week_XX / Hari_XX_CO-2026-XXX_Title`
 */
export async function uploadContentFilesToGoogleDriveWebApp(params: {
  webAppUrlOrId: string;
  item: Pick<ContentItemRecord, "contentCode" | "title">;
  files: DriveUploadFileEntry[];
}): Promise<DriveUploadResult> {
  const { weekFolderName, dayFolderName } = buildContentDriveFolderNames(
    params.item
  );
  const folderPath = `01_Produksi_Harian / ${weekFolderName} / ${dayFolderName}`;

  const normalizedUrl = normalizeAppsScriptWebAppUrl(params.webAppUrlOrId);
  if (!normalizedUrl) {
    return {
      uploaded: false,
      folderPath,
      message:
        "URL Web App Google Apps Script belum diatur di Pengaturan / Content Library.",
    };
  }

  const payloadString = JSON.stringify({
    action: "upload_files",
    rootDriveFolderId: DEFAULT_GDRIVE_ROOT_FOLDER_ID,
    contentCode: params.item.contentCode,
    weekFolderName,
    dayFolderName,
    files: params.files,
    // Keep empty rows array so older Apps Script versions don't crash on body.rows.length
    createDriveFolders: true,
    rows: [
      {
        contentCode: params.item.contentCode,
        weekFolderName,
        dayFolderName,
        values: [],
      },
    ],
  });

  let response = await fetch(normalizedUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: payloadString,
    redirect: "manual",
  });

  if (
    response.status === 301 ||
    response.status === 302 ||
    response.status === 303 ||
    response.status === 307 ||
    response.status === 308
  ) {
    const redirectLocation = response.headers.get("location");
    if (redirectLocation) {
      response = await fetch(redirectLocation, {
        method: "GET",
      });
    }
  }

  if (!response.ok) {
    return {
      uploaded: false,
      folderPath,
      message: `Gagal menghubungi Web App Google Drive (HTTP ${response.status}).`,
    };
  }

  let resultJson: {
    ok?: boolean;
    uploadedFiles?: Array<{
      filename: string;
      fileId?: string;
      fileUrl?: string;
    }>;
    dayFolderUrl?: string;
    message?: string;
  } = {};

  try {
    resultJson = await response.json();
  } catch {
    return {
      uploaded: false,
      folderPath,
      message: "Respons Web App Google Drive bukan JSON valid.",
    };
  }

  // If the deployed Apps Script hasn't been updated with `uploadedFiles` support yet:
  if (!Array.isArray(resultJson.uploadedFiles)) {
    return {
      uploaded: false,
      needsAppsScriptUpdate: true,
      folderPath,
      message: `Folder ${folderPath} sudah siap di Google Drive, namun kode Google Apps Script Anda masih versi lama (belum memiliki fitur penerima file audio). Klik tombol "Copy Kode Apps Script GDrive Baru" lalu paste & Deploy di script.google.com.`,
    };
  }

  return {
    uploaded: true,
    folderPath,
    dayFolderUrl: resultJson.dayFolderUrl,
    uploadedFiles: resultJson.uploadedFiles,
    message:
      resultJson.message ||
      `Berhasil mengunggah ${resultJson.uploadedFiles.length} file ke Google Drive (${folderPath})!`,
  };
}

export const GOOGLE_APPS_SCRIPT_SNIPPET = `function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var rootFolderId = body.rootDriveFolderId || "1WV7zSGLishbjj9AnNf4Ro0XwYlkGa7f2";
  var parentFolder;
  try {
    parentFolder = DriveApp.getFolderById(rootFolderId);
  } catch (err) {
    parentFolder = DriveApp.getRootFolder();
  }

  var prodIter = parentFolder.getFoldersByName("01_Produksi_Harian");
  var prodFolder = prodIter.hasNext() ? prodIter.next() : parentFolder.createFolder("01_Produksi_Harian");

  // MODE 1: Auto-Upload File Audio (.wav/.mp3) & Transkrip Prompt (.txt) ke Folder Konten
  if (body.action === "upload_files" && body.weekFolderName && body.dayFolderName && Array.isArray(body.files)) {
    var wIterUp = prodFolder.getFoldersByName(body.weekFolderName);
    var wFolderUp = wIterUp.hasNext() ? wIterUp.next() : prodFolder.createFolder(body.weekFolderName);

    // Cari folder Hari_XX_CO-2026-XXX jika sudah ada (mesau judul sedikit berbeda), atau buat baru
    var dayFolderUp = null;
    var codePrefix = body.contentCode ? "_" + String(body.contentCode).toUpperCase() : "";
    var allDayFolders = wFolderUp.getFolders();
    while (allDayFolders.hasNext()) {
      var candidate = allDayFolders.next();
      var cName = candidate.getName();
      if (cName === body.dayFolderName || (codePrefix && cName.toUpperCase().indexOf(codePrefix) !== -1)) {
        dayFolderUp = candidate;
        break;
      }
    }
    if (!dayFolderUp) {
      dayFolderUp = wFolderUp.createFolder(body.dayFolderName);
    }

    var uploadedFiles = [];
    for (var fIdx = 0; fIdx < body.files.length; fIdx++) {
      var fObj = body.files[fIdx];
      if (!fObj || !fObj.filename || !fObj.base64Data) continue;

      // Hapus file lama dengan nama yang sama agar tidak duplikat saat re-generate
      var existingFiles = dayFolderUp.getFilesByName(fObj.filename);
      while (existingFiles.hasNext()) {
        existingFiles.next().setTrashed(true);
      }

      var decodedBytes = Utilities.base64Decode(fObj.base64Data);
      var blob = Utilities.newBlob(decodedBytes, fObj.mimeType || "application/octet-stream", fObj.filename);
      var createdFile = dayFolderUp.createFile(blob);
      uploadedFiles.push({
        filename: fObj.filename,
        fileId: createdFile.getId(),
        fileUrl: createdFile.getUrl()
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      dayFolderUrl: dayFolderUp.getUrl(),
      uploadedFiles: uploadedFiles,
      message: uploadedFiles.length + " file berhasil diupload ke Google Drive (" + body.weekFolderName + " / " + dayFolderUp.getName() + ")."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // MODE 2: Sinkronisasi Baris ContentPlan ke Google Sheet & Buat Struktur Folder Mingguan/Harian
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(body.sheetName || "ContentPlan") || ss.getSheets()[0];
  var existingCodes = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < colA.length; i++) {
      existingCodes[String(colA[i][0]).trim().toUpperCase()] = true;
    }
  }

  var appended = 0;
  var foldersCreated = 0;
  var rows = Array.isArray(body.rows) ? body.rows : [];
  for (var j = 0; j < rows.length; j++) {
    var rowObj = rows[j];
    var code = String(rowObj.contentCode || "").trim().toUpperCase();
    if (code && !existingCodes[code] && Array.isArray(rowObj.values) && rowObj.values.length > 0) {
      sheet.appendRow(rowObj.values);
      existingCodes[code] = true;
      appended++;
    }
    if (body.createDriveFolders && rowObj.weekFolderName && rowObj.dayFolderName) {
      var wIter = prodFolder.getFoldersByName(rowObj.weekFolderName);
      var wFolder = wIter.hasNext() ? wIter.next() : prodFolder.createFolder(rowObj.weekFolderName);
      var dIter = wFolder.getFoldersByName(rowObj.dayFolderName);
      if (!dIter.hasNext()) {
        wFolder.createFolder(rowObj.dayFolderName);
        foldersCreated++;
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    appendedCount: appended,
    foldersCreated: foldersCreated,
    message: appended + " baris baru masuk ke Sheet & " + foldersCreated + " folder harian dibuat di 01_Produksi_Harian."
  })).setMimeType(ContentService.MimeType.JSON);
}`;
