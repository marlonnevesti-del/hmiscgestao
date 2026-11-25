import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, History, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/seguranca-backups")({
  head: () => ({
    meta: [
      { title: "Segurança & Backups | HMISC" },
      { name: "description", content: "Histórico automático de versões, restauração de pontos de segurança e exportação de backups do HMISC." },
      { property: "og:title", content: "Segurança & Backups | HMISC" },
      { property: "og:description", content: "Histórico automático de versões e restauração de backups do HMISC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SegurancaBackupsPage,
});

interface HistoryItem {
  id: string;
  version: number;
  saved_at: string;
  saved_by: string | null;
  patient_count: number;
  encounter_count: number;
  appointment_count: number;
  reason: string;
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR");
}

function SegurancaBackupsPage() {
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<HistoryItem | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["clinical-state-history"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("clinical_state_history")
        .select("id, version, saved_at, saved_by, patient_count, encounter_count, appointment_count, reason")
        .order("saved_at", { ascending: false })
        .order("version", { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (rows ?? []) as HistoryItem[];
      const userIds = Array.from(new Set(list.map((r) => r.saved_by).filter((id): id is string => Boolean(id))));
      const names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, username").in("id", userIds);
        for (const p of profiles ?? []) names[p.id] = p.full_name || p.username || p.id.slice(0, 8);
      }
      return { list, names };
    },
  });

  const handleDownloadCurrent = async () => {
    setDownloadingId("current");
    try {
      const { data: row, error } = await supabase.from("clinical_state").select("version, updated_at, data").eq("id", "main").single();
      if (error || !row) throw error ?? new Error("Estado atual não encontrado");
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      downloadJson({ exported_at: new Date().toISOString(), version: row.version, updated_at: row.updated_at, data: row.data }, `hmisc-backup-v${row.version}-${stamp}.json`);
      toast.success(`Backup completo (versão ${row.version}) baixado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar backup.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadPoint = async (item: HistoryItem) => {
    setDownloadingId(item.id);
    try {
      const { data: row, error } = await supabase.from("clinical_state_history").select("version, saved_at, data").eq("id", item.id).single();
      if (error || !row) throw error ?? new Error("Ponto não encontrado");
      const stamp = row.saved_at.slice(0, 16).replace(/[:T]/g, "-");
      downloadJson({ exported_at: new Date().toISOString(), version: row.version, saved_at: row.saved_at, data: row.data }, `hmisc-ponto-v${row.version}-${stamp}.json`);
      toast.success(`Ponto v${row.version} baixado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar ponto.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRestore = async () => {
    if (!confirmTarget) return;
    setRestoring(true);
    try {
      const { data: newVersion, error } = await supabase.rpc("restore_clinical_state_snapshot", { _history_id: confirmTarget.id });
      if (error) throw error;
      toast.success(`Sistema restaurado para o ponto v${confirmTarget.version} (nova versão ativa: v${newVersion}). Recarregando...`);
      setConfirmTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["clinical-state-history"] });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao restaurar ponto.");
    } finally {
      setRestoring(false);
    }
  };

  const list = data?.list ?? [];
  const names = data?.names ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" /> Segurança & Backups
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada alteração salva no hospital gera automaticamente um ponto de restauração imutável no PostgreSQL (até 100 versões recentes).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar lista
          </Button>
          <Button size="sm" onClick={handleDownloadCurrent} disabled={downloadingId === "current"}>
            <Download className="mr-2 h-4 w-4" /> {downloadingId === "current" ? "Gerando..." : "Baixar Backup Completo (.JSON)"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-muted-foreground" /> Pontos de restauração disponíveis ({list.length})
          </div>
          <span className="text-xs text-muted-foreground">Compatível com servidor físico PostgreSQL (pg_dump / pg_restore)</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando histórico de segurança...</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum ponto de restauração registrado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Versão</th>
                  <th className="px-4 py-2.5">Data / Hora</th>
                  <th className="px-4 py-2.5">Responsável</th>
                  <th className="px-4 py-2.5 text-right">Pacientes</th>
                  <th className="px-4 py-2.5 text-right">Atendimentos</th>
                  <th className="px-4 py-2.5 text-right">Agendamentos</th>
                  <th className="px-4 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((item, idx) => (
                  <tr key={item.id} className={idx === 0 ? "bg-primary/5" : "hover:bg-muted/30"}>
                    <td className="px-4 py-2.5 font-mono font-medium">
                      v{item.version} {idx === 0 && <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-primary">ATUAL</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{formatDateTime(item.saved_at)}</td>
                    <td className="px-4 py-2.5">{item.saved_by ? (names[item.saved_by] ?? "Colaborador") : "Sistema"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{item.patient_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{item.encounter_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{item.appointment_count}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadPoint(item)} disabled={downloadingId === item.id} title="Baixar esta versão em JSON">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {idx > 0 && (
                          <Button variant="outline" size="sm" onClick={() => setConfirmTarget(item)}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restaurar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={Boolean(confirmTarget)} onOpenChange={(open) => { if (!open && !restoring) setConfirmTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar ponto de segurança v{confirmTarget?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              O estado atual do hospital será substituído pela fotografia salva em{" "}
              <strong>{confirmTarget ? formatDateTime(confirmTarget.saved_at) : ""}</strong>{" "}
              ({confirmTarget?.patient_count ?? 0} pacientes, {confirmTarget?.encounter_count ?? 0} atendimentos e{" "}
              {confirmTarget?.appointment_count ?? 0} agendamentos). O estado atual também permanece salvo no histórico caso precise voltar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring}>
              {restoring ? "Restaurando..." : "Confirmar restauração"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}