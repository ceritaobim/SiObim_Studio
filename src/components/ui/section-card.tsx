import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  badge,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-stone-200 bg-white p-4 shadow-xs sm:p-5",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-stone-600 sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {badge ? <div>{badge}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
