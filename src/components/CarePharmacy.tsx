import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockTable } from "./StockTable";
import { EncounterTimeline } from "./EncounterTimeline";
import { can } from "@/lib/hospital-data";
import { adjustStock, createStockMedication, dispenseKit, recordMedication, useStore, validatePrescription } from "@/lib/hospital-store";
import { findStockMedication, isStockLow } from "@/lib/pharmacy-stock";
import { cn } from "@/lib/utils";

function run(action: () => void) { try { action(); } catch (error) { toast.error(error instanceof Error ? error.message : "Ação não concluída"); } }

export function CarePharmacy({ nursingOnly = false }: { nursingOnly?: boolean }) {
  const [selectedView, setView] = useState("farmacia");
  const view = nursingOnly ? "enfermagem" : selectedView;
  return <div className="space-y-4"><h1 className="text-xl font-semibold">{view === "farmacia" ? "Farmácia hospitalar" : "Posto de enfermagem · Medicação"}</h1>{!nursingOnly && <div className="flex gap-2 border-b pb-3"><Button variant={view === "farmacia" ? "default" : "outline"} onClick={() => setView("farmacia")}>Farmácia</Button><Button variant={view === "enfermagem" ? "default" : "outline"} onClick={() => setView("enfermagem")}>Posto de Enfermagem</Button></div>}{view === "farmacia" ? <Pharmacy /> : <Nursing />}</div>;
}

function Pharmacy() {
  const encounters = useStore((state) => state.encounters);
  const stock = useStore((state) => state.stock);
  const list = encounters.filter((encounter) => encounter.status_fluxo === "AGUARDANDO_FARMACIA");
  const low = stock.filter(isStockLow);
  return <Tabs defaultValue="fila" className="space-y-4">
    <TabsList><TabsTrigger value="fila">Fila de prescrições ({list.length})</TabsTrigger><TabsTrigger value="estoque">Estoque ({stock.length})</TabsTrigger></TabsList>
    {low.length > 0 && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" /><div><span className="font-medium">Estoque baixo:</span> {low.map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(", ")}</div></div>}
    <TabsContent value="fila"><PrescriptionQueue /></TabsContent>
    <TabsContent value="estoque"><StockManager /></TabsContent>
  </Tabs>;
}

function PrescriptionQueue() {
  const encounters = useStore((state) => state.encounters);
  const patients = useStore((state) => state.patients);
  const stock = useStore((state) => state.stock);
  const profile = useStore((state) => state.profile);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const list = encounters.filter((encounter) => encounter.status_fluxo === "AGUARDANDO_FARMACIA");
  return <section><h2 className="font-semibold">Prescrições aguardando dispensação ({list.length})</h2>{!list.length && <p className="py-6 text-muted-foreground">Nenhuma prescrição aguardando farmácia.</p>}{list.map((encounter) => {
    const patient = patients.find((item) => item.id === encounter.patientId);
    if (!patient) return null;
    return <section key={encounter.id} className="space-y-3 border-b py-4"><Button variant="link" asChild><Link to="/pacientes/$id" params={{ id: patient.id }}>{patient.name} · {patient.bed || patient.ward}</Link></Button><div className="text-xs">Peso {patient.weight} kg · Assinatura: {encounter.signedBy}</div><EncounterTimeline patientId={patient.id} />
      {patient.prescriptions.filter((prescription) => prescription.pharmacy).map((prescription) => {
        const medication = findStockMedication(stock, prescription.item);
        const needed = prescription.times?.length ?? 1;
        const insufficient = !medication || medication.quantity < needed;
        return <div key={prescription.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm"><div><b>{prescription.item}</b><div className="text-xs text-muted-foreground">{prescription.posologia} · Horários: {prescription.times?.join(", ")} · {prescription.pharmacy}</div><div className={cn("text-xs", insufficient ? "text-destructive" : "text-muted-foreground")}>{medication ? `Estoque: ${medication.quantity} ${medication.unit} · necessário: ${needed}` : "Medicamento ainda não cadastrado no estoque"}</div></div><Button variant="outline" disabled={!can(profile, "farmacia") || prescription.pharmacy !== "Pendente"} onClick={() => run(() => validatePrescription(encounter.id, prescription.id))}>Validar item</Button></div>;
      })}
      <label className="grid gap-1 text-xs">Intervenção farmacêutica<textarea aria-label={`Intervenção farmacêutica de ${patient.name}`} className="min-h-16 rounded-md border bg-background p-2" value={notes[encounter.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [encounter.id]: event.target.value }))} /></label>
      <Button disabled={!can(profile, "farmacia")} onClick={() => run(() => { dispenseKit(encounter.id, notes[encounter.id] ?? ""); toast.success("Kit dispensado para enfermagem"); })}>Dispensar Kit para Enfermagem</Button>
    </section>;
  })}</section>;
}

