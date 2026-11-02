import { ToolsHubManager } from "@/features/tools/tools-hub-manager";

export const dynamic = "force-dynamic";

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <ToolsHubManager />
    </div>
  );
}
