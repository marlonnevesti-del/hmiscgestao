import { EncounterTimeline } from "@/components/EncounterTimeline";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PatientIcon, TYPE_LABEL } from "@/components/PatientIcon";
import { BASE_BEDS, WARDS, bedStatusFor, type BedStatus, type Ward } from "@/lib/hospital-data";
import { useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Dashboard Operacional – HMI Gestão" },
    { name: "description", content: "Ocupação, mapa de leitos e indicadores do hospital materno-infantil em tempo real." },
    { property: "og:title", content: "Dashboard Operacional – HMI Gestão" },
    { property: "og:description", content: "Ocupação, mapa de leitos e indicadores do hospital materno-infantil em tempo real." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
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
interface BedView { id: string; ward: Ward; status: BedStatus; patientId?: string | undefined }

function Dashboard() {
  const patients = useStore((s) => s.patients);
  const queue = useStore((s) => s.queue);
  const surgeries = useStore((s) => s.surgeries);
  const [selId, setSelId] = useState<string | null>(null);
  const beds = useMemo<BedView[]>(() => {
    const list: BedView[] = BASE_BEDS.map((b) => ({ ...b }));
    patients.filter((p) => p.bed).forEach((p) => {
      const b = list.find((x) => x.id === p.bed);
      if (b) { b.status = bedStatusFor(p); b.patientId = p.id; }
      else list.push({ id: p.bed, ward: p.ward, status: bedStatusFor(p), patientId: p.id });
    });
    return list;
  }, [patients]);
  const occupied = beds.filter((b) => ["ocupado", "isolamento", "alta"].includes(b.status)).length;
  const free = (ws: Ward[]) => beds.filter((b) => ws.includes(b.ward) && b.status === "livre").length;
  const births = patients.filter((p) => p.id.startsWith("rn-")).length;
  const kpis = [
    { label: "Taxa de ocupação", value: `${Math.round((occupied / beds.length) * 100)}%`, sub: `${occupied}/${beds.length} leitos` },
    { label: "Leitos livres", value: `${free(["PSO", "CO", "AC"])} | ${free(["PSP", "UTIN", "ENFP"])}`, sub: "Obstetrícia | Pediatria/UTI Neo" },
    { label: "Aguardando triagem", value: queue.filter((q) => !q.risk).length, sub: `${queue.length} na fila de atendimento` },
    { label: "Partos 24h", value: births, sub: `${surgeries.filter((s) => s.status !== "Finalizado").length} procedimentos no mapa` },
    { label: "Altas previstas", value: patients.filter((p) => p.dischargeForecast).length, sub: `${beds.filter((b) => b.status === "alta").length} hoje` },
  ];
  const sel = beds.find((b) => b.id === selId);
  const p = sel?.patientId ? patients.find((x) => x.id === sel.patientId) : undefined;
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
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.values(STATUS).map((s) => <span key={s.label} className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-sm", s.cls)} />{s.label}</span>)}
            <span className="flex items-center gap-2 border-l pl-3 text-muted-foreground">{(["gestante", "puerpera", "neonato", "pediatria"] as const).map((t) => <span key={t} className="flex items-center gap-1"><PatientIcon type={t} />{TYPE_LABEL[t]}</span>)}</span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {WARDS.map((w) => (
            <div key={w.id} className="rounded-md bg-muted p-3">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{w.name}</div>
              <div className="grid grid-cols-2 gap-2">
                {beds.filter((b) => b.ward === w.id).map((b) => {
                  const bp = b.patientId ? patients.find((x) => x.id === b.patientId) : undefined;
                  return (
                    <button key={b.id} onClick={() => setSelId(b.id)} className={cn("rounded-md p-2 text-left text-primary-foreground shadow-sm transition hover:scale-105", STATUS[b.status].cls)}>
                      <div className="flex items-center justify-between font-mono text-[10px] font-semibold">{b.id}{bp && <PatientIcon type={bp.type} />}</div>
                      <div className="truncate text-[10px] opacity-90">{bp ? bp.name.replace("RN de ", "RN ").split(" ").slice(0, 2).join(" ") : STATUS[b.status].label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSelId(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>Leito {sel?.id}</SheetTitle></SheetHeader>
          <div className="space-y-3 px-4 text-sm">
            <span className={cn("inline-block rounded px-2 py-0.5 text-xs text-primary-foreground", sel && STATUS[sel.status].cls)}>{sel && STATUS[sel.status].label}</span>
            {p ? (
              <>
                <EncounterTimeline patientId={p.id} />
                <div className="flex items-center gap-2 text-base font-semibold"><PatientIcon type={p.type} className="h-4 w-4 text-primary" />{p.name}</div>
                <div className="text-muted-foreground">{TYPE_LABEL[p.type]} · {p.age}{p.ig ? ` · IG ${p.ig}` : ""} · {p.weight} kg · {p.insurance}</div>
                <div><span className="font-medium">Diagnóstico:</span> {p.diagnosis}</div>
                <div><span className="font-medium">Admissão:</span> {p.admission}{p.dischargeForecast ? ` · Alta prevista ${p.dischargeForecast}` : ""}</div>
                {p.allergies.length > 0 && <div className="rounded bg-maternal-soft p-2 font-medium text-maternal">Alergias: {p.allergies.join(", ")}</div>}
                {p.vitals.at(-1) && (() => { const v = p.vitals.at(-1)!; return <div className="grid grid-cols-3 gap-1 font-mono text-xs">{[["PA", `${v.pas}/${v.pad}`], ["FC", v.fc], ["SatO2", `${v.sat}%`], ["Tax", v.tax], ["FR", v.fr], ["Dor", v.dor]].map(([l, x]) => <div key={l} className="rounded bg-muted p-1.5"><div className="text-[10px] text-muted-foreground">{l}</div>{x}</div>)}</div>; })()}
                <div className="rounded border p-2 text-xs"><div className="font-medium">Última evolução</div>{p.evolutions[0]?.text}</div>
                <Link to="/pacientes/$id" params={{ id: p.id }} className="inline-flex rounded-md bg-clinical px-3 py-2 text-sm font-medium text-accent-foreground">Abrir Prontuário</Link>
              </>
            ) : <p className="text-muted-foreground">Sem paciente alocado.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
