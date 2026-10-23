import { ContentPlanningTable } from "@/features/content-library/content-planning-table";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  getProjectSettings,
  listAssetsForContent,
  listContentItems,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function ContentPlanningPage() {
  const owner = await getAuthorizedOwner();
  const [items, settings, allAssets] = await Promise.all([
    listContentItems(owner.ownerId),
    getProjectSettings(owner.ownerId),
    listAssetsForContent(owner.ownerId),
  ]);

  return (
    <div className="space-y-5">
      <ContentPlanningTable
        initialItems={items}
        initialAssets={allAssets}
        initialGoogleSheetUrl={settings.googleSheetUrl ?? ""}
        initialGoogleSheetWebAppUrl={settings.googleSheetWebAppUrl ?? ""}
      />
    </div>
  );
}

