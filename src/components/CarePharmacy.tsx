import { useEffect, useState } from "react";
import { ProcedurePrintButton } from "./ProcedurePrint";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockTable } from "./StockTable";
import { EncounterTimeline } from "./EncounterTimeline";
import { can, WARDS } from "@/lib/hospital-data";
import { findByBarcode } from "@/lib/barcode";
import { BarcodeScan } from "./BarcodeScan";
import { LabelPrint, printLabels, type Label } from "./LabelPrint";
import { adjustPrescription, adjustStock, deleteStockItem, createStockMedication, dispenseKit, recordMedication, useStore, validatePrescription } from "@/lib/hospital-store";
import { findStockMedication, fmtExpiry, isStockLow, lotsByExpiry } from "@/lib/pharmacy-stock";
import { cn } from "@/lib/utils";
import { BreakageForm, MovementLog, NursingRequestForm, RequestInbox, ReturnForm, TransferForm, EntryForm, LoanPanel } from "./SupplyPanels";
import { LabelStudio } from "./LabelStudio";
import { ControlledCabinet, ConsumptionReport, ExpiryPanel } from "./ControlledCabinet";
import { RequisitionPrint, printRequisition } from "./RequisitionPrint";

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
  const pending = useStore((s) => s.requests.filter((r) => r.target === "farmacia" && r.status === "Pendente").length);
  return <Tabs defaultValue="fila" className="space-y-4">
    <TabsList><TabsTrigger value="fila">Fila de prescrições ({list.length})</TabsTrigger><TabsTrigger value="estoque">Estoque ({stock.length})</TabsTrigger><TabsTrigger value="controlados">Armário de controlados</TabsTrigger><TabsTrigger value="validades">Validades / Estorno</TabsTrigger><TabsTrigger value="consumo">Consumo mensal</TabsTrigger><TabsTrigger value="pedidos">Pedidos da enfermagem ({pending})</TabsTrigger><TabsTrigger value="entrada">Entrada NF</TabsTrigger><TabsTrigger value="emprestimo">Empréstimos</TabsTrigger><TabsTrigger value="transferencia">Transferência</TabsTrigger><TabsTrigger value="devolucao">Devolução</TabsTrigger><TabsTrigger value="quebra">Quebra/Extravio</TabsTrigger><TabsTrigger value="dispensados">Kits dispensados</TabsTrigger><TabsTrigger value="etiquetas">Etiquetas</TabsTrigger></TabsList>
    {low.length > 0 && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" /><div><span className="font-medium">Estoque baixo:</span> {low.map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(", ")}</div></div>}
    <TabsContent value="fila"><PrescriptionQueue /></TabsContent>
    <TabsContent value="estoque"><StockManager /></TabsContent>
    <TabsContent value="controlados"><ControlledCabinet /></TabsContent><TabsContent value="validades"><ExpiryPanel /></TabsContent><TabsContent value="consumo"><ConsumptionReport /></TabsContent>
    <TabsContent value="pedidos"><RequestInbox target="farmacia" /></TabsContent>
    <TabsContent value="entrada" className="space-y-3"><EntryForm depot="farmacia" /><MovementLog kinds={["entrada"]} depot="farmacia" /></TabsContent><TabsContent value="emprestimo"><LoanPanel depot="farmacia" /></TabsContent><TabsContent value="transferencia" className="space-y-3"><TransferForm from="farmacia" /><MovementLog kinds={["transferencia"]} depot="farmacia" /></TabsContent>
    <TabsContent value="devolucao" className="space-y-3"><ReturnForm depot="farmacia" /><MovementLog kinds={["devolucao"]} depot="farmacia" /></TabsContent>
    <TabsContent value="quebra" className="space-y-3"><BreakageForm /><MovementLog kinds={["quebra"]} /></TabsContent>
    <TabsContent value="dispensados"><DispensedKits /></TabsContent>
    <TabsContent value="etiquetas"><LabelStudio /></TabsContent>
  </Tabs>;
}

