import { SmartUploadAssistant } from "@/features/publishing/smart-upload-assistant";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  listContentItems,
  listOrInitializePublications,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const owner = await getAuthorizedOwner();
  const [items, allPublications] = await Promise.all([
    listContentItems(owner.ownerId),
    listOrInitializePublications(owner.ownerId),
  ]);

  return (
    <div className="space-y-5">
      <SmartUploadAssistant
        initialItems={items}
        initialAllPublications={allPublications}
      />
    </div>
  );
}
