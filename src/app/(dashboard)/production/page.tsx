import { AudioTableManager } from "@/features/voice/audio-table-manager";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  listAllScenesGroupedByContent,
  listAssetsForContent,
  listContentItems,
} from "@/lib/db/repository";
import { getActiveTTSProvider } from "@/lib/providers/tts/tts-provider";

export const dynamic = "force-dynamic";

export default async function AudioPage() {
  const owner = await getAuthorizedOwner();
  const [items, assets, scenesByContent] = await Promise.all([
    listContentItems(owner.ownerId),
    listAssetsForContent(owner.ownerId),
    listAllScenesGroupedByContent(owner.ownerId),
  ]);

  const tts = getActiveTTSProvider();

  return (
    <div className="space-y-5">
      <AudioTableManager
        initialItems={items}
        initialAssets={assets}
        initialScenesByContent={scenesByContent}
        ttsProviderLabel={`${tts.providerKey} (${tts.modelName})`}
      />
    </div>
  );
}