function PrescriptionQueue() {
  const encounters = useStore((state) => state.encounters);
  const patients = useStore((state) => state.patients);
  const stock = useStore((state) => state.stock);
  const profile = useStore((state) => state.profile);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [lots, setLots] = useState<Record<string, string>>({});
  const [printId, setPrintId] = useState("");
  const [doseLabel, setDoseLabel] = useState<Label | null>(null);
  const printEnc = encounters.find((x) => x.id === printId);
  const list = encounters.filter((encounter) => encounter.status_fluxo === "AGUARDANDO_FARMACIA");
  return <section><h2 className="font-semibold">Prescrições aguardando dispensação ({list.length})</h2>{!list.length && <p className="py-6 text-muted-foreground">Nenhuma prescrição aguardando farmácia.</p>}{list.map((encounter) => {
    const patient = patients.find((item) => item.id === encounter.patientId);
    if (!patient) return null;
    return <section key={encounter.id} className="space-y-3 border-b py-4"><Button variant="link" asChild><Link to="/pacientes/$id" params={{ id: patient.id }}>{patient.name} · {patient.bed || patient.ward}</Link></Button><div className="text-xs">Peso {patient.weight} kg · Assinatura: {encounter.signedBy}</div><EncounterTimeline patientId={patient.id} />
      {patient.prescriptions.filter((prescription) => prescription.pharmacy).map((prescription) => {
        const medication = findStockMedication(stock, prescription.item);
        const needed = prescription.times?.length ?? 1;
        const insufficient = !medication || medication.quantity < needed;
        return <div key={prescription.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm"><div><b>{prescription.item}</b><div className="text-xs text-muted-foreground">{prescription.posologia} · Horários: {prescription.times?.join(", ")} · {prescription.pharmacy}</div><div className={cn("text-xs", insufficient ? "text-destructive" : "text-muted-foreground")}>{medication ? `Estoque: ${medication.quantity} ${medication.unit} · necessário: ${needed}` : "Medicamento ainda não cadastrado no estoque"}</div></div><div className="flex flex-wrap items-center gap-2"><BarcodeScan className="w-56" placeholder="Bipar frasco" onScan={(code) => { const hit = findByBarcode(stock, code); if (!hit || hit.item.id !== medication?.id) { toast.error(hit ? `Produto errado: ${hit.item.name}` : "Código não cadastrado no estoque"); return; } if (hit.lot) setLots((c) => ({ ...c, [prescription.id]: hit.lot!.lot })); toast.success(hit.lot ? `Conferido · lote ${hit.lot.lot}` : "Produto conferido — informe o lote"); }} />{lotsByExpiry(medication).length ? <select aria-label={`Lote de ${prescription.item}`} className="h-9 w-64 rounded-md border bg-background px-2 text-sm" value={lots[prescription.id] ?? ""} onChange={(event) => setLots((c) => ({ ...c, [prescription.id]: event.target.value }))}><option value="">Lote * (vence primeiro no topo)</option>{lotsByExpiry(medication).map((l) => <option key={l.lot + l.expiry} value={l.lot}>{`${l.lot} · val. ${fmtExpiry(l.expiry)} · ${l.quantity}`}</option>)}</select> : <Input aria-label={`Lote de ${prescription.item}`} placeholder="Lote *" className="w-32" value={lots[prescription.id] ?? ""} onChange={(event) => setLots((c) => ({ ...c, [prescription.id]: event.target.value }))} />}<Button variant="ghost" disabled={!can(profile, "farmacia") || prescription.pharmacy !== "Pendente"} onClick={() => { const item = window.prompt("Ajustar dose / apresentação", prescription.item); if (item == null) return; const pos = window.prompt("Via / posologia", prescription.posologia) ?? prescription.posologia; run(() => adjustPrescription(encounter.id, prescription.id, item, pos)); }}>Ajustar dose</Button><Button variant="ghost" onClick={() => { const quantity = window.prompt("Quantidade (ex.: 1,1 ML)", ""); if (!quantity) return; const time = window.prompt("Horário", `${new Date().toLocaleDateString("pt-BR")} ${prescription.times?.[0] ?? ""}`) ?? ""; const diluent = window.prompt("Diluente (vazio se não houver)", "") ?? ""; setDoseLabel({ kind: "dose", patient: patient.name, bed: patient.bed, sector: WARDS.find((w) => w.id === patient.ward)?.name ?? String(patient.ward), drug: medication?.name ?? prescription.item, quantity, route: prescription.posologia.match(/\b(VO|EV|IM|SC|SNG|IV)\b/i)?.[0]?.toUpperCase() ?? "VO", time, validity: "24H", diluent, copies: prescription.times?.length ?? 1 }); printLabels(); }}>Etiqueta dose</Button><Button variant="outline" disabled={!can(profile, "farmacia") || prescription.pharmacy !== "Pendente"} onClick={() => run(() => validatePrescription(encounter.id, prescription.id))}>Validar item</Button></div></div>;
      })}
      <label className="grid gap-1 text-xs">Intervenção farmacêutica<textarea aria-label={`Intervenção farmacêutica de ${patient.name}`} className="min-h-16 rounded-md border bg-background p-2" value={notes[encounter.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [encounter.id]: event.target.value }))} /></label>
      <Button disabled={!can(profile, "farmacia")} onClick={() => run(() => { dispenseKit(encounter.id, notes[encounter.id] ?? "", lots); toast.success("Kit dispensado para enfermagem"); setPrintId(encounter.id); printRequisition(); })}>Dispensar Kit para Enfermagem</Button>
    </section>;
  })}<LabelPrint label={doseLabel} /><RequisitionPrint e={printEnc} p={patients.find((x) => x.id === printEnc?.patientId)} stock={stock} /></section>;
}

