import { useSyncStatus } from "@/lib/sync-status";
import { cn } from "@/lib/utils";

const LABEL = { synced: "Sincronizado", saving: "Gravando…", offline: "Sem conexão" } as const;

export function SyncIndicator() {
  const s = useSyncStatus();
  return (
    <span role="status" title={s === "offline" ? "Sem conexão com o servidor. Não feche a tela: as alterações serão enviadas ao reconectar." : LABEL[s]} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", s === "offline" && "border-destructive text-destructive")}>
      <span className={cn("h-2 w-2 rounded-full", s === "synced" && "bg-primary", s === "saving" && "animate-pulse bg-muted-foreground", s === "offline" && "animate-pulse bg-destructive")} />
      <span className="hidden sm:inline">{LABEL[s]}</span>
    </span>
  );
}
