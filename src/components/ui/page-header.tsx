import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/status-badge";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  milestoneLabel: string;
  statusLabel?: string;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  milestoneLabel,
  statusLabel = "Fondasi UI (Milestone 0)",
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={milestoneLabel} variant="info" />
          <StatusBadge label={statusLabel} variant="warning" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
          {title}
        </h1>
        <p className="max-w-3xl text-sm text-stone-600">{subtitle}</p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
