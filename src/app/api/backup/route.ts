import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";

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

  const storePath = path.join(process.cwd(), ".data", "studio-store.json");
  if (!fs.existsSync(storePath)) {
    return NextResponse.json(
      { error: "FILE_NOT_FOUND: File studio-store.json tidak ditemukan." },
      { status: 404 }
    );
  }

  const fileContent = fs.readFileSync(storePath, "utf-8");
  const nowStr = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `CeritaObim_Studio_Backup_${nowStr}.json`;

  return new NextResponse(fileContent, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  try {
    const storePath = path.join(process.cwd(), ".data", "studio-store.json");
    const backupsDir = path.join(process.cwd(), ".data", "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    if (fs.existsSync(storePath)) {
      const nowStr = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFilePath = path.join(
        backupsDir,
        `studio-store-backup-${nowStr}.json`
      );
      fs.copyFileSync(storePath, backupFilePath);

      // Also copy to 00.FolderOwner if available
      const ownerFolder = path.join(process.cwd(), "00.FolderOwner");
      if (fs.existsSync(ownerFolder)) {
        const ownerBackup = path.join(
          ownerFolder,
          "BACKUP_DATABASE_STUDIO_LATEST.json"
        );
        fs.copyFileSync(storePath, ownerBackup);
      }

      return NextResponse.json({
        ok: true,
        message: "Backup database berhasil disimpan di .data/backups dan 00.FolderOwner!",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: "Database file belum ada untuk di-backup." },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal membuat backup database.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
