import { triggerSyncRetry, useSyncStatus } from "@/lib/sync-status";
import { cn } from "@/lib/utils";

const LABEL = { synced: "Sincronizado", saving: "Gravando…", pending: "Pendente", offline: "Sem conexão" } as const;

export function SyncIndicator() {
  const s = useSyncStatus();
  const needsRetry = s === "offline" || s === "pending";
  return (
    <span role="status" title={needsRetry ? "Há alterações aguardando envio ao servidor. Clique em Reenviar." : LABEL[s]} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", needsRetry && "border-destructive text-destructive")}>
      <span className={cn("h-2 w-2 rounded-full", s === "synced" && "bg-primary", s === "saving" && "animate-pulse bg-muted-foreground", needsRetry && "animate-pulse bg-destructive")} />
      <span className="hidden sm:inline">{LABEL[s]}</span>
      {needsRetry && (
        <button type="button" onClick={triggerSyncRetry} className="ml-1 underline underline-offset-2 hover:opacity-80">Reenviar</button>
      )}
    </span>
  );
}
