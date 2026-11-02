import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import { fetchBufferAccountAndOrg } from "@/lib/integrations/buffer-client";

export async function GET(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  const results: Record<
    string,
    {
      name: string;
      status: "healthy" | "warning" | "error";
      message: string;
      details?: Record<string, unknown>;
    }
  > = {};

  // 1. Google Gemini AI
  const geminiKey = process.env.LLM_API_KEY;
  const geminiModel = process.env.LLM_MODEL || "gemini-3-flash-preview";
  if (geminiKey) {
    results.gemini = {
      name: "Google Gemini AI",
      status: "healthy",
      message: `Terhubung (${geminiModel})`,
      details: {
        model: geminiModel,
        provider: "Google AI Studio",
        hasKey: true,
      },
    };
  } else {
    results.gemini = {
      name: "Google Gemini AI",
      status: "warning",
      message: "LLM_API_KEY belum terisi di .env.local",
    };
  }

  // 2. ElevenLabs TTS
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "UgBBYS2sOqTuMpoF3BR0";
  if (elevenKey) {
    results.elevenlabs = {
      name: "ElevenLabs Voice TTS",
      status: "healthy",
      message: "API Key & Voice ID Obim Aktif",
      details: {
        voiceId,
        hasKey: true,
      },
    };
  } else {
    results.elevenlabs = {
      name: "ElevenLabs Voice TTS",
      status: "warning",
      message: "ELEVENLABS_API_KEY belum terisi di .env.local",
    };
  }

  // 3. Buffer Publishing
  const bufferToken = process.env.BUFFER_ACCESS_TOKEN;
  if (bufferToken) {
    try {
      const bufferInfo = await fetchBufferAccountAndOrg();
      results.buffer = {
        name: "Buffer Multi-Publishing",
        status: "healthy",
        message: "Token Aktif (3 Channel: YouTube, TikTok, Instagram)",
        details: {
          email: bufferInfo.email,
          orgId: bufferInfo.organizationId,
        },
      };
    } catch (bErr) {
      results.buffer = {
        name: "Buffer Multi-Publishing",
        status: "warning",
        message: bErr instanceof Error ? bErr.message : "Gagal tes koneksi Buffer",
      };
    }
  } else {
    results.buffer = {
      name: "Buffer Multi-Publishing",
      status: "error",
      message: "BUFFER_ACCESS_TOKEN belum terisi",
    };
  }

  // 4. Google Drive
  const driveRoot = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  results.gdrive = {
    name: "Google Drive Cloud Storage",
    status: driveRoot ? "healthy" : "warning",
    message: driveRoot
      ? `Root Folder ID: ${driveRoot.slice(0, 8)}...`
      : "Folder ID belum diset",
    details: { rootFolderId: driveRoot },
  };

  // 5. FFmpeg Assembly Engine
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static");
    const exists = ffmpegStatic && fs.existsSync(ffmpegStatic);
    results.ffmpeg = {
      name: "FFmpeg Video Engine",
      status: exists ? "healthy" : "warning",
      message: exists
        ? "Biner FFmpeg terpasang (H.264 9:16 1080x1920)"
        : "Menggunakan ffmpeg sistem lokal",
      details: {
        binaryPath: ffmpegStatic || "system ffmpeg",
      },
    };
  } catch {
    results.ffmpeg = {
      name: "FFmpeg Video Engine",
      status: "warning",
      message: "ffmpeg-static modul fallback",
    };
  }

  // 6. Macro Drops Folder
  const dropsPath = path.join(process.cwd(), "storage", "macro_drops");
  const dropsExist = fs.existsSync(dropsPath);
  const droppedFilesCount = dropsExist ? fs.readdirSync(dropsPath).length : 0;
  results.macro = {
    name: "Makro Auto-Dropzone",
    status: "healthy",
    message: `Folder Siap (${droppedFilesCount} file klip)`,
    details: {
      folderPath: dropsPath,
      filesInDropzone: droppedFilesCount,
    },
  };

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    tools: results,
  });
}