function DispensedKits() {
  const encounters = useStore((s) => s.encounters); const patients = useStore((s) => s.patients); const stock = useStore((s) => s.stock);
  const [printId, setPrintId] = useState("");
  const list = encounters.filter((e) => e.dispensedAt).slice().reverse();
  const enc = encounters.find((x) => x.id === printId);
  return <section>{!list.length && <p className="py-6 text-muted-foreground">Nenhum kit dispensado.</p>}{list.map((e) => { const p = patients.find((x) => x.id === e.patientId); return <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"><span><b>{p?.name}</b> · Req. {e.requisition} · {new Date(e.dispensedAt!).toLocaleString("pt-BR")} · Médico: {e.signedBy}</span><Button size="sm" variant="outline" onClick={() => { setPrintId(e.id); printRequisition(); }}>Imprimir requisição</Button></div>; })}<RequisitionPrint e={enc} p={patients.find((x) => x.id === enc?.patientId)} stock={stock} /></section>;
}

const EMPTY_MEDICATION = { name: "", presentation: "", unit: "un", quantity: "0", minimum: "0" };
function StockManager() {
  const stock = useStore((state) => state.stock);
  const profile = useStore((state) => state.profile);
  const allowed = can(profile, "farmacia");
  const [form, setForm] = useState(EMPTY_MEDICATION);
  return <div className="space-y-4">
    <StockTable items={stock} allowed={allowed} onAdjust={adjustStock} onDelete={profile === "Administrador" ? (id) => deleteStockItem("stock", id) : undefined} label="Medicamento" />
    <form className="rounded-xl border bg-card p-4" onSubmit={(event) => { event.preventDefault(); run(() => { createStockMedication({ name: form.name, presentation: form.presentation, unit: form.unit, quantity: Number(form.quantity), minimum: Number(form.minimum) }); setForm(EMPTY_MEDICATION); toast.success("Medicamento cadastrado"); }); }}><h3 className="mb-3 text-sm font-semibold">Cadastrar medicamento</h3><div className="grid gap-2 md:grid-cols-[2fr_1fr_80px_100px_100px_auto]"><Input aria-label="Nome e concentração" placeholder="Nome e concentração" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><Input aria-label="Apresentação" placeholder="Apresentação" value={form.presentation} onChange={(event) => setForm({ ...form, presentation: event.target.value })} /><Input aria-label="Unidade" placeholder="Unid." value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required /><Input aria-label="Estoque inicial" type="number" min="0" placeholder="Estoque" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /><Input aria-label="Estoque mínimo" type="number" min="0" placeholder="Mínimo" value={form.minimum} onChange={(event) => setForm({ ...form, minimum: event.target.value })} required /><Button type="submit" disabled={!allowed}>Cadastrar</Button></div></form>
  </div>;
}

function Nursing() {
  const encounters = useStore((state) => state.encounters);
  const patients = useStore((state) => state.patients);
  const admins = useStore((state) => state.admins);
  const profile = useStore((state) => state.profile);
  const stock = useStore((state) => state.stock);
  const [now, setNow] = useState(Date.now());
  const [reason, setReason] = useState("");
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const list = encounters.filter((encounter) => encounter.signedAt && ["AGUARDANDO_FARMACIA", "AGUARDANDO_MEDICACAO", "EM_OBSERVACAO_REAVALIACAO"].includes(encounter.status_fluxo));
  return <><details className="mb-4 rounded-xl border bg-card p-3"><summary className="cursor-pointer text-sm font-semibold">Pedido de produtos para Farmácia / Almoxarifado</summary><div className="mt-3"><NursingRequestForm /></div></details><div className="flex flex-wrap gap-4 text-xs"><span className="bg-muted px-2 py-1">Aguardando Farmácia</span><span className="bg-mt-yellow px-2 py-1">Liberado para Administração</span><span className="bg-clinical-soft px-2 py-1 text-clinical">Checado</span><span className="bg-maternal-soft px-2 py-1 text-maternal">Atrasado</span></div><Input aria-label="Justificativa da medicação" placeholder="Justificativa para não administrar ou adiar" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-3 max-w-xl" />{!list.length && <p className="py-6 text-muted-foreground">Nenhuma medicação ou cuidado pendente.</p>}{list.map((encounter) => {
    const patient = patients.find((item) => item.id === encounter.patientId);
    if (!patient) return null;
    return <section className="space-y-3 border-b py-4" key={encounter.id}><Button variant="link" asChild><Link to="/pacientes/$id" params={{ id: patient.id }}>{patient.name} · {patient.bed || patient.ward}</Link></Button><ProcedurePrintButton patientId={patient.id} sector="Posto de enfermagem" /><EncounterTimeline patientId={patient.id} />{patient.prescriptions.filter((prescription) => prescription.times?.length).map((prescription) => <div className="grid gap-3 border-b py-3 md:grid-cols-[240px_1fr]" key={prescription.id}><div className="text-sm"><b>{prescription.item}</b><div className="text-xs text-muted-foreground">{prescription.posologia}</div>{prescription.lot && <div className="text-xs">Lote: <b className="font-mono">{prescription.lot}</b></div>}<BarcodeScan className="mt-2" placeholder="Bipar antes de administrar" onScan={(code) => { const hit = findByBarcode(stock, code); const expected = findStockMedication(stock, prescription.item); if (!hit || hit.item.id !== expected?.id) { toast.error(hit ? `ATENÇÃO: medicamento errado (${hit.item.name})` : "Código não cadastrado"); return; } if (prescription.lot && hit.lot && hit.lot.lot !== prescription.lot) { toast.error(`Lote diferente do dispensado (${hit.lot.lot})`); return; } toast.success("Medicamento correto conferido com sucesso"); }} /></div><div className="flex flex-wrap gap-2">{prescription.times?.map((time) => {
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
