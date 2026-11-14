import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CHECKLIST, ROOMS, SURG_STATUS, can, type SurgStatus, type Surgery } from "@/lib/hospital-data";
import { setState, useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/centro-cirurgico")({
  head: () => ({ meta: [
    { title: "Mapa Cirúrgico e Obstétrico – HMI Gestão" },
    { name: "description", content: "Agenda diária das salas de parto e cirúrgicas com checklist de cirurgia segura da OMS." },
    { property: "og:title", content: "Mapa Cirúrgico e Obstétrico – HMI Gestão" },
    { property: "og:description", content: "Agenda das salas, status em tempo real e checklist OMS." },
  ] }),
  component: Centro,
});

const STATUS_CLS: Record<SurgStatus, string> = { Agendado: "bg-secondary text-secondary-foreground border-primary/30", "Em Preparo": "bg-mt-yellow text-foreground", "Em Sala": "bg-maternal text-primary-foreground", RPA: "bg-bed-isolation text-primary-foreground", Finalizado: "bg-bed-free text-primary-foreground" };
const HOURS = Array.from({ length: 12 }, (_, i) => 7 + i);
const updateSurg = (id: string, fn: (s: Surgery) => Partial<Surgery>) => setState((st) => ({ surgeries: st.surgeries.map((s) => (s.id === id ? { ...s, ...fn(s) } : s)) }));

function Centro() {
  const surgeries = useStore((s) => s.surgeries);
  const profile = useStore((s) => s.profile);
  const [selId, setSelId] = useState<string | null>(null);
  const sel = surgeries.find((s) => s.id === selId);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-semibold">Centro cirúrgico e obstétrico</h1><p className="text-sm text-muted-foreground">Mapa do dia · 14/11/2026 · {surgeries.length} procedimentos</p></div>
        <div className="flex flex-wrap gap-1">{SURG_STATUS.map((s) => <span key={s} className={cn("rounded px-2 py-1 text-[10px] font-semibold", STATUS_CLS[s])}>{s} ({surgeries.filter((x) => x.status === s).length})</span>)}</div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card p-4">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[140px_1fr] text-[10px] text-muted-foreground"><div />
            <div className="grid" style={{ gridTemplateColumns: `repeat(${HOURS.length}, 1fr)` }}>{HOURS.map((h) => <div key={h} className="border-l pl-1">{h}h</div>)}</div></div>
          {ROOMS.map((r) => (
            <div key={r} className="grid grid-cols-[140px_1fr] border-t py-2">
              <div className="text-xs font-semibold">{r}</div>
              <div className="relative h-14">
                {surgeries.filter((s) => s.room === r).map((s) => (
                  <button key={s.id} onClick={() => setSelId(s.id)} style={{ left: `${((s.start - 7) / HOURS.length) * 100}%`, width: `${(s.duration / HOURS.length) * 100}%` }} className={cn("absolute top-0 h-full overflow-hidden rounded-md border p-1.5 text-left text-[11px] shadow-sm hover:ring-2 hover:ring-ring", STATUS_CLS[s.status])}>
                    <div className="truncate font-semibold">{s.type}</div><div className="truncate">{s.patient}</div><div className="truncate opacity-80">{s.status}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSelId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {sel && <>
            <SheetHeader><SheetTitle>{sel.type} – {sel.patient}</SheetTitle></SheetHeader>
            <div className="space-y-4 px-4 pb-6 text-sm">
              <div className="text-xs text-muted-foreground">{sel.room} · {sel.start}h–{sel.start + sel.duration}h · {sel.surgeon} · TUSS {sel.tuss}</div>
              {sel.patientId && <Link to="/pacientes/$id" params={{ id: sel.patientId }} className="text-xs font-medium text-clinical">Abrir prontuário →</Link>}
              <div><div className="mb-1 text-xs font-semibold uppercase text-primary">Status</div>
                <div className="flex flex-wrap gap-1">{SURG_STATUS.map((s) => <button key={s} disabled={!can(profile, "cirurgia")} onClick={() => { updateSurg(sel.id, () => ({ status: s })); toast.success(`Status: ${s}`); }} className={cn("rounded px-2 py-1 text-xs font-semibold disabled:opacity-40", sel.status === s ? STATUS_CLS[s] : "border")}>{s}</button>)}</div></div>
              {(["signIn", "timeOut", "signOut"] as const).map((phase) => {
                const items = CHECKLIST[phase]; const done = items.filter((i) => sel.checks[`${phase}:${i}`]).length;
                return (
                  <div key={phase} className="rounded-md border p-3">
                    <div className="mb-1 flex justify-between text-xs font-semibold"><span>{phase === "signIn" ? "Sign In – antes da anestesia" : phase === "timeOut" ? "Time Out – antes da incisão" : "Sign Out – antes de sair da sala"}</span><span className={done === items.length ? "text-clinical" : "text-muted-foreground"}>{done}/{items.length}</span></div>
                    {items.map((i) => { const k = `${phase}:${i}`; return <label key={k} className="flex items-center gap-2 py-0.5 text-xs"><input type="checkbox" disabled={!can(profile, "cirurgia")} checked={!!sel.checks[k]} onChange={(e) => updateSurg(sel.id, (s) => ({ checks: { ...s.checks, [k]: e.target.checked } }))} />{i}</label>; })}
                  </div>
                );
              })}
              <div className="rounded-md border p-3">
                <div className="mb-1 text-xs font-semibold">Gasto de sala</div>
                {sel.gastos.map((g, i) => <div key={i} className="flex justify-between text-xs"><span>{g.qty}× {g.item}</span><span className="font-mono">R$ {(g.qty * g.price).toFixed(2)}</span></div>)}
                <GastoForm onAdd={(g) => updateSurg(sel.id, (s) => ({ gastos: [...s.gastos, g] }))} />
                <div className="mt-1 border-t pt-1 text-right text-xs font-semibold">Total: R$ {sel.gastos.reduce((s, g) => s + g.qty * g.price, 0).toFixed(2)}</div>
              </div>
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const MATS = [{ item: "Luva estéril", price: 3.2 }, { item: "Compressa cirúrgica", price: 1.8 }, { item: "Fio Vicryl 0", price: 28 }, { item: "Seringa 10 mL", price: 0.9 }, { item: "Bupivacaína pesada", price: 22 }];
function GastoForm({ onAdd }: { onAdd: (g: { item: string; qty: number; price: number }) => void }) {
  const [m, setM] = useState(0); const [q, setQ] = useState(1);
  return <div className="mt-2 flex gap-1"><select value={m} onChange={(e) => setM(+e.target.value)} className="h-7 flex-1 rounded border bg-background px-1 text-xs">{MATS.map((x, i) => <option key={x.item} value={i}>{x.item}</option>)}</select><input type="number" value={q} min={1} onChange={(e) => setQ(+e.target.value)} className="h-7 w-14 rounded border bg-background px-1 text-xs" /><button onClick={() => onAdd({ ...MATS[m]!, qty: q })} className="rounded bg-clinical px-2 text-xs text-accent-foreground">Lançar</button></div>;
}
