import { MANCHESTER, type Manchester } from "@/lib/hospital-data";
import { cn } from "@/lib/utils";

export function RiskBadge({ risk, className }: { risk: Manchester | undefined; className?: string }) {
  if (!risk) return <span className={cn("inline-flex items-center rounded border border-dashed px-2 py-0.5 text-xs text-muted-foreground", className)}>Sem classificação</span>;
  return <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide", MANCHESTER[risk].cls, className)}>{MANCHESTER[risk].label}</span>;
}

export function RiskStripe({ risk }: { risk: Manchester | undefined }) {
  return <span className={cn("w-1.5 shrink-0 self-stretch rounded-l-md", risk ? MANCHESTER[risk].cls : "bg-muted")} />;
}
