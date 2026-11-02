import { PublishingManager } from "@/features/publishing/publishing-manager";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  listAssetsForContent,
  listContentItems,
  listOrInitializePublications,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function PublishingPage() {
  const owner = await getAuthorizedOwner();
  const [items, allPublications, assets] = await Promise.all([
    listContentItems(owner.ownerId),
    listOrInitializePublications(owner.ownerId),
    listAssetsForContent(owner.ownerId),
  ]);

  return (
    <div className="space-y-6">
      <PublishingManager
        initialItems={items}
        initialPublications={allPublications}
        initialAssets={assets}
      />
    </div>
  );
}
