import { PageHeader } from "@/components/ui/page-header";
import { WeeklyBatchWizard } from "@/features/content-planning/weekly-batch-wizard";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  getProjectSettings,
  listContentBatches,
} from "@/lib/db/repository";
import { getActiveLLMProvider } from "@/lib/providers/llm/llm-provider";

export const dynamic = "force-dynamic";

export default async function WeeklyBatchesPage() {
  const owner = await getAuthorizedOwner();
  const [batches, settings] = await Promise.all([
    listContentBatches(owner.ownerId),
    getProjectSettings(owner.ownerId),
  ]);
  const llm = getActiveLLMProvider();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Batches (Wizard Perencanaan Mingguan)"
        subtitle="Rencanakan batch mingguan berbasis histori Content Library, periksa klaim fakta & URL sumber, setujui naskah, dan sinkronkan ke Google Spreadsheet Anda."
        milestoneLabel="Milestone 2 • Aktif"
        statusLabel={`LLM: ${llm.providerKey} (${llm.modelName})`}
      />

      <WeeklyBatchWizard
        initialBatches={batches}
        initialSettings={settings}
      />
    </div>
  );
}
