import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BEDS, WARDS, QUEUE, getPatient, type Bed, type BedStatus } from "@/lib/hospital-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Dashboard Operacional – HMI Gestão" },
    { name: "description", content: "Ocupação, leitos e indicadores do hospital materno-infantil em tempo real." },
    { property: "og:title", content: "Dashboard Operacional – HMI Gestão" },
    { property: "og:description", content: "Ocupação, leitos e indicadores do hospital materno-infantil em tempo real." },
  ] }),
  component: Dashboard,
});

const STATUS: Record<BedStatus, { label: string; cls: string }> = {
  livre: { label: "Livre", cls: "bg-bed-free" },
  ocupado: { label: "Ocupado", cls: "bg-bed-occupied" },
  higienizacao: { label: "Higienização", cls: "bg-bed-cleaning" },
  isolamento: { label: "Isolamento", cls: "bg-bed-isolation" },
  alta: { label: "Alta prev.", cls: "bg-bed-discharge" },
};

function Dashboard() {
  const [sel, setSel] = useState<Bed | null>(null);
  const occupied = BEDS.filter((b) => b.status !== "livre" && b.status !== "higienizacao").length;
  const obsFree = BEDS.filter((b) => ["PSO", "CO"].includes(b.ward) && b.status === "livre").length;
  const pedFree = BEDS.filter((b) => ["PSP", "UTIN"].includes(b.ward) && b.status === "livre").length + BEDS.filter((b) => b.id.startsWith("PED") && b.status === "livre").length;
  const kpis = [
    { label: "Taxa de ocupação", value: `${Math.round((occupied / BEDS.length) * 100)}%`, sub: `${occupied}/${BEDS.length} leitos` },
    { label: "Leitos livres", value: `${obsFree} | ${pedFree}`, sub: "Obstetrícia | Pediatria/Neo" },
    { label: "Em triagem", value: QUEUE.length, sub: `${QUEUE.filter((q) => !q.risk).length} aguardando classificação` },
    { label: "Partos hoje", value: 7, sub: "4 vaginais · 3 cesáreas" },
    { label: "Alta prevista", value: BEDS.filter((b) => b.status === "alta").length, sub: "até 18h" },
  ];
  const p = sel?.patientId ? getPatient(sel.patientId) : undefined;
  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold">Dashboard operacional</h1><p className="text-sm text-muted-foreground">Sábado, 14 de novembro de 2026 · Plantão diurno</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-primary">{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Mapa de leitos</h2>
          <div className="flex flex-wrap gap-3 text-xs">{Object.values(STATUS).map((s) => <span key={s.label} className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-sm", s.cls)} />{s.label}</span>)}</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          {WARDS.map((w) => (
            <div key={w.id} className="rounded-md bg-muted p-3">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{w.name}</div>
              <div className="grid grid-cols-3 gap-2">
                {BEDS.filter((b) => b.ward === w.id).map((b) => (
                  <button key={b.id} onClick={() => setSel(b)} className={cn("rounded-md p-2 text-left text-primary-foreground shadow-sm transition hover:scale-105", STATUS[b.status].cls)}>
                    <div className="font-mono text-[10px] font-semibold">{b.id}</div>
                    <div className="truncate text-[10px] opacity-90">{b.patientId ? getPatient(b.patientId)?.name.split(" ")[0] : STATUS[b.status].label}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>Leito {sel?.id}</SheetTitle></SheetHeader>
          <div className="space-y-3 px-4 text-sm">
            <span className={cn("inline-block rounded px-2 py-0.5 text-xs text-primary-foreground", sel && STATUS[sel.status].cls)}>{sel && STATUS[sel.status].label}</span>
            {p ? (
              <>
                <div className="text-base font-semibold">{p.name}</div>
                <div className="text-muted-foreground">{p.age}{p.ig ? ` · IG ${p.ig}` : ""} · {p.weight} kg · {p.insurance}</div>
                <div><span className="font-medium">Diagnóstico:</span> {p.diagnosis}</div>
                <div><span className="font-medium">Admissão:</span> {p.admission}</div>
                {p.allergies.length > 0 && <div className="rounded bg-maternal-soft p-2 font-medium text-maternal">Alergias: {p.allergies.join(", ")}</div>}
                <div className="rounded border p-2 text-xs"><div className="font-medium">Última evolução</div>{p.evolutions[0]?.text}</div>
                <Link to="/pacientes/$id" params={{ id: p.id }} className="inline-flex rounded-md bg-clinical px-3 py-2 text-sm font-medium text-accent-foreground">Abrir prontuário</Link>
              </>
            ) : <p className="text-muted-foreground">Sem paciente alocado.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
