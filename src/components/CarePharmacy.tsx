import { MedShiftBoard } from "./MedShiftBoard";
import { Fragment, useEffect, useState } from "react";
import { ProcedurePrintButton } from "./ProcedurePrint";
import { Link, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockTable } from "./StockTable";
import { EncounterTimeline } from "./EncounterTimeline";
import { InventoryPanel } from "./InventoryPanel";
import { can, PHARMACY_TABS, WARDS } from "@/lib/hospital-data";
import { findByBarcode } from "@/lib/barcode";
import { BarcodeScan } from "./BarcodeScan";
import { LabelPrint, printLabels, type Label } from "./LabelPrint";
import { advanceCompletedMedication, allBatchDosesDone, deleteStockItem, createStockMedication, dispenseKit, recordMedication, reportShortage, useStore, validatePrescription } from "@/lib/hospital-store";
import { findStockMedication, fmtExpiry, lotsByExpiry } from "@/lib/pharmacy-stock";
import { canDispenseNow, isImmediatePrescription, PHARMACY_START_HOUR, remainingDoses } from "@/lib/pharmacy-schedule";
import { matchesPharmacySector, PHARMACY_SECTORS, pharmacySectorLabel, type PharmacySectorId } from "@/lib/pharmacy-sectors";
import { cn } from "@/lib/utils";
import { BreakageForm, MovementLog, NursingRequestForm, RequestInbox, ReturnForm, TransferForm, EntryForm, LoanPanel } from "./SupplyPanels";
import { LabelStudio } from "./LabelStudio";
import { SurgicalKits } from "./SurgicalKits";
import { MovementMap, RequisitionOut } from "./MovementMap";
import { ConsumptionReport, ExpiryPanel } from "./ControlledCabinet";
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
  const pending = useStore((s) => s.requests.filter((r) => r.target === "farmacia" && r.status === "Pendente").length);
  const aba = useRouterState({ select: (st) => (st.location.search as { aba?: string }).aba });
  const tab = PHARMACY_TABS.find((t) => t.id === aba)?.id ?? "fila";
  return <Tabs value={tab} className="space-y-4">
    <TabsList className="hidden"><TabsTrigger value="fila">Fila de prescrições ({list.length})</TabsTrigger><TabsTrigger value="estoque">Estoque ({stock.length})</TabsTrigger><TabsTrigger value="validades">Validades / Estorno</TabsTrigger><TabsTrigger value="consumo">Consumo mensal</TabsTrigger><TabsTrigger value="pedidos">Pedidos da enfermagem ({pending})</TabsTrigger><TabsTrigger value="entrada">Entrada NF</TabsTrigger><TabsTrigger value="emprestimo">Empréstimos</TabsTrigger><TabsTrigger value="transferencia">Transferência</TabsTrigger><TabsTrigger value="devolucao">Devolução</TabsTrigger><TabsTrigger value="quebra">Quebra/Extravio</TabsTrigger><TabsTrigger value="dispensados">Medicamentos prescritos</TabsTrigger><TabsTrigger value="etiquetas">Etiquetas</TabsTrigger></TabsList>
    <TabsContent value="fila"><PrescriptionQueue /></TabsContent>
    <TabsContent value="estoque"><StockManager /></TabsContent>
    <TabsContent value="validades"><ExpiryPanel /></TabsContent><TabsContent value="consumo"><ConsumptionReport /></TabsContent>
    <TabsContent value="pedidos"><RequestInbox target="farmacia" /></TabsContent>
    <TabsContent value="entrada" className="space-y-3"><EntryForm depot="farmacia" /><MovementLog kinds={["entrada"]} depot="farmacia" /></TabsContent><TabsContent value="emprestimo"><LoanPanel depot="farmacia" /></TabsContent><TabsContent value="transferencia" className="space-y-3"><TransferForm from="farmacia" /><MovementLog kinds={["transferencia"]} depot="farmacia" /></TabsContent>
    <TabsContent value="devolucao" className="space-y-3"><ReturnForm depot="farmacia" /><MovementLog kinds={["devolucao"]} depot="farmacia" /></TabsContent>
    <TabsContent value="quebra" className="space-y-3"><BreakageForm /><MovementLog kinds={["quebra"]} /></TabsContent>
    <TabsContent value="dispensados"><DispensedKits /></TabsContent><TabsContent value="kits"><SurgicalKits /></TabsContent>
    <TabsContent value="etiquetas"><LabelStudio /></TabsContent>
    <TabsContent value="requisicao"><RequisitionOut depot="farmacia" /></TabsContent><TabsContent value="mapa"><MovementMap depot="farmacia" /></TabsContent>
    <TabsContent value="inventario"><InventoryPanel depot="farmacia" /></TabsContent>
  </Tabs>;
}

