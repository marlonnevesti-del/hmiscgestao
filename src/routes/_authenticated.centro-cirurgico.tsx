import { EncounterTimeline } from "@/components/EncounterTimeline";
import { ProcedurePrintButton } from "@/components/ProcedurePrint";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ANESTHESIA, CHECKLIST, DESTINATIONS, EMPTY_REPORT, EMPTY_TEAM, PROCEDURES, ROOMS, SURG_STATUS, can, type SurgReport, type SurgStatus, type SurgTeam, type Surgery } from "@/lib/hospital-data";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SurgeryPrint, printSurgery } from "@/components/SurgeryPrint";
import { Printer } from "lucide-react";
import { setState, useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/centro-cirurgico")({
  head: () => ({ meta: [
    { title: "Mapa Cirúrgico e Obstétrico – HMI Gestão" },
    { name: "description", content: "Agenda diária das salas de parto e cirúrgicas com checklist de cirurgia segura da OMS." },
    { property: "og:title", content: "Mapa Cirúrgico e Obstétrico – HMI Gestão" },
    { property: "og:description", content: "Agenda das salas, status em tempo real e checklist OMS." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Centro,
});

const STATUS_CLS: Record<SurgStatus, string> = { Agendado: "bg-secondary text-secondary-foreground border-primary/30", "Em Preparo": "bg-mt-yellow text-foreground", "Em Sala": "bg-maternal text-primary-foreground", RPA: "bg-bed-isolation text-primary-foreground", Finalizado: "bg-bed-free text-primary-foreground" };
const HOURS = Array.from({ length: 12 }, (_, i) => 7 + i);
const updateSurg = (id: string, fn: (s: Surgery) => Partial<Surgery>) => setState((st) => ({ surgeries: st.surgeries.map((s) => (s.id === id ? { ...s, ...fn(s) } : s)) }));

function Centro() {
  const surgeries = useStore((s) => s.surgeries);
  const profile = useStore((s) => s.profile);
  const encounters = useStore((s) => s.encounters);
  const [selId, setSelId] = useState<string | null>(null);
  const sel = surgeries.find((s) => s.id === selId);
  const patients = useStore((s) => s.patients);
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  const daySurg = surgeries.filter((s) => (s.date ?? today) === day);
  const canEdit = can(profile, "cirurgia");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-semibold">Centro cirúrgico e obstétrico</h1><p className="text-sm text-muted-foreground">Mapa do dia · {daySurg.length} procedimentos</p><Input type="date" aria-label="Dia do mapa" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 h-8 w-40" /></div>
        <div className="flex flex-wrap gap-1">{SURG_STATUS.map((s) => <span key={s} className={cn("rounded px-2 py-1 text-[10px] font-semibold", STATUS_CLS[s])}>{s} ({daySurg.filter((x) => x.status === s).length})</span>)}</div>
      </div>
      <section className="space-y-2">{surgeries.filter((s) => encounters.some((e) => e.patientId === s.patientId && e.status_fluxo === "ENCAMINHADO_CO")).map((s) => <div key={s.id} className="border-y py-3"><Button variant="link" onClick={() => setSelId(s.id)}>Urgência Obstétrica · {s.patient}</Button>{s.patientId && <EncounterTimeline patientId={s.patientId} />}</div>)}</section>
      {canEdit && <ScheduleForm day={day} patients={patients} />}
      <div className="overflow-x-auto rounded-lg border bg-card p-4">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[140px_1fr] text-[10px] text-muted-foreground"><div />
            <div className="grid" style={{ gridTemplateColumns: `repeat(${HOURS.length}, 1fr)` }}>{HOURS.map((h) => <div key={h} className="border-l pl-1">{h}h</div>)}</div></div>
          {ROOMS.map((r) => (
            <div key={r} className="grid grid-cols-[140px_1fr] border-t py-2">
              <div className="text-xs font-semibold">{r}</div>
              <div className="relative h-14">
                {daySurg.filter((s) => s.room === r).map((s) => (
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
              {sel.patientId && <EncounterTimeline patientId={sel.patientId} />}
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
              <TeamForm key={`t-${sel.id}`} s={sel} disabled={!canEdit} />
              <ReportForm key={`r-${sel.id}`} s={sel} disabled={!canEdit} />
              <ProcedurePrintButton patientId={sel.patientId} sector="Centro cirúrgico / obstétrico" procedure={sel.type} />
              <Button className="w-full" onClick={printSurgery}><Printer className="mr-1 h-4 w-4" />Imprimir descrição e checklist</Button>
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
      <SurgeryPrint s={sel} p={patients.find((p) => p.id === sel?.patientId)} />
    </div>
  );
}

const MATS = [{ item: "Luva estéril", price: 3.2 }, { item: "Compressa cirúrgica", price: 1.8 }, { item: "Fio Vicryl 0", price: 28 }, { item: "Seringa 10 mL", price: 0.9 }, { item: "Bupivacaína pesada", price: 22 }];
function GastoForm({ onAdd }: { onAdd: (g: { item: string; qty: number; price: number }) => void }) {
  const [m, setM] = useState(0); const [q, setQ] = useState(1);
  return <div className="mt-2 flex gap-1"><select value={m} onChange={(e) => setM(+e.target.value)} className="h-7 flex-1 rounded border bg-background px-1 text-xs">{MATS.map((x, i) => <option key={x.item} value={i}>{x.item}</option>)}</select><input type="number" value={q} min={1} onChange={(e) => setQ(+e.target.value)} className="h-7 w-14 rounded border bg-background px-1 text-xs" /><button onClick={() => onAdd({ ...MATS[m]!, qty: q })} className="rounded bg-clinical px-2 text-xs text-accent-foreground">Lançar</button></div>;
}

const lbl = "text-[11px] font-medium text-muted-foreground";
function ScheduleForm({ day, patients }: { day: string; patients: { id: string; name: string }[] }) {
  const [f, setF] = useState({ patientId: "", patient: "", type: PROCEDURES[0]!, room: ROOMS[0]!, date: day, start: "08:00", duration: 1, urgency: "Eletiva" as "Eletiva" | "Urgência", tuss: "", ...EMPTY_TEAM });
  const set = (k: string, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  const submit = () => {
    const name = f.patientId ? patients.find((p) => p.id === f.patientId)?.name ?? "" : f.patient.trim();
    if (!name) { toast.error("Informe o paciente."); return; }
    if (!f.surgeon.trim()) { toast.error("Informe o cirurgião principal."); return; }
    const [h, m] = f.start.split(":").map(Number);
    const team: SurgTeam = { surgeon: f.surgeon, surgeonCrm: f.surgeonCrm, assistant: f.assistant, anesthetist: f.anesthetist, anesthetistCrm: f.anesthetistCrm, pediatrician: f.pediatrician, scrub: f.scrub, circulating: f.circulating };
    setState((st) => ({ surgeries: [...st.surgeries, { id: crypto.randomUUID(), patientId: f.patientId || undefined, patient: name, room: f.room, start: (h ?? 8) + (m ?? 0) / 60, duration: Number(f.duration) || 1, type: f.type, tuss: f.tuss, surgeon: f.surgeon, status: "Agendado", checks: {}, gastos: [], date: f.date, urgency: f.urgency, team }] }));
    toast.success("Procedimento agendado.");
    setF((x) => ({ ...x, patientId: "", patient: "" }));
  };
  return (
    <details className="rounded-lg border bg-card p-3">
      <summary className="cursor-pointer text-sm font-semibold">+ Agendar cirurgia / parto</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <label className="sm:col-span-2"><span className={lbl}>Paciente cadastrado</span><select value={f.patientId} onChange={(e) => set("patientId", e.target.value)} className="h-9 w-full rounded border bg-background px-2 text-sm"><option value="">— digitar nome —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {!f.patientId && <label className="sm:col-span-2"><span className={lbl}>Nome do paciente</span><Input value={f.patient} onChange={(e) => set("patient", e.target.value)} /></label>}
        <label><span className={lbl}>Procedimento</span><select value={f.type} onChange={(e) => set("type", e.target.value)} className="h-9 w-full rounded border bg-background px-2 text-sm">{PROCEDURES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span className={lbl}>Código SIGTAP/TUSS</span><Input value={f.tuss} onChange={(e) => set("tuss", e.target.value)} /></label>
        <label><span className={lbl}>Sala</span><select value={f.room} onChange={(e) => set("room", e.target.value)} className="h-9 w-full rounded border bg-background px-2 text-sm">{ROOMS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span className={lbl}>Caráter</span><select value={f.urgency} onChange={(e) => set("urgency", e.target.value)} className="h-9 w-full rounded border bg-background px-2 text-sm"><option>Eletiva</option><option>Urgência</option></select></label>
        <label><span className={lbl}>Data</span><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
        <label><span className={lbl}>Início</span><Input type="time" value={f.start} onChange={(e) => set("start", e.target.value)} /></label>
        <label><span className={lbl}>Duração (h)</span><Input type="number" min={0.5} step={0.5} value={f.duration} onChange={(e) => set("duration", +e.target.value)} /></label>
        <div />
        {([["surgeon", "Cirurgião / Obstetra"], ["surgeonCrm", "CRM cirurgião"], ["assistant", "Auxiliar"], ["anesthetist", "Anestesiologista"], ["anesthetistCrm", "CRM anestesista"], ["pediatrician", "Pediatra / Neonatologista"], ["scrub", "Instrumentador(a)"], ["circulating", "Circulante"]] as const).map(([k, l]) => <label key={k}><span className={lbl}>{l}</span><Input value={f[k]} onChange={(e) => set(k, e.target.value)} /></label>)}
      </div>
      <Button className="mt-3" onClick={submit}>Agendar</Button>
    </details>
  );
}

function TeamForm({ s, disabled }: { s: Surgery; disabled: boolean }) {
  const [t, setT] = useState<SurgTeam>({ ...EMPTY_TEAM, surgeon: s.surgeon, ...s.team });
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 text-xs font-semibold">Equipe cirúrgica</div>
      <div className="grid grid-cols-2 gap-2">
        {([["surgeon", "Cirurgião"], ["surgeonCrm", "CRM"], ["assistant", "Auxiliar"], ["pediatrician", "Pediatra/Neo"], ["anesthetist", "Anestesista"], ["anesthetistCrm", "CRM anestesista"], ["scrub", "Instrumentador(a)"], ["circulating", "Circulante"]] as const).map(([k, l]) => <label key={k}><span className={lbl}>{l}</span><Input disabled={disabled} value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} className="h-8" /></label>)}
      </div>
      <Button size="sm" variant="outline" className="mt-2" disabled={disabled} onClick={() => { updateSurg(s.id, () => ({ team: t, surgeon: t.surgeon })); toast.success("Equipe salva."); }}>Salvar equipe</Button>
    </div>
  );
}

function ReportForm({ s, disabled }: { s: Surgery; disabled: boolean }) {
  const name = useStore((st) => st.employeeName);
  const [r, setR] = useState<SurgReport>({ ...EMPTY_REPORT, ...s.report });
  const set = (k: keyof SurgReport, v: string) => setR({ ...r, [k]: v });
  const now = () => new Date().toTimeString().slice(0, 5);
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="text-xs font-semibold">Descrição cirúrgica e anestésica</div>
      <div className="grid grid-cols-5 gap-1">
        {([["roomIn", "Entrada"], ["induction", "Indução"], ["incision", "Incisão"], ["end", "Término"], ["roomOut", "Saída"]] as const).map(([k, l]) => <label key={k}><span className={lbl}>{l}</span><div className="flex gap-0.5"><Input disabled={disabled} type="time" value={r[k]} onChange={(e) => set(k, e.target.value)} className="h-8 px-1 text-xs" /></div><button type="button" disabled={disabled} onClick={() => set(k, now())} className="text-[10px] text-clinical">agora</button></label>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label><span className={lbl}>Anestesia</span><select disabled={disabled} value={r.anesthesia} onChange={(e) => set("anesthesia", e.target.value)} className="h-8 w-full rounded border bg-background px-1 text-xs"><option value="">—</option>{ANESTHESIA.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span className={lbl}>Encaminhamento</span><select disabled={disabled} value={r.destination} onChange={(e) => set("destination", e.target.value)} className="h-8 w-full rounded border bg-background px-1 text-xs">{DESTINATIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span className={lbl}>Diagnóstico pré-op (CID)</span><Input disabled={disabled} value={r.preDx} onChange={(e) => set("preDx", e.target.value)} className="h-8" /></label>
        <label><span className={lbl}>Diagnóstico pós-op (CID)</span><Input disabled={disabled} value={r.postDx} onChange={(e) => set("postDx", e.target.value)} className="h-8" /></label>
        <label><span className={lbl}>Perda sanguínea</span><Input disabled={disabled} value={r.bloodLoss} onChange={(e) => set("bloodLoss", e.target.value)} className="h-8" placeholder="ex: 400 mL" /></label>
        <label><span className={lbl}>Drenos / curativos</span><Input disabled={disabled} value={r.drains} onChange={(e) => set("drains", e.target.value)} className="h-8" /></label>
        <label><span className={lbl}>Peça p/ anatomopatológico</span><Input disabled={disabled} value={r.specimen} onChange={(e) => set("specimen", e.target.value)} className="h-8" /></label>
        <label><span className={lbl}>Intercorrências</span><Input disabled={disabled} value={r.complications} onChange={(e) => set("complications", e.target.value)} className="h-8" /></label>
      </div>
      <label className="block"><span className={lbl}>Ficha anestésica (drogas, analgesia pós-op)</span><Textarea disabled={disabled} value={r.anesthesiaNotes} onChange={(e) => set("anesthesiaNotes", e.target.value)} rows={2} /></label>
      <label className="block"><span className={lbl}>Técnica cirúrgica</span><Textarea disabled={disabled} value={r.technique} onChange={(e) => set("technique", e.target.value)} rows={4} /></label>
      <label className="block"><span className={lbl}>Achados</span><Textarea disabled={disabled} value={r.findings} onChange={(e) => set("findings", e.target.value)} rows={2} /></label>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => { updateSurg(s.id, () => ({ report: { ...r, by: name, at: new Date().toISOString() } })); toast.success("Descrição salva."); }}>Salvar descrição</Button>
    </div>
  );
}
