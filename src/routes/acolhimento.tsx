import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MANCHESTER, QUEUE, type Manchester, type QueueItem } from "@/lib/hospital-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/acolhimento")({
  head: () => ({ meta: [
    { title: "Acolhimento e Classificação de Risco – HMI Gestão" },
    { name: "description", content: "Fila em tempo real e triagem pelo Protocolo de Manchester para gestantes e pediatria." },
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
  const [queue, setQueue] = useState<QueueItem[]>(QUEUE);
  const [sel, setSel] = useState<QueueItem | null>(null);
  const sorted = (g: QueueItem["group"]) => queue.filter((q) => q.group === g).sort((a, b) => (a.risk ? ORDER.indexOf(a.risk) : -1) - (b.risk ? ORDER.indexOf(b.risk) : -1) || b.arrivedMinAgo - a.arrivedMinAgo);
  const Col = ({ g, title }: { g: QueueItem["group"]; title: string }) => (
    <div className="rounded-lg border bg-card p-3">
      <h2 className={cn("mb-2 font-semibold", g === "obstetrica" ? "text-maternal" : "text-primary")}>{title} <span className="text-xs text-muted-foreground">({sorted(g).length})</span></h2>
      <div className="space-y-2">
        {sorted(g).map((q) => {
          const secs = q.arrivedMinAgo * 60 + tick;
          const late = q.risk && secs / 60 > MANCHESTER[q.risk].max;
          return (
            <button key={q.id} onClick={() => setSel(q)} className={cn("flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted", sel?.id === q.id && "ring-2 ring-ring")}>
              <span className={cn("h-10 w-1.5 rounded", q.risk ? MANCHESTER[q.risk].cls : "bg-muted-foreground/30")} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{q.name} <span className="text-xs text-muted-foreground">· {q.detail}</span></div><div className="truncate text-xs text-muted-foreground">{q.complaint}</div></div>
              <div className="text-right"><div className={cn("font-mono text-sm", late && "font-bold text-destructive")}>{fmt(secs)}</div><div className="text-[10px] text-muted-foreground">{q.risk ? MANCHESTER[q.risk].label : "Aguard. triagem"}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h1 className="text-xl font-semibold">Acolhimento e classificação de risco</h1><p className="text-sm text-muted-foreground">Protocolo de Manchester adaptado · clique em um paciente para triar</p></div>
        <div className="flex gap-1">{ORDER.map((r) => <span key={r} className={cn("rounded px-2 py-1 text-[10px] font-semibold", MANCHESTER[r].cls)}>{MANCHESTER[r].label} {MANCHESTER[r].max ? `≤${MANCHESTER[r].max}min` : "imediato"}</span>)}</div></div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1.2fr]">
        <Col g="obstetrica" title="Gestantes / Puérperas" />
        <Col g="pediatria" title="Pediatria" />
        <TriageForm key={sel?.id} item={sel} onSave={(risk) => { if (!sel) return; setQueue((qs) => qs.map((q) => q.id === sel.id ? { ...q, risk } : q)); toast.success(`${sel.name} classificado(a): ${MANCHESTER[risk].label}`); setSel(null); }} />
      </div>
    </div>
  );
}

function F({ label, ph, unit }: { label: string; ph?: string; unit?: string }) {
  return <label className="text-xs font-medium text-muted-foreground">{label}<div className="mt-1 flex items-center rounded-md border bg-background"><input placeholder={ph} className="h-8 w-full bg-transparent px-2 text-sm text-foreground outline-none" />{unit && <span className="pr-2 text-[10px]">{unit}</span>}</div></label>;
}

function TriageForm({ item, onSave }: { item: QueueItem | null; onSave: (r: Manchester) => void }) {
  const [risk, setRisk] = useState<Manchester | undefined>(item?.risk);
  if (!item) return <div className="flex items-center justify-center rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">Selecione um paciente da fila</div>;
  const ob = item.group === "obstetrica";
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div><div className="text-xs uppercase text-muted-foreground">Triagem {ob ? "obstétrica" : "pediátrica"}</div><div className="font-semibold">{item.name}</div><div className="text-xs text-muted-foreground">Queixa: {item.complaint}</div></div>
      <div className="text-xs font-semibold text-primary">Sinais vitais</div>
      <div className="grid grid-cols-3 gap-2"><F label="PA" ph="120/80" unit="mmHg" /><F label="FC" ph="80" unit="bpm" /><F label="FR" ph="18" unit="irpm" /><F label="Tax" ph="36,5" unit="°C" /><F label="SatO2" ph="98" unit="%" /><F label="Dor (0–10)" ph="0" /></div>
      <div className={cn("text-xs font-semibold", ob ? "text-maternal" : "text-primary")}>{ob ? "Dados obstétricos" : "Dados pediátricos"}</div>
      {ob ? (
        <div className="grid grid-cols-2 gap-2"><F label="Idade gestacional" ph="38s 2d" /><F label="DUM" ph="dd/mm/aaaa" /><F label="BCF" ph="140" unit="bpm" /><F label="Dinâmica uterina" ph="3/10min 40s" /><div className="col-span-2"><F label="Queixa obstétrica" ph="Perda de líquido, sangramento, contrações…" /></div></div>
      ) : (
        <div className="grid grid-cols-3 gap-2"><F label="Peso" ph="12,5" unit="kg" /><F label="Estatura" ph="85" unit="cm" /><F label="Perím. cefálico" ph="47" unit="cm" /><div className="col-span-3"><F label="Responsável legal" ph="Nome completo" /></div></div>
      )}
      <div className="text-xs font-semibold text-primary">Classificação</div>
      <div className="grid grid-cols-5 gap-1">{ORDER.map((r) => <button key={r} onClick={() => setRisk(r)} className={cn("rounded py-2 text-[10px] font-semibold", MANCHESTER[r].cls, risk === r ? "ring-2 ring-foreground ring-offset-2" : "opacity-60")}>{MANCHESTER[r].label}</button>)}</div>
      <button disabled={!risk} onClick={() => risk && onSave(risk)} className="w-full rounded-md bg-clinical py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">Concluir classificação</button>
    </div>
  );
}
