import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoPermission } from "@/components/AppShell";
import { MANCHESTER, can, type Manchester, type QueueItem } from "@/lib/hospital-data";
import { setState, useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/acolhimento")({
  head: () => ({ meta: [
    { title: "Acolhimento e Classificação de Risco – HMI Gestão" },
    { name: "description", content: "Fila em tempo real e triagem pelo Protocolo de Manchester para obstetrícia e pediatria." },
    { property: "og:title", content: "Acolhimento e Classificação de Risco – HMI Gestão" },
    { property: "og:description", content: "Fila em tempo real e triagem pelo Protocolo de Manchester." },
  ] }),
  component: Acolhimento,
});

const ORDER: Manchester[] = ["vermelho", "laranja", "amarelo", "verde", "azul"];
function useTick() { const [t, setT] = useState(0); useEffect(() => { const i = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(i); }, []); return t; }
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Acolhimento() {
  const tick = useTick();
  const queue = useStore((s) => s.queue);
  const profile = useStore((s) => s.profile);
  const [tab, setTab] = useState<QueueItem["group"]>("obstetrica");
  const [sel, setSel] = useState<QueueItem | null>(null);
  const list = queue.filter((q) => q.group === tab).sort((a, b) => (a.risk ? ORDER.indexOf(a.risk) : -1) - (b.risk ? ORDER.indexOf(b.risk) : -1) || b.arrivedMinAgo - a.arrivedMinAgo);
  const count = (g: QueueItem["group"]) => queue.filter((q) => q.group === g).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-semibold">Acolhimento e classificação de risco</h1><p className="text-sm text-muted-foreground">Protocolo de Manchester adaptado · clique em um paciente para triar</p></div>
        <div className="flex gap-1">{ORDER.map((r) => <span key={r} className={cn("rounded px-2 py-1 text-[10px] font-semibold", MANCHESTER[r].cls)}>{MANCHESTER[r].label} {MANCHESTER[r].max ? `≤${MANCHESTER[r].max}min` : "imediato"}</span>)}</div>
      </div>
      <div className="flex gap-1 border-b">
        {([["obstetrica", "Obstetrícia"], ["pediatria", "Pediatria"]] as const).map(([g, l]) => (
          <button key={g} onClick={() => setTab(g)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium", tab === g ? (g === "obstetrica" ? "border-maternal text-maternal" : "border-primary text-primary") : "border-transparent text-muted-foreground")}>{l} ({count(g)})</button>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((q) => {
          const secs = q.arrivedMinAgo * 60 + tick;
          const late = q.risk && secs / 60 > MANCHESTER[q.risk].max;
          return (
            <button key={q.id} onClick={() => setSel(q)} className="flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left hover:bg-muted">
              <span className={cn("h-12 w-1.5 rounded", q.risk ? MANCHESTER[q.risk].cls : "bg-muted-foreground/30")} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{q.name} <span className="text-xs text-muted-foreground">· {q.detail}</span></div><div className="truncate text-xs text-muted-foreground">{q.complaint}</div></div>
              {q.risk ? <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", MANCHESTER[q.risk].cls)}>{MANCHESTER[q.risk].label}</span> : <span className="rounded border px-2 py-0.5 text-[10px]">Aguard. triagem</span>}
              <div className={cn("w-14 text-right font-mono text-sm", late && "font-bold text-destructive")}>{fmt(secs)}</div>
            </button>
          );
        })}
      </div>
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Triagem {sel?.group === "obstetrica" ? "obstétrica" : "pediátrica"} – {sel?.name}</DialogTitle></DialogHeader>
          {sel && (can(profile, "triagem") ? <TriageForm key={sel.id} item={sel} onSave={(risk, weight) => {
            setState((s) => ({ queue: s.queue.map((q) => q.id === sel.id ? { ...q, risk, weight } : q) }));
            toast.success(`${sel.name} classificado(a): ${MANCHESTER[risk].label}`); setSel(null);
          }} /> : <NoPermission action="realizar triagem" />)}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, ph, unit, value, onChange, required }: { label: string; ph?: string; unit?: string; value?: string; onChange?: (v: string) => void; required?: boolean }) {
  return <label className="text-xs font-medium text-muted-foreground">{label}{required && <span className="text-maternal"> *</span>}<div className={cn("mt-1 flex items-center rounded-md border bg-background", required && !value && "border-maternal")}><input placeholder={ph} value={value} onChange={onChange && ((e) => onChange(e.target.value))} className="h-8 w-full bg-transparent px-2 text-sm text-foreground outline-none" />{unit && <span className="pr-2 text-[10px]">{unit}</span>}</div></label>;
}

function TriageForm({ item, onSave }: { item: QueueItem; onSave: (r: Manchester, weight?: number) => void }) {
  const [risk, setRisk] = useState<Manchester | undefined>(item.risk);
  const [weight, setWeight] = useState(item.weight ? String(item.weight) : "");
  const ob = item.group === "obstetrica";
  const w = parseFloat(weight.replace(",", "."));
  const valid = !!risk && (ob || w > 0);
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Queixa: {item.complaint}</div>
      <div className="text-xs font-semibold text-primary">Sinais vitais</div>
      <div className="grid grid-cols-3 gap-2"><F label="PA" ph="120/80" unit="mmHg" /><F label="FC" ph="80" unit="bpm" /><F label="FR" ph="18" unit="irpm" /><F label="Tax" ph="36,5" unit="°C" /><F label="SatO2" ph="98" unit="%" /><F label="Escala de dor (0–10)" ph="0" /></div>
      <div className={cn("text-xs font-semibold", ob ? "text-maternal" : "text-primary")}>{ob ? "Dados obstétricos" : "Dados pediátricos"}</div>
      {ob ? (
        <div className="grid grid-cols-2 gap-2">
          <F label="Idade gestacional" ph="38s 2d" /><F label="DUM" ph="dd/mm/aaaa" /><F label="BCF" ph="140" unit="bpm" /><F label="Dinâmica uterina" ph="3/10min 40s" />
          <label className="text-xs font-medium text-muted-foreground">Perda de líquido<select className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground"><option>Não</option><option>Sim – claro</option><option>Sim – meconial</option></select></label>
          <label className="text-xs font-medium text-muted-foreground">Sangramento<select className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground"><option>Ausente</option><option>Discreto</option><option>Moderado</option><option>Intenso</option></select></label>
          <div className="col-span-2"><F label="Queixa principal" ph="Contrações, perda de líquido…" /></div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <F label="Peso atual" ph="12,5" unit="kg" value={weight} onChange={setWeight} required /><F label="Estatura" ph="85" unit="cm" /><F label="Perím. cefálico" ph="47" unit="cm" />
          <div className="col-span-3"><F label="Responsável legal" ph="Nome completo" /></div>
          {!(w > 0) && <div className="col-span-3 text-[11px] text-maternal">Peso obrigatório para o cálculo de doses pediátricas.</div>}
        </div>
      )}
      <div className="text-xs font-semibold text-primary">Classificação</div>
      <div className="grid grid-cols-5 gap-1">{ORDER.map((r) => <button key={r} onClick={() => setRisk(r)} className={cn("rounded py-2 text-[10px] font-semibold", MANCHESTER[r].cls, risk === r ? "ring-2 ring-foreground ring-offset-2" : "opacity-60")}>{MANCHESTER[r].label}</button>)}</div>
      <button disabled={!valid} onClick={() => risk && onSave(risk, ob ? undefined : w)} className="w-full rounded-md bg-clinical py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">Concluir classificação</button>
    </div>
  );
}
