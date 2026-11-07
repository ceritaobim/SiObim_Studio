import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  listAllScenesGroupedByContent,
  listAssetsForContent,
  listContentItems,
} from "@/lib/db/repository";
import { buildContentPlanWorkbookBuffer } from "@/features/content-library/xlsx-service";

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
  const includeArchived = url.searchParams.get("includeArchived") === "true";

  const [items, assets, scenesGrouped] = await Promise.all([
    listContentItems(owner.ownerId, { includeArchived }),
    listAssetsForContent(owner.ownerId),
    listAllScenesGroupedByContent(owner.ownerId),
  ]);

  const allScenes = Object.values(scenesGrouped).flat();
  const buffer = buildContentPlanWorkbookBuffer(items, {
    scenes: allScenes,
    assets,
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `cerita_obim_contentplan_${dateStamp}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
