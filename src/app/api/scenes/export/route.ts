import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  generateAndSaveScenePrompts,
  listContentItems,
  listScenesForContent,
} from "@/lib/db/repository";
import {
  exportPromptPackAsCsv,
  exportPromptPackAsTxt,
  exportPromptPackAsXlsxBuffer,
} from "@/features/scenes/prompt-generator";

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

  const url = new URL(request.url);
  const contentId = url.searchParams.get("contentId") || "";
  const format = (url.searchParams.get("format") || "txt").toLowerCase();

  const items = await listContentItems(owner.ownerId, {
    includeArchived: true,
  });
  const content = items.find((i) => i.id === contentId) ?? items[0];

  if (!content) {
    return NextResponse.json(
      { error: "Konten tidak ditemukan." },
      { status: 404 }
    );
  }

  let scenes = await listScenesForContent(owner.ownerId, content.id);
  if (scenes.length === 0 || scenes.some((s) => !s.promptText)) {
    scenes = await generateAndSaveScenePrompts(owner.ownerId, content.id);
  }

  const baseName = `${content.contentCode}_FLOW_PROMPTS`;

  if (format === "xlsx") {
    const buffer = exportPromptPackAsXlsxBuffer(content, scenes);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    });
  }

  if (format === "csv") {
    const csv = exportPromptPackAsCsv(content, scenes);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  const txt = exportPromptPackAsTxt(content, scenes);
  return new NextResponse(txt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.txt"`,
    },
  });
}
