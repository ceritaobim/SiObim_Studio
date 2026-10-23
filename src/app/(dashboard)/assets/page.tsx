import { VideoTableManager } from "@/features/video-generation/video-table-manager";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  listAllScenesGroupedByContent,
  listAssetsForContent,
  listContentItems,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function VideoPage() {
  const owner = await getAuthorizedOwner();
  const [items, assets, scenesByContent] = await Promise.all([
    listContentItems(owner.ownerId),
    listAssetsForContent(owner.ownerId),
    listAllScenesGroupedByContent(owner.ownerId),
  ]);

  return (
    <div className="space-y-5">
      <VideoTableManager
        initialItems={items}
        initialScenesByContent={scenesByContent}
        initialAssets={assets}
      />
    </div>
  );
}
