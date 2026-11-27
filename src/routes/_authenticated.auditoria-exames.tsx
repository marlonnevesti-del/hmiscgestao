import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { CheckCircle2, FileSearch, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Letterhead } from "@/components/DischargePrint";
import { collectExamAuditRows, reconcileExternalList, type ExamAuditRow } from "@/lib/exam-audit";
import { KIND_LABELS, PROVIDER_LABELS, type ExamAuditStatus, type ExamKind, type ExamProvider } from "@/lib/exam-requests";
import { auditExamRequest, useStore } from "@/lib/hospital-store";
import { formatCode } from "@/lib/sigtap";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/auditoria-exames")({
  head: () => ({
    meta: [
      { title: "Conferência de Exames e Terceirizados · HMISC" },
      { name: "description", content: "Auditoria de pedidos de exames (PED), rastreabilidade SIGTAP e conciliação de faturas terceirizadas no HMISC." },
      { property: "og:title", content: "Conferência de Exames e Terceirizados · HMISC" },
      { property: "og:description", content: "Auditoria de pedidos de exames (PED), rastreabilidade SIGTAP e conciliação de faturas terceirizadas no HMISC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditoriaExamesPage,
});

const sel = "h-9 rounded-md border bg-background px-2 text-sm";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (d: string) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

function AuditPrintSheet({ rows, month, provider }: { rows: ExamAuditRow[]; month: string; provider: string }) {
  const approved = rows.filter((r) => r.auditStatus === "Aprovado");
  const rejected = rows.filter((r) => r.auditStatus === "Glosado");
  const totalSus = approved.reduce((s, r) => s + r.susValue, 0);
  return (
    <section className="doc-page">
      <Letterhead title="RELATÓRIO DE CONFERÊNCIA E AUDITORIA DE EXAMES" />
      <p style={{ fontSize: "10pt", marginBottom: "8px" }}>
        <b>Competência:</b> {month || "Todas"} · <b>Prestador:</b> {provider ? PROVIDER_LABELS[provider as ExamProvider] : "Todos"} · <b>Emissão:</b> {new Date().toLocaleString("pt-BR")}
      </p>
      <p style={{ fontSize: "10pt", marginBottom: "10px" }}>
        <b>Total:</b> {rows.length} · <b>Aprovados:</b> {approved.length} ({brl(totalSus)} SUS) · <b>Glosados:</b> {rejected.length} · <b>Pendentes:</b> {rows.length - approved.length - rejected.length}
      </p>
      <table className="doc-id" style={{ fontSize: "8.5pt" }}>
        <thead>
          <tr><th>Pedido</th><th>Data</th><th>Paciente / BAA-FIA</th><th>Exame(s) / SIGTAP</th><th>Status</th><th>Auditoria</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.requestId}>
              <td><b>{r.orderNumber}</b></td>
              <td>{dt(r.requestedAt)}</td>
              <td>{r.patientName}<br />{r.encounterNumber} · {r.sector}</td>
              <td>{r.exams}{r.sigtapCodes.length ? <><br />SIGTAP: {r.sigtapCodes.map(formatCode).join(", ")}</> : null}</td>
              <td>{r.status}</td>
              <td><b>{r.auditStatus}</b>{r.auditNote ? ` — ${r.auditNote}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AuditoriaExamesPage() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [provider, setProvider] = useState<ExamProvider | "">("terceirizada");
  const [kind, setKind] = useState<ExamKind | "">("");
  const [auditStatus, setAuditStatus] = useState<ExamAuditStatus | "">("");
  const [query, setQuery] = useState("");
  const [showReconcile, setShowReconcile] = useState(false);
  const [pasted, setPasted] = useState("");
  const [printing, setPrinting] = useState(false);

  const rows = useMemo(
    () => collectExamAuditRows(encounters, patients, { month, provider, kind, auditStatus, query }),
    [encounters, patients, month, provider, kind, auditStatus, query],
  );
  const summary = useMemo(() => ({
    total: rows.length,
    approved: rows.filter((r) => r.auditStatus === "Aprovado").length,
    rejected: rows.filter((r) => r.auditStatus === "Glosado").length,
    pending: rows.filter((r) => r.auditStatus === "Pendente").length,
    susTotal: rows.reduce((s, r) => s + r.susValue, 0),
  }), [rows]);
  const reconciliation = useMemo(() => (showReconcile && pasted.trim() ? reconcileExternalList(rows, pasted) : null), [showReconcile, pasted, rows]);

  const act = (r: ExamAuditRow, status: ExamAuditStatus) => {
    try {
      const note = status === "Glosado" ? (window.prompt("Motivo da glosa (ex.: duplicado, cancelado, sem pedido):") ?? "") : "";
      if (status === "Glosado" && !note.trim()) return;
      auditExamRequest(r.encounterId, r.requestId, status, note);
      toast.success(`Pedido ${r.orderNumber} marcado como ${status.toLowerCase()}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao auditar pedido.");
    }
  };

  const doPrint = () => {
    setPrinting(true);
    document.body.classList.add("print-doc", "print-term");
    const done = () => { document.body.classList.remove("print-doc", "print-term"); setPrinting(false); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 150);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Conferência de Exames e Terceirizados</h1>
          <p className="text-sm text-muted-foreground">Rastreabilidade por número de pedido (PED), código SIGTAP e conciliação de faturas externas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowReconcile((v) => !v)}>
            <FileSearch className="mr-1.5 h-4 w-4" />{showReconcile ? "Ocultar conciliação" : "Conciliar fatura terceirizada"}
          </Button>
          <Button size="sm" onClick={doPrint} disabled={!rows.length}>
            <Printer className="mr-1.5 h-4 w-4" />Imprimir / PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Total de pedidos</div><div className="text-2xl font-bold">{summary.total}</div></div>
        <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Aprovados</div><div className="text-2xl font-bold text-emerald-600">{summary.approved}</div></div>
        <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Glosados</div><div className="text-2xl font-bold text-destructive">{summary.rejected}</div></div>
        <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-bold text-amber-600">{summary.pending}</div></div>
        <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Valor SUS estimado</div><div className="text-xl font-bold">{brl(summary.susTotal)}</div></div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
        <Input type="month" aria-label="Competência" className="w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Button variant="ghost" size="sm" onClick={() => setMonth("")}>Todos meses</Button>
        <select aria-label="Prestador" className={sel} value={provider} onChange={(e) => setProvider(e.target.value as ExamProvider | "")}>
          <option value="">Todos prestadores</option>
          <option value="terceirizada">Terceirizada</option>
          <option value="proprio">Próprio (HMISC)</option>
        </select>
        <select aria-label="Tipo" className={sel} value={kind} onChange={(e) => setKind(e.target.value as ExamKind | "")}>
          <option value="">Todos os tipos</option>
          {(Object.keys(KIND_LABELS) as ExamKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
        <select aria-label="Auditoria" className={sel} value={auditStatus} onChange={(e) => setAuditStatus(e.target.value as ExamAuditStatus | "")}>
          <option value="">Toda auditoria</option>
          <option value="Pendente">Pendente</option>
          <option value="Aprovado">Aprovado</option>
          <option value="Glosado">Glosado</option>
        </select>
        <Input className="min-w-56 flex-1" placeholder="Buscar PED-2026, paciente, SIGTAP ou exame..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {showReconcile && (
        <section className="space-y-3 rounded-lg border bg-card p-3">
          <div>
            <h2 className="text-sm font-semibold">Conciliação com Fatura da Terceirizada</h2>
            <p className="text-xs text-muted-foreground">Cole abaixo as linhas da planilha/fatura do laboratório (nº PED-2026-XXXXXX, código SIGTAP ou nome do paciente, um por linha).</p>
          </div>
          <Textarea rows={4} placeholder={"PED-2026-000001\n0202020380 MARIA SILVA\nJOAO PEREIRA"} value={pasted} onChange={(e) => setPasted(e.target.value)} />
          {reconciliation && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border p-2.5 text-xs">
                <div className="font-semibold text-emerald-600">Encontrados no hospital ({reconciliation.matched.length})</div>
                <ul className="mt-1 space-y-1">{reconciliation.matched.map((m, i) => <li key={i}><span className="font-mono">{m.row.orderNumber}</span> · {m.row.patientName}</li>)}</ul>
              </div>
              <div className="rounded-md border p-2.5 text-xs">
                <div className="font-semibold text-destructive">Cobrança sem pedido no hospital ({reconciliation.notFoundInHospital.length})</div>
                <ul className="mt-1 space-y-1">{reconciliation.notFoundInHospital.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
              <div className="rounded-md border p-2.5 text-xs">
                <div className="font-semibold text-amber-600">Pedidos no período ainda sem laudo ({reconciliation.missingReport.length})</div>
                <ul className="mt-1 space-y-1">{reconciliation.missingReport.slice(0, 15).map((r) => <li key={r.requestId}><span className="font-mono">{r.orderNumber}</span> · {r.patientName} ({r.status})</li>)}</ul>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border bg-card p-3">
        {!rows.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pedido de exame encontrado para os filtros selecionados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Pedido / Data</th>
                  <th>Paciente / BAA-FIA</th>
                  <th>Prestador</th>
                  <th>Exame(s) & SIGTAP</th>
                  <th>Médico</th>
                  <th>Execução</th>
                  <th>Auditoria</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.requestId} className="border-b align-top">
                    <td className="py-2 text-xs">
                      <div className="font-mono font-semibold text-primary">{r.orderNumber}</div>
                      <div className="text-muted-foreground">{dt(r.requestedAt)}</div>
                    </td>
                    <td className="py-2 text-xs">
                      <div className="font-medium">{r.patientName}</div>
                      <div className="text-muted-foreground">{r.encounterNumber} · {r.sector}</div>
                    </td>
                    <td className="py-2 text-xs">
                      <div>{PROVIDER_LABELS[r.provider]}</div>
                      <div className="text-muted-foreground">{KIND_LABELS[r.kind]}</div>
                    </td>
                    <td className="max-w-xs py-2 text-xs">
                      <div className="whitespace-pre-wrap">{r.exams}</div>
                      {r.sigtapCodes.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.sigtapCodes.map((c) => <span key={c} className="rounded bg-muted px-1 font-mono text-[10px]">{formatCode(c)}</span>)}
                        </div>
                      )}
                      {r.susValue > 0 && <div className="mt-0.5 text-[11px] text-muted-foreground">SUS: {brl(r.susValue)}</div>}
                    </td>
                    <td className="py-2 text-xs">
                      <div>{r.requestedBy}</div>
                      {r.council && <div className="text-muted-foreground">CRM {r.council}</div>}
                    </td>
                    <td className="py-2 text-xs">
                      <div className="font-medium">{r.status}</div>
                      <div className={cn("text-[11px]", r.hasReport ? "text-emerald-600" : "text-amber-600")}>{r.hasReport ? "Com laudo" : "Sem laudo"}</div>
                    </td>
                    <td className="py-2 text-xs">
                      <span className={cn("font-semibold", r.auditStatus === "Aprovado" && "text-emerald-600", r.auditStatus === "Glosado" && "text-destructive", r.auditStatus === "Pendente" && "text-amber-600")}>
                        {r.auditStatus}
                      </span>
                      {r.auditNote && <div className="text-[11px] text-destructive">{r.auditNote}</div>}
                      {r.auditedBy && <div className="text-[10px] text-muted-foreground">{r.auditedBy}</div>}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap space-x-1">
                      <Button size="sm" variant="outline" onClick={() => act(r, "Aprovado")} disabled={r.auditStatus === "Aprovado"} title="Aprovar para pagamento">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />Aprovar
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act(r, "Glosado")} title="Glosar exame">
                        <XCircle className="mr-1 h-3.5 w-3.5" />Glosar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {printing && createPortal(<div className="print-doc-root term-root"><AuditPrintSheet rows={rows} month={month} provider={provider} /></div>, document.body)}
    </div>
  );
}