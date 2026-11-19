import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KIND_LABELS, type ExamKind, type ExamRequest, type ExamStatus } from "@/lib/exam-requests";
import { updateExamStatus, useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

const sel = "h-9 rounded-md border bg-background px-2 text-sm";
const dt = (d?: string) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

/** Pedidos de exames de todos os setores (Ambulatório, PS e Maternidade) para o SADT / Ultrassom. */
export function ExamRequestsBoard() {
  const encounters = useStore((s) => s.encounters); const patients = useStore((s) => s.patients);
  const [kind, setKind] = useState<ExamKind | "">(""); const [status, setStatus] = useState<ExamStatus | "abertos">("abertos"); const [q, setQ] = useState("");
  const [report, setReport] = useState<{ eid: string; r: ExamRequest } | null>(null); const [text, setText] = useState("");
  const rows = encounters.flatMap((e) => (e.examRequests ?? []).map((r) => ({ e, r, p: patients.find((x) => x.id === e.patientId) })))
    .filter(({ r, p }) => (!kind || r.kind === kind) && (status === "abertos" ? ["Solicitado", "Agendado", "Realizado"].includes(r.status) : r.status === status) && (!q || (p?.name ?? "").toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.r.requestedAt.localeCompare(b.r.requestedAt));
  const history = (pid: string, id: string) => encounters.filter((e) => e.patientId === pid).flatMap((e) => [...(e.examRequests ?? []).filter((r) => r.id !== id && r.report).map((r) => `${dt(r.doneAt)} · ${r.exams}: ${r.report}`), ...(e.sadtReport ? [`${dt(e.sadtReport.at)} · ${e.sadtReport.exam}: ${e.sadtReport.conclusion}`] : [])]);
  const go = (eid: string, id: string, to: ExamStatus, extra = {}) => { try { updateExamStatus(eid, id, to, extra); toast.success(`Exame ${to.toLowerCase()}`); return true; } catch (x) { toast.error(x instanceof Error ? x.message : "Erro"); return false; } };
  return <section className="space-y-2 rounded-lg border bg-card p-3">
    <h3 className="font-semibold">Pedidos de exames · todos os setores ({rows.length})</h3>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Tipo" className={sel} value={kind} onChange={(e) => setKind(e.target.value as ExamKind | "")}><option value="">Todos os tipos</option>{(Object.keys(KIND_LABELS) as ExamKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select>
      <select aria-label="Situação" className={sel} value={status} onChange={(e) => setStatus(e.target.value as ExamStatus | "abertos")}><option value="abertos">Em aberto</option>{(["Laudado", "Cancelado"] as const).map((s) => <option key={s}>{s}</option>)}</select>
      <Input className="w-60" placeholder="Buscar paciente" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
    {!rows.length ? <p className="text-sm text-muted-foreground">Nenhum pedido.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1">Solicitado</th><th>Paciente</th><th>Setor</th><th>Tipo</th><th>Exame(s)</th><th>Situação</th><th /></tr></thead>
      <tbody>{rows.map(({ e, r, p }) => <tr key={r.id} className="border-b align-top">
        <td className="py-1 text-xs">{dt(r.requestedAt)}<div className="text-muted-foreground">{r.requestedBy}</div></td>
        <td>{p?.name}<div className="text-xs text-muted-foreground">{e.number}</div></td><td className="text-xs">{e.type}</td><td className="text-xs">{KIND_LABELS[r.kind]}</td>
        <td className="max-w-xs whitespace-pre-wrap text-xs">{r.exams}{r.scheduledFor && <div className="font-medium">Agendado: {dt(r.scheduledFor)}</div>}{r.report && <div className="text-muted-foreground">Laudo: {r.report}</div>}</td>
        <td className={cn("text-xs font-semibold", r.status === "Solicitado" && "text-destructive")}>{r.status}</td>
        <td className="space-x-1 whitespace-nowrap text-right">
          {r.status === "Solicitado" && <Button size="sm" variant="outline" onClick={() => { const d = window.prompt("Data e hora do agendamento (dd/mm/aaaa hh:mm):"); if (!d) return; const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/); if (!m) { toast.error("Use dd/mm/aaaa hh:mm"); return; } go(e.id, r.id, "Agendado", { scheduledFor: new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`).toISOString() }); }}>Agendar</Button>}
          {(r.status === "Solicitado" || r.status === "Agendado") && <Button size="sm" onClick={() => window.confirm("Confirmar que o exame foi realizado?") && go(e.id, r.id, "Realizado")}>Confirmar realização</Button>}
          {r.status === "Realizado" && <Button size="sm" onClick={() => { setText(""); setReport({ eid: e.id, r }); }}>Laudar</Button>}
          {(r.status === "Solicitado" || r.status === "Agendado") && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { const n = window.prompt("Motivo do cancelamento:"); if (n) go(e.id, r.id, "Cancelado", { note: n }); }}>Cancelar</Button>}
        </td></tr>)}</tbody></table></div>}
    <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Laudo · {report?.r.exams}</DialogTitle></DialogHeader>
      {report && (() => { const pid = encounters.find((x) => x.id === report.eid)?.patientId ?? ""; const h = history(pid, report.r.id); return <div className="grid gap-3">
        <div className="rounded-md bg-muted p-2 text-xs"><b>Laudos anteriores do paciente</b>{h.length ? <ul className="mt-1 list-disc pl-4">{h.map((x) => <li key={x}>{x}</li>)}</ul> : <p>Nenhum laudo anterior.</p>}</div>
        <Textarea rows={6} value={text} onChange={(x) => setText(x.target.value)} placeholder="Achados e conclusão" />
        <Button onClick={() => { if (go(report.eid, report.r.id, "Laudado", { report: text })) setReport(null); }}>Salvar laudo</Button>
      </div>; })()}
    </DialogContent></Dialog>
  </section>;
}
