import { AnalyticsDashboardManager } from "@/features/analytics/analytics-dashboard-manager";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  getAnalyticsSummary,
  listContentAnalytics,
  listContentItems,
  listOrInitializePublications,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const owner = await getAuthorizedOwner();
  const [summary, analytics, items, publications] = await Promise.all([
    getAnalyticsSummary(owner.ownerId),
    listContentAnalytics(owner.ownerId),
    listContentItems(owner.ownerId),
    listOrInitializePublications(owner.ownerId),
  ]);

  return (
    <div className="space-y-6">
      <AnalyticsDashboardManager
        initialSummary={summary}
        initialAnalytics={analytics}
        initialItems={items}
        initialPublications={publications}
      />
    </div>
  );
}
