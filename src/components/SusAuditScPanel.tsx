import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Target } from "lucide-react";
import { useStore } from "@/lib/hospital-store";
import { buildSusRows, competenceOf, type Professional } from "@/lib/sus-billing";
import {
  computeContractGoals,
  DEFAULT_CONTRACT_GOALS,
  runSusPreAudit,
  SC_CLOSING_CHECKLIST,
  type ContractGoalsConfig,
  type PreAuditReport,
} from "@/lib/sus-audit-sc";
import { loadSigtap, type SigtapProc } from "@/lib/sigtap";
import { loadSigtapRules, sigtapGlosas, type SigtapRules } from "@/lib/sigtap-compat";
import { cn } from "@/lib/utils";

const CHECKLIST_KEY = "hmisc-sus-sc-checklist";
const GOALS_KEY = "hmisc-sus-sc-goals";
const PROF_KEY = "hmisc-sus-prof";

export function SusAuditScPanel() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const [comp, setComp] = useState(() => competenceOf(new Date().toISOString()));
  const [prof, setProf] = useState<Professional>({ name: "", cns: "", cbo: "225125" });
  const [sig, setSig] = useState<{ list: SigtapProc[]; rules: SigtapRules } | null>(null);
  const [report, setReport] = useState<PreAuditReport | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [goalsCfg, setGoalsCfg] = useState<ContractGoalsConfig>(DEFAULT_CONTRACT_GOALS);
  const [editingGoals, setEditingGoals] = useState(false);

  useEffect(() => {
    Promise.all([loadSigtap(), loadSigtapRules()]).then(([list, rules]) => setSig({ list, rules }));
    try {
      const p = localStorage.getItem(PROF_KEY);
      if (p) setProf(JSON.parse(p) as Professional);
      const g = localStorage.getItem(GOALS_KEY);
      if (g) setGoalsCfg({ ...DEFAULT_CONTRACT_GOALS, ...(JSON.parse(g) as Partial<ContractGoalsConfig>) });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${CHECKLIST_KEY}-${comp}`);
      setChecked(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch { setChecked({}); }
    setReport(null);
  }, [comp]);

  const rows = useMemo(() => buildSusRows(encounters, patients, comp, prof).map((r) => {
    if (!sig) return r;
    const g = sigtapGlosas(sig.rules, sig.list.find((x) => x.c === r.procedure), r);
    return g.length ? { ...r, issues: [...r.issues, ...g] } : r;
  }), [encounters, patients, comp, prof, sig]);

  const goals = useMemo(() => computeContractGoals(rows, encounters, comp, goalsCfg), [rows, encounters, comp, goalsCfg]);

  const toggleCheck = (id: string, val: boolean) => {
    const next = { ...checked, [id]: val };
    setChecked(next);
    try { localStorage.setItem(`${CHECKLIST_KEY}-${comp}`, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const saveGoals = () => {
    try { localStorage.setItem(GOALS_KEY, JSON.stringify(goalsCfg)); } catch { /* ignore */ }
    setEditingGoals(false);
  };

  const doneCount = SC_CLOSING_CHECKLIST.filter((item) => checked[item.id]).length;
  const monthLabel = `${comp.slice(4)}/${comp.slice(0, 4)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pré-Auditoria SES-SC, Checklist & Metas</h1>
          <p className="text-sm text-muted-foreground">Conferência preventiva para evitar glosas da GEFAT/SES-SC e acompanhar metas do Contrato de Gestão.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium">Competência<Input type="month" className="w-40" value={`${comp.slice(0, 4)}-${comp.slice(4)}`} onChange={(e) => e.target.value && setComp(e.target.value.replace("-", ""))} /></label>
          <Button onClick={() => setReport(runSusPreAudit(rows, patients, comp, prof))}><ShieldCheck className="h-4 w-4" />Rodar Pré-Auditoria SC ({monthLabel})</Button>
        </div>
      </div>

      {report && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Resultado da Crítica DATASUS / SES-SC · {monthLabel}</h2>
            <span className="text-xs text-muted-foreground">{report.total} registro(s) analisado(s)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-clinical-soft p-3 text-clinical"><div className="text-xs">Aptos para remessa</div><div className="text-2xl font-bold">{report.readyCount}</div></div>
            <div className="rounded-md border bg-maternal-soft p-3 text-maternal"><div className="text-xs">Com bloqueio DATASUS</div><div className="text-2xl font-bold">{report.blockedCount}</div></div>
            <div className="rounded-md border bg-mt-yellow/40 p-3 text-foreground"><div className="text-xs">Alertas preventivos SC</div><div className="text-2xl font-bold">{report.warningCount}</div></div>
          </div>
          {report.findings.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-clinical"><CheckCircle2 className="h-4 w-4" />Nenhuma inconsistência encontrada nesta competência.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left uppercase text-muted-foreground"><tr><th className="p-2">Tipo</th><th className="p-2">Categoria</th><th className="p-2">Nº</th><th className="p-2">Paciente</th><th className="p-2">Apontamento</th></tr></thead>
                <tbody>
                  {report.findings.map((f, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 whitespace-nowrap">{f.severity === "bloqueio" ? <span className="inline-flex items-center gap-1 font-medium text-destructive"><XCircle className="h-3.5 w-3.5" />Bloqueio</span> : <span className="inline-flex items-center gap-1 font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Alerta</span>}</td>
                      <td className="p-2 whitespace-nowrap">{f.category}</td>
                      <td className="p-2 font-mono whitespace-nowrap">{f.encounterNumber}</td>
                      <td className="p-2">{f.patientName}</td>
                      <td className="p-2">{f.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h2 className="font-semibold">Monitor de Metas do Contrato de Gestão · {monthLabel}</h2></div>
          <Button size="sm" variant="outline" onClick={() => setEditingGoals((v) => !v)}>{editingGoals ? "Cancelar" : "Ajustar metas mensais"}</Button>
        </div>
        {editingGoals && (
          <div className="grid gap-2 rounded border bg-muted/30 p-3 sm:grid-cols-5">
            <label className="text-xs">Partos<Input type="number" min={1} value={goalsCfg.partos} onChange={(e) => setGoalsCfg((c) => ({ ...c, partos: Number(e.target.value) || 1 }))} /></label>
            <label className="text-xs">Internações<Input type="number" min={1} value={goalsCfg.internacoes} onChange={(e) => setGoalsCfg((c) => ({ ...c, internacoes: Number(e.target.value) || 1 }))} /></label>
            <label className="text-xs">Consultas BPA<Input type="number" min={1} value={goalsCfg.consultas} onChange={(e) => setGoalsCfg((c) => ({ ...c, consultas: Number(e.target.value) || 1 }))} /></label>
            <label className="text-xs">Exames SADT<Input type="number" min={1} value={goalsCfg.exames} onChange={(e) => setGoalsCfg((c) => ({ ...c, exames: Number(e.target.value) || 1 }))} /></label>
            <div className="flex items-end"><Button size="sm" onClick={saveGoals}>Salvar metas</Button></div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {goals.map((g) => (
            <div key={g.key} className="space-y-2 rounded-md border p-3">
              <div className="text-xs font-medium text-muted-foreground">{g.label}</div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold">{g.actual}</span>
                <span className="text-xs text-muted-foreground">meta {g.target} ({g.pct}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full transition-all", g.status === "atingida" ? "bg-clinical" : g.status === "atencao" ? "bg-mt-yellow" : "bg-maternal")} style={{ width: `${Math.min(100, g.pct)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Checklist Oficial de Fechamento · {monthLabel}</h2>
          <span className="text-xs font-medium text-muted-foreground">{doneCount} de {SC_CLOSING_CHECKLIST.length} conferido(s)</span>
        </div>
        <div className="space-y-2">
          {SC_CLOSING_CHECKLIST.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/30">
              <Checkbox checked={!!checked[item.id]} onCheckedChange={(v) => toggleCheck(item.id, !!v)} className="mt-0.5" />
              <div className="space-y-0.5">
                <div className={cn("text-sm font-medium", checked[item.id] && "line-through text-muted-foreground")}>{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}