const EMPTY_MEDICATION = { name: "", presentation: "", unit: "un", quantity: "0", minimum: "0" };
function StockManager() {
  const stock = useStore((state) => state.stock);
  const profile = useStore((state) => state.profile);
  const allowed = can(profile, "farmacia");
  const [form, setForm] = useState(EMPTY_MEDICATION);
  return <div className="space-y-4">
    <StockTable items={stock} allowed={allowed} onAdjust={adjustStock} label="Medicamento" />
    <form className="rounded-xl border bg-card p-4" onSubmit={(event) => { event.preventDefault(); run(() => { createStockMedication({ name: form.name, presentation: form.presentation, unit: form.unit, quantity: Number(form.quantity), minimum: Number(form.minimum) }); setForm(EMPTY_MEDICATION); toast.success("Medicamento cadastrado"); }); }}><h3 className="mb-3 text-sm font-semibold">Cadastrar medicamento</h3><div className="grid gap-2 md:grid-cols-[2fr_1fr_80px_100px_100px_auto]"><Input aria-label="Nome e concentração" placeholder="Nome e concentração" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><Input aria-label="Apresentação" placeholder="Apresentação" value={form.presentation} onChange={(event) => setForm({ ...form, presentation: event.target.value })} /><Input aria-label="Unidade" placeholder="Unid." value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required /><Input aria-label="Estoque inicial" type="number" min="0" placeholder="Estoque" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /><Input aria-label="Estoque mínimo" type="number" min="0" placeholder="Mínimo" value={form.minimum} onChange={(event) => setForm({ ...form, minimum: event.target.value })} required /><Button type="submit" disabled={!allowed}>Cadastrar</Button></div></form>
  </div>;
}

function Nursing() {
  const encounters = useStore((state) => state.encounters);
  const patients = useStore((state) => state.patients);
  const admins = useStore((state) => state.admins);
  const profile = useStore((state) => state.profile);
  const [now, setNow] = useState(Date.now());
  const [reason, setReason] = useState("");
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const list = encounters.filter((encounter) => encounter.signedAt && ["AGUARDANDO_FARMACIA", "AGUARDANDO_MEDICACAO", "EM_OBSERVACAO_REAVALIACAO"].includes(encounter.status_fluxo));
  return <><div className="flex flex-wrap gap-4 text-xs"><span className="bg-muted px-2 py-1">Aguardando Farmácia</span><span className="bg-mt-yellow px-2 py-1">Liberado para Administração</span><span className="bg-clinical-soft px-2 py-1 text-clinical">Checado</span><span className="bg-maternal-soft px-2 py-1 text-maternal">Atrasado</span></div><Input aria-label="Justificativa da medicação" placeholder="Justificativa para não administrar ou adiar" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-3 max-w-xl" />{!list.length && <p className="py-6 text-muted-foreground">Nenhuma medicação ou cuidado pendente.</p>}{list.map((encounter) => {
    const patient = patients.find((item) => item.id === encounter.patientId);
    if (!patient) return null;
    return <section className="space-y-3 border-b py-4" key={encounter.id}><Button variant="link" asChild><Link to="/pacientes/$id" params={{ id: patient.id }}>{patient.name} · {patient.bed || patient.ward}</Link></Button><EncounterTimeline patientId={patient.id} />{patient.prescriptions.filter((prescription) => prescription.times?.length).map((prescription) => <div className="grid gap-3 border-b py-3 md:grid-cols-[240px_1fr]" key={prescription.id}><div className="text-sm"><b>{prescription.item}</b><div className="text-xs text-muted-foreground">{prescription.posologia}</div></div><div className="flex flex-wrap gap-2">{prescription.times?.map((time) => {
      const administration = admins[`${patient.id}|${prescription.id}|${time}`];
      const waiting = !!prescription.pharmacy && prescription.pharmacy !== "Dispensada";
      const due = new Date(encounter.signedAt ?? encounter.openedAt);
      const [hours, minutes] = time.split(":").map(Number); due.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      if (due.getTime() < Date.parse(encounter.signedAt ?? encounter.openedAt) - 60000) due.setDate(due.getDate() + 1);
      const late = !waiting && administration?.status !== "checado" && now > due.getTime();
      return <div key={time} className={cn("min-w-44 rounded-md border p-2 text-xs", waiting ? "bg-muted" : administration?.status === "checado" ? "bg-clinical-soft text-clinical" : late ? "bg-maternal-soft text-maternal" : "bg-mt-yellow")}><b className="font-mono">{time}</b><div>{waiting ? "Aguardando dispensação da farmácia" : administration?.status === "checado" ? "Administrado" : administration?.status === "nao" ? `Não administrado: ${administration.reason}` : administration?.status === "adiado" ? `Adiado: ${administration.reason}` : late ? "Atrasado · Liberado para Administração" : "Liberado para Administração"}</div>{administration && <div>{new Date(administration.at).toLocaleString("pt-BR")} · {administration.by}</div>}{administration?.status !== "checado" && <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" disabled={waiting || !can(profile, "checar")} onClick={() => run(() => { recordMedication(encounter.id, prescription.id, time, "checado"); toast.success("Medicação checada"); })}>Checar Medicação</Button><Button size="sm" variant="outline" disabled={waiting || !can(profile, "checar")} onClick={() => run(() => recordMedication(encounter.id, prescription.id, time, "nao", reason))}>Justificar</Button><Button size="sm" variant="outline" disabled={waiting || !can(profile, "checar")} onClick={() => run(() => recordMedication(encounter.id, prescription.id, time, "adiado", reason))}>Adiar</Button></div>}</div>;
    })}</div></div>)}</section>;
  })}</>;
}
