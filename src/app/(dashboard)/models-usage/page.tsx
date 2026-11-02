import { PageHeader } from "@/components/ui/page-header";
import { FlowCreditVisualizer } from "@/components/providers/flow-credit-visualizer";
import { AccountProfileSwitcher } from "@/components/providers/account-profile-switcher";
import { readProviderProfilesVault } from "@/lib/providers/account-profiles";

export const dynamic = "force-dynamic";

export default async function ModelsUsagePage() {
  const vault = readProviderProfilesVault();
  const activeProfile =
    vault.profiles.find((p) => p.id === vault.activeProfileId) ??
    vault.profiles[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Models Usage & Multi-Account API"
        subtitle="Kelola daftar Akun Google, pantau sisa kuota kredit real-time Google Flow, ElevenLabs & Google Gemini AI, serta pilih akun aktif untuk produksi."
        milestoneLabel="Models Usage"
        statusLabel={
          activeProfile
            ? `Akun Aktif: ${activeProfile.label}`
            : `${vault.profiles.length} Akun Tersimpan`
        }
      />

      {/* Google Flow 10-Profile Credit Visualizer Bar */}
      <FlowCreditVisualizer />

      <AccountProfileSwitcher focusMode="all" defaultExpanded={false} />
    </div>
  );
}