const DOSE_INTERVALS = [
  { id: "TODOS", label: "TODOS" },
  { id: "16-19", label: "16:00 - 19:59", start: 16, end: 19 },
  { id: "20-23", label: "20:00 - 23:59", start: 20, end: 23 },
  { id: "00-03", label: "00:00 - 03:59", start: 0, end: 3 },
  { id: "04-07", label: "04:00 - 07:59", start: 4, end: 7 },
  { id: "08-11", label: "08:00 - 11:59", start: 8, end: 11 },
  { id: "12-15", label: "12:00 - 15:59", start: 12, end: 15 },
] as const;

function matchesDoseInterval(time: string, intervalId: string): boolean {
  if (intervalId === "TODOS" || time === "Agora") return true;
  const h = Number(time.split(":")[0]);
  if (Number.isNaN(h)) return true;
  const found = DOSE_INTERVALS.find((x) => x.id === intervalId);
  if (!found || !("start" in found)) return true;
  return h >= found.start && h <= found.end;
}

function localIsoDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtRxDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function PrescriptionQueue() {
  const encounters = useStore((state) => state.encounters);
  const patients = useStore((state) => state.patients);
  const stock = useStore((state) => state.stock);
  const profile = useStore((state) => state.profile);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [lots, setLots] = useState<Record<string, string>>({});
  const [specialReasons, setSpecialReasons] = useState<Record<string, string>>({});
  const [sector, setSector] = useState<PharmacySectorId>("todos");
  const [interval, setInterval] = useState<string>("TODOS");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<{ id: string; time?: string } | null>(null);
  const [doseLabel, setDoseLabel] = useState<Label | null>(null);
  const printEnc = encounters.find((x) => x.id === printTarget?.id);
  const activePharmacyStatuses = new Set(["AGUARDANDO_FARMACIA", "AGUARDANDO_MEDICACAO", "EM_OBSERVACAO_REAVALIACAO", "ENCAMINHADO_INTERNACAO"]);
  const allPending = encounters
    .map((encounter) => ({ encounter, patient: patients.find((item) => item.id === encounter.patientId) }))
    .filter((row): row is { encounter: typeof encounters[number]; patient: NonNullable<typeof patients[number]> } => {
      if (!row.patient || !activePharmacyStatuses.has(row.encounter.status_fluxo)) return false;
      if (dateFilter && localIsoDate(row.encounter.signedAt ?? row.encounter.openedAt) !== dateFilter) return false;
      if (row.encounter.status_fluxo === "AGUARDANDO_FARMACIA") return true;
      return row.patient.prescriptions.some(
        (rx) => rx.batchId === row.encounter.prescriptionBatchId && rx.pharmacy && (rx.times?.length ? remainingDoses(rx).length > 0 : rx.pharmacy !== "Dispensada"),
      );
    });
  const list = allPending.filter(({ encounter, patient }) => matchesPharmacySector(sector, encounter, patient));
  const doseRows = list.flatMap(({ encounter, patient }) => {
    const batchMeds = patient.prescriptions.filter(
      (prescription) =>
        prescription.pharmacy &&
        prescription.batchId === encounter.prescriptionBatchId &&
        (prescription.times?.length ? remainingDoses(prescription).length > 0 : prescription.pharmacy !== "Dispensada"),
    );
    const times = Array.from(new Set(batchMeds.flatMap((rx) => (rx.times?.length ? remainingDoses(rx) : ["Agora"]))));
    const sectorName = pharmacySectorLabel(encounter, patient);
    return times
      .filter((t) => matchesDoseInterval(t, interval))
      .map((time) => ({
        rowKey: `${encounter.id}::${time}`,
        encounter,
        patient,
        time,
        sectorName,
        batchMeds,
        medsAtTime: batchMeds.filter((rx) => (rx.times?.length ? remainingDoses(rx) : ["Agora"]).includes(time)),
      }));
  });
  const nowHour = new Date().getHours();
  const beforeStart = nowHour < PHARMACY_START_HOUR;
  return <section>
    <div className={cn("mb-3 rounded-lg border px-3 py-2 text-xs", beforeStart ? "border-mt-yellow bg-mt-yellow/15 text-foreground" : "border-clinical/40 bg-clinical-soft text-clinical")}>
      {beforeStart
        ? `Horário de referência da rotina: ${PHARMACY_START_HOUR}:00. Dispensação liberada a qualquer horário (justificativa opcional).`
        : `Janela de dispensação aberta (a partir das ${PHARMACY_START_HOUR}:00). Cada horário de dose gera a sua própria requisição com quantidade 1.`}
    </div>
    <div className="mb-4 flex flex-wrap gap-2 border-b pb-3" role="tablist" aria-label="Pastas de setores da farmácia">
      {PHARMACY_SECTORS.map((tab) => {
        const count = allPending.filter(({ encounter, patient }) => matchesPharmacySector(tab.id, encounter, patient)).length;
        const active = sector === tab.id;
        return (
          <Button key={tab.id} size="sm" variant={active ? "default" : "outline"} role="tab" aria-selected={active} onClick={() => setSector(tab.id)}>
            {tab.label} ({count})
          </Button>
        );
      })}
    </div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Prescrições aguardando dispensação ({doseRows.length})</h2>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Data:</span>
          <Input type="date" aria-label="Data da prescrição" className="h-8 w-36 text-xs" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </label>
        {dateFilter && <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setDateFilter("")}>Todas as datas</Button>}
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Intervalo:</span>
          <select aria-label="Intervalo de horário" className="h-8 rounded-md border bg-background px-2 text-xs" value={interval} onChange={(e) => setInterval(e.target.value)}>
            {DOSE_INTERVALS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
        </label>
      </div>
    </div>
    {!doseRows.length && <p className="py-6 text-muted-foreground">Nenhuma prescrição aguardando farmácia nesta pasta.</p>}
    {doseRows.length > 0 && (
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Setor</th>
              <th className="px-3 py-2">Paciente</th>
              <th className="px-3 py-2">Prescrito em</th>
              <th className="px-3 py-2">Horário</th>
            </tr>
          </thead>
          <tbody>
            {doseRows.map((row) => {
              const { rowKey, encounter, patient, time, sectorName, batchMeds, medsAtTime } = row;
              const expanded = expandedKey === rowKey;
    const specialCaseReason = specialReasons[encounter.id] ?? "";
    const gate = canDispenseNow(batchMeds, { specialCaseReason });
    const rxAt = fmtRxDateTime(encounter.signedAt ?? encounter.openedAt);
              return (
                <Fragment key={rowKey}>
                  <tr className={cn("cursor-pointer border-b hover:bg-muted/40", expanded && "bg-muted/30")} onClick={() => setExpandedKey(expanded ? null : rowKey)}>
                    <td className="px-3 py-2 font-medium">{sectorName}</td>
                    <td className="px-3 py-2 font-semibold text-primary underline-offset-2 hover:underline">{patient.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{rxAt}</td>
                    <td className="px-3 py-2 font-mono text-xs">{time}</td>
                  </tr>
                  {expanded && (
                    <tr className="border-b bg-card">
                      <td colSpan={4} className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Peso {patient.weight} kg · Leito {patient.bed || "—"} · Prescrito em: {rxAt} · Liberada por: {encounter.signedBy}</span>
                          <Link to="/pacientes/$id" params={{ id: patient.id }} className="text-primary hover:underline">Abrir prontuário</Link>
                        </div>
                        {medsAtTime.map((prescription) => {
        const medication = findStockMedication(stock, prescription.item);
        const needed = 1;
        const insufficient = !medication || medication.quantity < needed;
        return <div key={prescription.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm"><div><b>{prescription.item}</b>{isImmediatePrescription(prescription) && <span className="ml-2 rounded bg-clinical-soft px-1.5 py-0.5 text-[10px] font-semibold text-clinical">Dose imediata</span>}<div className="text-xs text-muted-foreground">{prescription.posologia} · Horário: {time} · {prescription.pharmacy}</div><div className={cn("text-xs", insufficient ? "text-destructive" : "text-muted-foreground")}>{medication ? `Estoque: ${medication.quantity} ${medication.unit} · Qtde. deste horário: 1` : "Medicamento ainda não cadastrado no estoque"}</div></div><div className="flex flex-wrap items-center gap-2"><BarcodeScan className="w-56" placeholder="Bipar frasco ou lote" onScan={(code) => { const hit = findByBarcode(stock, code); if (!hit || hit.item.id !== medication?.id) { toast.error(hit ? `Produto errado: ${hit.item.name}` : "Código não cadastrado no estoque"); return; } if (hit.lot) setLots((c) => ({ ...c, [prescription.id]: hit.lot!.lot })); toast.success(hit.lot ? `Conferido · lote ${hit.lot.lot}` : "Produto conferido — informe o lote"); }} />{lotsByExpiry(medication).length ? <select aria-label={`Lote de ${prescription.item}`} className="h-9 w-64 rounded-md border bg-background px-2 text-sm" value={lots[prescription.id] ?? ""} onChange={(event) => setLots((c) => ({ ...c, [prescription.id]: event.target.value }))}><option value="">Lote * (vence primeiro no topo)</option>{lotsByExpiry(medication).map((l) => <option key={l.lot + l.expiry} value={l.lot}>{`${l.lot} · val. ${fmtExpiry(l.expiry)} · ${l.quantity}`}</option>)}</select> : <Input aria-label={`Lote de ${prescription.item}`} placeholder="Lote *" className="w-32" value={lots[prescription.id] ?? ""} onChange={(event) => setLots((c) => ({ ...c, [prescription.id]: event.target.value }))} />}<Button variant="ghost" onClick={() => { const quantity = window.prompt("Quantidade (ex.: 1,1 ML)", ""); if (!quantity) return; const t = window.prompt("Horário", `${new Date().toLocaleDateString("pt-BR")} ${time}`) ?? ""; const diluent = window.prompt("Diluente (vazio se não houver)", "") ?? ""; setDoseLabel({ kind: "dose", patient: patient.name, bed: patient.bed, sector: sectorName, drug: medication?.name ?? prescription.item, quantity, route: prescription.route ?? prescription.posologia.match(/\b(VO|EV|IM|SC|SNG|IV)\b/i)?.[0]?.toUpperCase() ?? "VO", time: t, validity: "24H", diluent, copies: 1 }); printLabels(); }}>Etiqueta dose</Button><Button variant="outline" disabled={!can(profile, "farmacia") || prescription.pharmacy !== "Pendente"} onClick={() => run(() => validatePrescription(encounter.id, prescription.id))}>Validar item</Button><Button variant="destructive" size="sm" disabled={!can(profile, "farmacia")} onClick={() => { const reason = window.prompt(`Motivo da falta de ${prescription.item} (ex.: estoque zerado, lote bloqueado, desabastecimento)`, "Estoque zerado"); if (!reason?.trim()) return; const suggestion = window.prompt("Sugestão de alternativa para o médico (opcional)", "") ?? ""; if (!window.confirm(`Confirmar falta de ${prescription.item}? O item volta ao médico para reavaliação e os demais seguem normalmente.`)) return; run(() => { reportShortage(encounter.id, prescription.id, reason, suggestion); toast.success("Falta informada ao médico"); }); }}>Informar falta</Button></div></div>;
      })}
      {beforeStart && (
        <label className="grid gap-1 text-xs">
          Observação / caso especial (opcional)
          <Input placeholder="Ex.: urgência clínica / ordem médica" value={specialCaseReason} onChange={(e) => setSpecialReasons((c) => ({ ...c, [encounter.id]: e.target.value }))} />
        </label>
      )}
      <label className="grid gap-1 text-xs">Intervenção farmacêutica<textarea aria-label={`Intervenção farmacêutica de ${patient.name}`} className="min-h-16 rounded-md border bg-background p-2" value={notes[encounter.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [encounter.id]: event.target.value }))} /></label>
      <Button disabled={!can(profile, "farmacia") || !gate.ok} onClick={() => run(() => { dispenseKit(encounter.id, notes[encounter.id] ?? "", lots, { specialCaseReason, targetTime: time }); toast.success(`Requisição do horário ${time} dispensada para a enfermagem`); setPrintTarget({ id: encounter.id, time }); printRequisition(); })}>Dispensar horário {time}</Button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  <LabelPrint label={doseLabel} /><RequisitionPrint e={printEnc} p={patients.find((x) => x.id === printEnc?.patientId)} stock={stock} time={printTarget?.time} /></section>;
}

function DispensedKits() {
  const encounters = useStore((s) => s.encounters); const patients = useStore((s) => s.patients); const stock = useStore((s) => s.stock);
  const [printId, setPrintId] = useState("");
  const list = encounters.filter((e) => e.dispensedAt).slice().reverse();
  const enc = encounters.find((x) => x.id === printId);
  return <section>{!list.length && <p className="py-6 text-muted-foreground">Nenhum medicamento prescrito dispensado.</p>}{list.map((e) => { const p = patients.find((x) => x.id === e.patientId); return <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"><span><b>{p?.name}</b> · Req. {e.requisition} · {new Date(e.dispensedAt!).toLocaleString("pt-BR")} · Médico: {e.signedBy}</span><Button size="sm" variant="outline" onClick={() => { setPrintId(e.id); printRequisition(); }}>Imprimir requisição</Button></div>; })}<RequisitionPrint e={enc} p={patients.find((x) => x.id === enc?.patientId)} stock={stock} /></section>;
}

const EMPTY_MEDICATION = { name: "", presentation: "", unit: "un", quantity: "0", minimum: "0" };
function StockManager() {
  const stock = useStore((state) => state.stock);
  const profile = useStore((state) => state.profile);
  const allowed = can(profile, "farmacia");
  const [form, setForm] = useState(EMPTY_MEDICATION);
  return <div className="space-y-4">
    <StockTable items={stock} allowed={allowed} onDelete={profile === "Administrador" ? (id) => deleteStockItem("stock", id) : undefined} label="Medicamento" />
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
  return <><MedShiftBoard /><details className="mb-4 rounded-xl border bg-card p-3"><summary className="cursor-pointer text-sm font-semibold">Pedido de produtos para Farmácia / Almoxarifado</summary><div className="mt-3"><NursingRequestForm /></div></details><div className="flex flex-wrap gap-4 text-xs"><span className="bg-muted px-2 py-1">Aguardando Farmácia</span><span className="bg-mt-yellow px-2 py-1">Liberado para Administração</span><span className="bg-clinical-soft px-2 py-1 text-clinical">Checado</span><span className="bg-maternal-soft px-2 py-1 text-maternal">Atrasado</span></div><Input aria-label="Justificativa da medicação" placeholder="Justificativa para não administrar ou adiar" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-3 max-w-xl" />{!list.length && <p className="py-6 text-muted-foreground">Nenhuma medicação ou cuidado pendente.</p>}{list.map((encounter) => {
    const patient = patients.find((item) => item.id === encounter.patientId);
    if (!patient) return null;
    const readyForReview = encounter.status_fluxo === "AGUARDANDO_MEDICACAO" && allBatchDosesDone(encounter, patient, admins);
    return <section className="space-y-3 border-b py-4" key={encounter.id}><Button variant="link" asChild><Link to="/pacientes/$id" params={{ id: patient.id }}>{patient.name} · {patient.bed || patient.ward}</Link></Button><ProcedurePrintButton patientId={patient.id} sector="Posto de enfermagem" />{readyForReview && <Button size="sm" variant="secondary" disabled={!can(profile, "checar")} onClick={() => run(() => { if (advanceCompletedMedication(encounter.id)) toast.success("Paciente enviado para reavaliação médica"); })}>Enviar para reavaliação médica</Button>}<EncounterTimeline patientId={patient.id} />{patient.prescriptions.filter((prescription) => prescription.times?.length && prescription.batchId === encounter.prescriptionBatchId).map((prescription) => <div className="grid gap-3 border-b py-3 md:grid-cols-[240px_1fr]" key={prescription.id}><div className="text-sm"><b>{prescription.item}</b><div className="text-xs text-muted-foreground">{prescription.posologia}</div>{prescription.lot && <div className="text-xs">Lote: <b className="font-mono">{prescription.lot}</b></div>}<BarcodeScan className="mt-2" placeholder="Bipar antes de administrar" onScan={(code) => { const hit = findByBarcode(stock, code); const expected = findStockMedication(stock, prescription.item); if (!hit || hit.item.id !== expected?.id) { toast.error(hit ? `ATENÇÃO: medicamento errado (${hit.item.name})` : "Código não cadastrado"); return; } if (prescription.lot && hit.lot && hit.lot.lot !== prescription.lot) { toast.error(`Lote diferente do dispensado (${hit.lot.lot})`); return; } toast.success("Medicamento correto conferido com sucesso"); }} /></div><div className="flex flex-wrap gap-2">{prescription.times?.map((time) => {
      const administration = admins[`${patient.id}|${prescription.id}|${time}`];
      const waiting = !!prescription.pharmacy && prescription.pharmacy !== "Dispensada";
      const due = new Date(encounter.signedAt ?? encounter.openedAt);
      const [hours, minutes] = time.split(":").map(Number); due.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      if (due.getTime() < Date.parse(encounter.signedAt ?? encounter.openedAt) - 60000) due.setDate(due.getDate() + 1);
      const late = !waiting && administration?.status !== "checado" && now > due.getTime();
      return <div key={time} className={cn("min-w-44 rounded-md border p-2 text-xs", waiting ? "bg-muted" : administration?.status === "checado" ? "bg-clinical-soft text-clinical" : late ? "bg-maternal-soft text-maternal" : "bg-mt-yellow")}><b className="font-mono">{time}</b><div>{waiting ? "Aguardando dispensação da farmácia" : administration?.status === "checado" ? "Administrado" : administration?.status === "cancelado" ? `Cancelado pelo médico: ${administration.reason}` : administration?.status === "nao" ? `Não administrado: ${administration.reason}` : administration?.status === "adiado" ? `Adiado: ${administration.reason}` : late ? "Atrasado · Liberado para Administração" : "Liberado para Administração"}</div>{administration && <div>{new Date(administration.at).toLocaleString("pt-BR")} · {administration.by}</div>}{administration?.status !== "checado" && administration?.status !== "cancelado" && <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" disabled={waiting || !can(profile, "checar")} onClick={() => run(() => { recordMedication(encounter.id, prescription.id, time, "checado"); toast.success("Medicação checada"); })}>Checar Medicação</Button><Button size="sm" variant="outline" disabled={waiting || !can(profile, "checar")} onClick={() => run(() => recordMedication(encounter.id, prescription.id, time, "nao", reason))}>Justificar</Button><Button size="sm" variant="outline" disabled={waiting || !can(profile, "checar")} onClick={() => run(() => recordMedication(encounter.id, prescription.id, time, "adiado", reason))}>Adiar</Button>{!waiting && can(profile, "prescrever") && <Button size="sm" variant="destructive" onClick={() => { const why = window.prompt("Motivo do cancelamento pelo médico (obrigatório):"); if (why == null) return; if (!window.confirm(`Confirmar cancelamento da dose das ${time}?`)) return; run(() => { recordMedication(encounter.id, prescription.id, time, "cancelado", why); toast.success("Dose cancelada pelo médico"); }); }}>Cancelamento pelo médico</Button>}</div>}</div>;
    })}</div></div>)}</section>;
  })}</>;
}
