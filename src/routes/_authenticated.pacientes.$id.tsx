import { EncounterTimeline } from "@/components/EncounterTimeline";
import { ProcedurePrintButton } from "@/components/ProcedurePrint";
import { MedicalAssessment, PrescriptionRelease } from "@/components/CareMedical";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Printer, Copy, Trash2, Baby, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoPermission } from "@/components/AppShell";
import { PatientIcon } from "@/components/PatientIcon";
import { SpecialConditionsBanner } from "@/components/SpecialConditions";
import { PatientSheetPrint, printSheet } from "@/components/PatientSheetPrint";
import { PatientRegistrationFields } from "@/components/PatientRegistrationFields";
import { registrationFor } from "@/lib/patient-registration-mapping";
import { DoseCalculator, calcResult, initCalc } from "@/components/DoseCalculator";
import { doseText } from "@/lib/dose-calc";
import { DRUGS, WARDS, allergyConflict, can, interactionsWith, type EvoCat, type Patient, type PrescCat, type Vital } from "@/lib/hospital-data";
import { getState, nowHM, professionalName, registerBirth, updatePatient, useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pacientes/$id")({
  loader: ({ params }) => { const p = getState().patients.find((x) => x.id === params.id); if (!p) throw notFound(); return { name: p.name }; },
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData ? `PEP · ${loaderData.name} – HMI Gestão` : "Prontuário – HMI Gestão" },
    { name: "description", content: "Prontuário eletrônico do paciente: evolução, prescrição, sinais vitais, partograma e RN." },
    { property: "og:title", content: "Prontuário eletrônico – HMI Gestão" },
    { property: "og:description", content: "Evolução, prescrição, sinais vitais, partograma e RN." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: PEP,
});

function PEP() {
  const { id } = Route.useParams();
  const p = useStore((s) => s.patients.find((x) => x.id === id));
  const sheetEncounter = useStore((s) => s.encounters.slice().reverse().find((x) => x.patientId === id));
  const employeeName = useStore((s) => s.employeeName);
  const [print, setPrint] = useState(false);
  if (!p) return <div className="p-8 text-center text-muted-foreground">Prontuário não encontrado. <Link to="/pacientes" className="text-clinical">Voltar</Link></div>;
  const obst = p.type === "gestante";
  const showNB = p.type === "neonato" || !!p.babyIds?.length;
  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-5 -mt-5 border-b bg-card px-5 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground", obst || p.type === "puerpera" ? "bg-maternal" : "bg-primary")}><PatientIcon type={p.type} className="h-6 w-6" /></div>
          <div className="min-w-0">
            <div className="text-lg font-semibold">{p.name}</div>
            <div className="text-xs text-muted-foreground">Pront. {p.prontuario} · {p.age}{p.ig ? ` · IG ${p.ig}` : ""} · <b className="text-foreground">{p.weight} kg</b>{p.guardian ? ` · Resp.: ${p.guardian}` : ""}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.allergies.length > 0 ? <span className="pulse-alert rounded-md bg-maternal px-2 py-1 text-xs font-bold text-primary-foreground">ALERGIA: {p.allergies.join(", ")}</span> : <span className="rounded-md bg-muted px-2 py-1 text-xs">Sem alergias conhecidas</span>}
            {p.risks.map((r) => <span key={r} className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", r === "Queda" ? "bg-mt-yellow text-foreground" : r === "Alergia" ? "bg-maternal-soft text-maternal" : r === "Risco Hemorrágico" ? "bg-maternal text-primary-foreground" : "bg-mt-orange text-primary-foreground")}>{r}</span>)}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right text-xs"><div className="font-mono font-semibold">{p.bed}</div><div className="text-muted-foreground">{WARDS.find((w) => w.id === p.ward)?.name} · {p.insurance}</div></div>
            <button onClick={() => setPrint(true)} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"><Printer className="h-4 w-4" />Pulseira/Etiqueta</button>
            <button onClick={() => printSheet("BAA")} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"><Printer className="h-4 w-4" />BAA</button>
            <ProcedurePrintButton patientId={p.id} /><button onClick={() => printSheet("FIA")} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"><Printer className="h-4 w-4" />FIA</button>
          </div>
        </div>
        <div className="mt-1 text-xs"><span className="font-medium">Diagnóstico:</span> {p.diagnosis}</div>
        <EncounterTimeline patientId={p.id} />
      </div>
      <PatientSheetPrint p={p} e={sheetEncounter} user={employeeName} />
      <SpecialConditionsBanner patient={p} />
      <Tabs defaultValue="resumo" className="print:hidden">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumo">Resumo & Evolução</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro do paciente</TabsTrigger>
          <TabsTrigger value="prescricao">Prescrição</TabsTrigger>
          <TabsTrigger value="sinais">Sinais vitais & BH</TabsTrigger>
          {obst && <TabsTrigger value="partograma">Obstetrícia & Partograma</TabsTrigger>}
          {showNB && <TabsTrigger value="rn">Recém-nascido & Vínculo</TabsTrigger>}
        </TabsList>
        <TabsContent value="resumo"><MedicalAssessment p={p} /><Evolucao p={p} /></TabsContent>
        <TabsContent value="prescricao"><PrescriptionRelease patientId={p.id} /><Prescricao p={p} /></TabsContent>
        <TabsContent value="sinais"><Sinais p={p} /></TabsContent>
        <TabsContent value="cadastro"><PatientRegistrationFields key={p.id} readOnly value={registrationFor(p)} onChange={() => {}} recordNumber={p.prontuario} /></TabsContent>
        {obst && <TabsContent value="partograma"><Partograma p={p} /></TabsContent>}
        {showNB && <TabsContent value="rn"><RN p={p} /></TabsContent>}
      </Tabs>
      <Dialog open={print} onOpenChange={setPrint}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pulseira de identificação</DialogTitle></DialogHeader>
          <div className="mx-auto w-full rounded-full border-4 border-primary px-6 py-3 text-xs">
            <div className="flex items-center justify-between"><b className="text-sm">{p.name}</b><span className="font-mono">{p.bed}</span></div>
            <div>Pront. {p.prontuario} · Nasc./Idade: {p.age}{p.motherName ? ` · Mãe: ${p.motherName}` : ""}</div>
            <div className="mt-1 flex items-center justify-between"><span className="font-mono tracking-[0.3em]">||| |||| | ||| {p.prontuario.replace("-", "")} || |</span>{p.allergies.length > 0 && <b className="text-maternal">ALERGIA</b>}</div>
          </div>
          <button onClick={() => window.print()} className="rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground">Imprimir</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Card = ({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) => <div className={cn("rounded-lg border bg-card p-4", className)}><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{title}</h3>{action}</div>{children}</div>;
const CATS: EvoCat[] = ["Médica", "Enfermagem", "Fisioterapia", "Serviço Social"];
const SOAP = {
  "SOAP": "S: \nO: PA __/__ mmHg, FC __ bpm, Tax __ °C\nA: \nP: ",
  "Evolução obstétrica": "S: Refere contrações / perda de líquido: \nO: Dilatação __ cm, altura __ (De Lee), BCF __ bpm, DU __/10min\nA: \nP: ",
  "Evolução pediátrica": "S: Responsável refere: \nO: Peso __ kg, FR __ irpm, SatO2 __%, hidratação: \nA: \nP: ",
  "Puerpério": "S: \nO: Útero contraído, lóquios __, ferida operatória __, mamas __\nA: \nP: ",
};

function Evolucao({ p }: { p: Patient }) {
  const profile = useStore((s) => s.profile);
  const [f, setF] = useState<EvoCat | "Todos">("Todos");
  const [text, setText] = useState("");
  const [cat, setCat] = useState<EvoCat>(profile === "Enfermeiro" ? "Enfermagem" : "Médica");
  const list = p.evolutions.filter((e) => f === "Todos" || e.cat === f);
  const color = (c: EvoCat) => ({ Médica: "bg-primary", Enfermagem: "bg-clinical", Fisioterapia: "bg-bed-isolation", "Serviço Social": "bg-mt-orange" })[c];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card title="Linha do tempo">
        <div className="mb-3 flex flex-wrap gap-1">{(["Todos", ...CATS] as const).map((x) => <button key={x} onClick={() => setF(x)} className={cn("rounded-full border px-3 py-1 text-xs", f === x && "bg-primary text-primary-foreground")}>{x}</button>)}</div>
        <ol className="space-y-3 border-l-2 pl-4">
          {list.map((e, i) => (
            <li key={i} className="relative"><span className={cn("absolute -left-[23px] top-1 h-3 w-3 rounded-full", color(e.cat))} />
              <div className="text-xs text-muted-foreground"><span className="font-mono">{e.time}</span> · Evolução {e.cat} · {e.author}</div><p className="whitespace-pre-line text-sm">{e.text}</p></li>
          ))}
          {list.length === 0 && <li className="text-sm text-muted-foreground">Nenhum registro nesta categoria.</li>}
        </ol>
      </Card>
      <Card title="Nova evolução">
        {can(profile, "evoluir") ? <>
          <div className="mb-2 flex gap-2"><select value={cat} onChange={(e) => setCat(e.target.value as EvoCat)} className="h-8 flex-1 rounded-md border bg-background px-2 text-xs">{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="mb-2 flex flex-wrap gap-1">{Object.keys(SOAP).map((k) => <button key={k} onClick={() => setText(SOAP[k as keyof typeof SOAP])} className="rounded border px-2 py-0.5 text-[11px] hover:bg-muted">{k}</button>)}</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="w-full rounded-md border bg-background p-2 font-mono text-xs" placeholder="Escolha um modelo ou digite…" />
          <button disabled={!text.trim()} onClick={() => { updatePatient(p.id, (x) => ({ evolutions: [{ time: `14/11 ${nowHM()}`, cat, author: professionalName(profile), text }, ...x.evolutions] })); setText(""); toast.success("Evolução registrada e assinada"); }} className="mt-2 w-full rounded-md bg-clinical py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">Assinar e registrar</button>
        </> : <NoPermission action="registrar evoluções" />}
      </Card>
    </div>
  );
}

function Prescricao({ p }: { p: Patient }) {
  const profile = useStore((s) => s.profile);
  const allowed = can(profile, "prescrever");
  const ped = p.type === "pediatria" || p.type === "neonato";
  const [cat, setCat] = useState<PrescCat>("Medicamento");
  const [drugName, setDrugName] = useState(DRUGS[0]?.name ?? "");
  const [free, setFree] = useState(""); const [pos, setPos] = useState("");
  const drug = DRUGS.find((d) => d.name === drugName);
  const [calc, setCalc] = useState(() => initCalc(DRUGS[0]!));
  if (!drug) return null;
  const encounter = getState().encounters.slice().reverse().find((e) => e.patientId === p.id);
  const editable = allowed && encounter?.status_fluxo === "EM_ATENDIMENTO_MEDICO";
  const dose = calcResult(drug, calc, p.weight);
  const allergy = allergyConflict(drug, p.allergies);
  const inter = interactionsWith(drug, p.prescriptions);
  const cats: PrescCat[] = ["Dieta", "Hidratação", "Medicamento", "Cuidados", "Exames"];
  const add = () => {
    const isMed = cat === "Medicamento";
    if (!editable) { toast.error("Inicie ou retome o atendimento médico para editar a prescrição."); return; }
    if (isMed && (ped && !(p.weight > 0))) { toast.error("Peso obrigatório para dose pediátrica"); return; }
    if (isMed && allergy) { toast.error(`Conflito de alergia: ${allergy}`); return; }
    const nDoses = Math.max(1, Math.round(parseFloat(calc.doses.replace(",", ".")) || 1)); const every = Math.round((24 / nDoses) * 10) / 10;
    const startHour = new Date().getHours();
    const minute = new Date().getMinutes();
    const times = isMed ? Array.from({ length: nDoses }, (_, i) => `${String(Math.floor(startHour + i * every) % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`) : undefined;
    const item = isMed ? (ped || calc.perDose || p.weight > 0 ? doseText(drug.name, dose, parseFloat(calc.mgKgDay.replace(",", ".")) || 0, drug.presentations?.[calc.presentation]) : `${drug.name} ${free || ""}`.trim()) : free;
    if (!item) return;
    updatePatient(p.id, (x) => ({ prescriptions: [...x.prescriptions, { id: `rx-${Date.now()}`, cat, item, posologia: isMed ? (pos || `${every}/${every}h`) : pos || "—", ...(times ? { times, pharmacy: "Pendente" as const } : {}) }] }));
    setFree(""); setPos(""); toast.success("Item adicionado à prescrição");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card title="Prescrição vigente – 14/11/2026" action={editable && <button onClick={() => { updatePatient(p.id, (x) => ({ prescriptions: (x.previousPrescriptions ?? []).map((r, i) => ({ ...r, id: `rx-c${Date.now()}-${i}`, ...(r.cat === "Medicamento" ? { pharmacy: "Pendente" as const } : {}) })) })); toast.success("Prescrição anterior clonada – revise e assine"); }} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"><Copy className="h-3.5 w-3.5" />Clonar Prescrição Anterior</button>}>
        {cats.map((c) => { const it = p.prescriptions.filter((x) => x.cat === c); return (
          <div key={c} className="mb-3"><div className="mb-1 text-xs font-semibold uppercase text-primary">{c === "Hidratação" ? "Hidratação / Venóclise" : c === "Exames" ? "Solicitação de exames" : c === "Cuidados" ? "Cuidados de enfermagem" : c}</div>
            {it.length === 0 ? <div className="text-xs text-muted-foreground">—</div> : it.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-2 border-b py-1.5 text-sm"><div><span className="font-medium">{x.item}</span> <span className="text-muted-foreground">· {x.posologia}</span>{x.times && <span className="ml-1 font-mono text-[10px] text-muted-foreground">[{x.times.join(" ")}]</span>}</div>
                <div className="flex items-center gap-2">{x.pharmacy && <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", x.pharmacy === "Pendente" ? "bg-mt-yellow text-foreground" : "bg-clinical-soft text-clinical")}>{x.pharmacy}</span>}
                  {editable && <button onClick={() => updatePatient(p.id, (y) => ({ prescriptions: y.prescriptions.filter((r) => r.id !== x.id) }))} aria-label="Suspender" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}</div></div>
            ))}</div>); })}
      </Card>
      <Card title="Adicionar item">
        {!editable ? <NoPermission action="editar a prescrição nesta etapa" /> : <div className="space-y-2 text-sm">
          <select value={cat} onChange={(e) => setCat(e.target.value as PrescCat)} className="h-8 w-full rounded-md border bg-background px-2 text-xs">{cats.map((c) => <option key={c}>{c}</option>)}</select>
          {cat === "Medicamento" ? <>
            <select value={drugName} onChange={(e) => { setDrugName(e.target.value); const d = DRUGS.find((x) => x.name === e.target.value); if (d) setCalc(initCalc(d)); }} className="h-8 w-full rounded-md border bg-background px-2 text-xs">{DRUGS.map((d) => <option key={d.name}>{d.name}</option>)}</select>
            {ped || p.weight > 0 ? (
              <DoseCalculator drug={drug} weight={p.weight} value={calc} onChange={setCalc} />
            ) : <input value={free} onChange={(e) => setFree(e.target.value)} placeholder="Dose (ex.: 500 mg)" className="h-8 w-full rounded-md border bg-background px-2 text-xs" />}
            {allergy && <div className="pulse-alert flex items-start gap-2 rounded-md bg-maternal p-2 text-xs font-semibold text-primary-foreground"><AlertTriangle className="h-4 w-4 shrink-0" />Paciente alérgico(a) a {allergy}!</div>}
            {inter.map((m) => <div key={m} className="flex items-start gap-2 rounded-md bg-mt-orange p-2 text-xs font-medium text-primary-foreground"><AlertTriangle className="h-4 w-4 shrink-0" />Interação: {m}</div>)}
          </> : <input value={free} onChange={(e) => setFree(e.target.value)} placeholder="Descrição do item" className="h-8 w-full rounded-md border bg-background px-2 text-xs" />}
          <input value={pos} onChange={(e) => setPos(e.target.value)} placeholder="Via / posologia (opcional)" className="h-8 w-full rounded-md border bg-background px-2 text-xs" />
          <button onClick={add} className="w-full rounded-md bg-clinical py-2 text-sm font-medium text-accent-foreground">Adicionar à prescrição</button>
        </div>}
      </Card>
    </div>
  );
}

const SLOTS = ["06:00", "12:00", "18:00", "00:00"];
function Sinais({ p }: { p: Patient }) {
  const profile = useStore((s) => s.profile);
  const [slot, setSlot] = useState("18:00");
  const [f, setF] = useState({ pas: "", pad: "", fc: "", fr: "", tax: "", sat: "", dor: "", ingesta: "", diurese: "", vomitos: "" });
  const bySlot = (t: string) => p.vitals.find((v) => v.time === t);
  const data = SLOTS.map((t) => bySlot(t)).filter((v): v is Vital => !!v).map((v) => ({ ...v, perdas: v.diurese + v.vomitos, balanco: v.ingesta - v.diurese - v.vomitos }));
  const total = data.reduce((s, v) => s + v.balanco, 0);
  const rows: [string, (v: Vital) => string | number][] = [["PA (mmHg)", (v) => `${v.pas}/${v.pad}`], ["FC (bpm)", (v) => v.fc], ["FR (irpm)", (v) => v.fr], ["Tax (°C)", (v) => v.tax.toFixed(1)], ["SatO2 (%)", (v) => v.sat], ["Dor (0-10)", (v) => v.dor], ["Ingesta (mL)", (v) => v.ingesta], ["Diurese (mL)", (v) => v.diurese], ["Vômitos (mL)", (v) => v.vomitos], ["Balanço (mL)", (v) => { const b = v.ingesta - v.diurese - v.vomitos; return (b > 0 ? "+" : "") + b; }]];
  const save = () => {
    const n = (k: keyof typeof f) => parseFloat(f[k].replace(",", ".")) || 0;
    const nv: Vital = { time: slot, pas: n("pas"), pad: n("pad"), fc: n("fc"), fr: n("fr"), tax: n("tax"), sat: n("sat"), dor: n("dor"), ingesta: n("ingesta"), diurese: n("diurese"), vomitos: n("vomitos") };
    updatePatient(p.id, (x) => ({ vitals: [...x.vitals.filter((v) => v.time !== slot), nv] }));
    toast.success(`Sinais das ${slot} registrados`);
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card title={`Folha de controle – 14/11 ${p.type === "neonato" ? "· Balanço hídrico rigoroso" : ""}`}>
          <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1">Parâmetro</th>{SLOTS.map((s) => <th key={s} className="py-1 text-center">{s.slice(0, 2)}h</th>)}</tr></thead>
            <tbody>{rows.map(([l, fn]) => <tr key={l} className="border-t"><td className="py-1.5 text-xs font-medium">{l}</td>{SLOTS.map((s) => { const v = bySlot(s); const hot = v && l.startsWith("Tax") && v.tax >= 37.8; const low = v && l.startsWith("Sat") && v.sat < 92; return <td key={s} className={cn("text-center font-mono", (hot || low) && "font-bold text-maternal")}>{v ? fn(v) : "—"}</td>; })}</tr>)}</tbody>
          </table>
          <div className="mt-2 text-right text-sm">Balanço acumulado 24h: <b className="font-mono text-clinical">{total > 0 ? "+" : ""}{total} mL</b>{p.type === "neonato" && <span className="ml-2 text-xs text-muted-foreground">({Math.round(data.reduce((s, v) => s + v.ingesta, 0) / p.weight)} mL/kg ofertados)</span>}</div>
        </Card>
        <Card title="Registrar aferição">
          {can(profile, "evoluir") ? <div className="space-y-2">
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-xs">{SLOTS.map((s) => <option key={s}>{s}</option>)}</select>
            <div className="grid grid-cols-2 gap-2">{(Object.keys(f) as (keyof typeof f)[]).map((k) => <input key={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={k.toUpperCase()} className="h-8 rounded-md border bg-background px-2 text-xs" />)}</div>
            <button onClick={save} className="w-full rounded-md bg-clinical py-2 text-sm font-medium text-accent-foreground">Salvar</button>
          </div> : <NoPermission action="registrar sinais vitais" />}
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Curva térmica"><ResponsiveContainer width="100%" height={200}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="time" fontSize={11} /><YAxis domain={[35, 40]} fontSize={11} /><Tooltip /><Line dataKey="tax" name="Tax °C" stroke="var(--maternal)" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
        <Card title="Pressão arterial"><ResponsiveContainer width="100%" height={200}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="time" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Line dataKey="pas" name="PAS" stroke="var(--primary)" strokeWidth={2} /><Line dataKey="pad" name="PAD" stroke="var(--clinical)" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
        <Card title="Ganhos × perdas"><ResponsiveContainer width="100%" height={200}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="time" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Bar dataKey="ingesta" name="Ingesta" fill="var(--clinical)" /><Bar dataKey="diurese" name="Diurese" fill="var(--primary)" stackId="p" /><Bar dataKey="vomitos" name="Vômitos" fill="var(--chart-4)" stackId="p" /></BarChart></ResponsiveContainer></Card>
      </div>
    </div>
  );
}

function Partograma({ p }: { p: Patient }) {
  const profile = useStore((s) => s.profile);
  const navigate = useNavigate();
  const pts = p.partograma ?? [];
  const [d, setD] = useState({ dilat: 8, altura: 0, bcf: 140, contr: 4 });
  const [birth, setBirth] = useState(false);
  const [nb, setNb] = useState({ apgar1: 8, apgar5: 9, pesoNascer: 3250, comprimento: 49, pc: 34, tipagem: "O+" });
  const [mode, setMode] = useState<"Parto Normal" | "Cesárea">("Parto Normal");
  const [sex, setSex] = useState<"F" | "M">("F");
  const last = pts[pts.length - 1];
  const alertLine = pts.map((x) => ({ ...x, alerta: pts[0] ? Math.min(10, pts[0].dilat + x.hour) : null }));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card title="Partograma" action={can(profile, "parto") && <button onClick={() => setBirth(true)} className="flex items-center gap-1.5 rounded-md bg-maternal px-3 py-1.5 text-xs font-medium text-primary-foreground"><Baby className="h-4 w-4" />Registrar Nascimento / Parto</button>}>
        {pts.length === 0 ? <p className="text-sm text-muted-foreground">Sem registros — paciente fora de trabalho de parto ativo.</p> : <>
          <ResponsiveContainer width="100%" height={260}><LineChart data={alertLine}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} fontSize={11} /><YAxis yAxisId="d" domain={[0, 10]} fontSize={11} label={{ value: "cm", angle: -90, position: "insideLeft", fontSize: 10 }} /><YAxis yAxisId="a" orientation="right" domain={[-4, 4]} reversed fontSize={11} label={{ value: "De Lee", angle: 90, position: "insideRight", fontSize: 10 }} /><Tooltip /><Legend />
            <Line yAxisId="d" dataKey="dilat" name="Dilatação (cm)" stroke="var(--maternal)" strokeWidth={2} /><Line yAxisId="d" dataKey="alerta" name="Linha de alerta" stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={false} /><Line yAxisId="a" dataKey="altura" name="Altura (De Lee)" stroke="var(--primary)" strokeWidth={2} /></LineChart></ResponsiveContainer>
          <ResponsiveContainer width="100%" height={130}><LineChart data={pts}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} fontSize={11} /><YAxis domain={[100, 180]} fontSize={11} /><Tooltip /><Line dataKey="bcf" name="BCF (bpm)" stroke="var(--clinical)" strokeWidth={2} /></LineChart></ResponsiveContainer>
          <div className="mt-2 flex gap-1">{pts.map((x) => <div key={x.hour} className="flex-1 rounded bg-maternal-soft p-1 text-center text-[10px]"><div className="font-mono font-semibold text-maternal">{x.contr}/10'</div><div>{x.hour}h</div></div>)}</div>
        </>}
      </Card>
      <Card title="Registrar avaliação">
        {last && <div className="mb-2 text-xs text-muted-foreground">Último: {last.dilat} cm · {last.altura} · BCF {last.bcf}</div>}
        {([["dilat", "Dilatação (cm)"], ["altura", "Altura (De Lee)"], ["bcf", "BCF (bpm)"], ["contr", "Contrações/10min"]] as const).map(([k, l]) => (
          <label key={k} className="mb-2 block text-xs">{l}<input type="number" value={d[k]} onChange={(e) => setD({ ...d, [k]: +e.target.value })} className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm" /></label>
        ))}
        <button onClick={() => updatePatient(p.id, (x) => ({ partograma: [...(x.partograma ?? []), { hour: (last?.hour ?? -1) + 1, ...d }] }))} className="w-full rounded-md bg-maternal py-2 text-sm font-medium text-primary-foreground">Adicionar ao partograma</button>
      </Card>
      <Dialog open={birth} onOpenChange={setBirth}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar nascimento – {p.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label>Via de parto<select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="mt-1 h-8 w-full rounded-md border bg-background px-2"><option>Parto Normal</option><option>Cesárea</option></select></label>
            <label>Sexo<select value={sex} onChange={(e) => setSex(e.target.value as "F" | "M")} className="mt-1 h-8 w-full rounded-md border bg-background px-2"><option value="F">Feminino</option><option value="M">Masculino</option></select></label>
            {([["apgar1", "Apgar 1º min"], ["apgar5", "Apgar 5º min"], ["pesoNascer", "Peso (g)"], ["comprimento", "Comprimento (cm)"], ["pc", "Perímetro cefálico (cm)"]] as const).map(([k, l]) => <label key={k}>{l}<input type="number" value={nb[k]} onChange={(e) => setNb({ ...nb, [k]: +e.target.value })} className="mt-1 h-8 w-full rounded-md border bg-background px-2" /></label>)}
            <label>Tipagem<select value={nb.tipagem} onChange={(e) => setNb({ ...nb, tipagem: e.target.value })} className="mt-1 h-8 w-full rounded-md border bg-background px-2">{["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((t) => <option key={t}>{t}</option>)}</select></label>
          </div>
          <button onClick={() => { const id = registerBirth(p.id, { ...nb, coracaozinho: "Pendente", olhinho: "Pendente", vacinas: [] }, mode, sex); setBirth(false); toast.success("Nascimento registrado – prontuário do RN criado e vinculado"); navigate({ to: "/pacientes/$id", params: { id } }); }} className="rounded-md bg-maternal py-2 text-sm font-medium text-primary-foreground">Confirmar nascimento</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RN({ p }: { p: Patient }) {
  const patients = useStore((s) => s.patients);
  if (p.type !== "neonato") {
    return <Card title="Recém-nascidos vinculados">{(p.babyIds ?? []).map((id) => { const b = patients.find((x) => x.id === id); return b && <Link key={id} to="/pacientes/$id" params={{ id }} className="mb-2 block rounded-md border p-3 hover:bg-muted"><div className="font-medium">{b.name}</div><div className="text-xs text-muted-foreground">Pront. {b.prontuario} · {b.bed} · Apgar {b.newborn?.apgar1}/{b.newborn?.apgar5} · {b.newborn?.pesoNascer} g</div></Link>; })}</Card>;
  }
  const nb = p.newborn;
  if (!nb) return <Card title="Recém-nascido"><p className="text-sm text-muted-foreground">Sem registro de sala de parto.</p></Card>;
  const mother = nb.motherId ? patients.find((x) => x.id === nb.motherId) : undefined;
  const setNb = (patch: Partial<typeof nb>) => updatePatient(p.id, (x) => ({ newborn: { ...(x.newborn ?? nb), ...patch } }));
  const Box = ({ l, v, s }: { l: string; v: string | number; s?: string }) => <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="font-mono text-xl font-semibold text-primary">{v}</div>{s && <div className="text-[10px] text-muted-foreground">{s}</div>}</div>;
  const Sel = ({ l, k }: { l: string; k: "coracaozinho" | "olhinho" }) => <label className="flex items-center justify-between border-b py-1.5 text-sm">{l}<select value={nb[k]} onChange={(e) => setNb({ [k]: e.target.value })} className="h-7 rounded border bg-background px-1 text-xs"><option>Pendente</option><option>Normal</option><option>Alterado</option></select></label>;
  return (
    <div className="space-y-4">
      <Card title="Boletim de sala de parto">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Box l="Apgar 1º min" v={nb.apgar1} s={nb.apgar1 < 7 ? "Asfixia leve/moderada" : "Boa vitalidade"} /><Box l="Apgar 5º min" v={nb.apgar5} />
          <Box l="Peso ao nascer" v={`${nb.pesoNascer} g`} s={nb.pesoNascer < 2500 ? "Baixo peso" : "Adequado"} /><Box l="Comprimento" v={`${nb.comprimento} cm`} /><Box l="Perím. cefálico" v={`${nb.pc} cm`} /><Box l="Tipagem" v={nb.tipagem} />
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Triagem neonatal"><Sel l="Teste do Coraçãozinho" k="coracaozinho" /><Sel l="Teste do Olhinho" k="olhinho" /></Card>
        <Card title="Vacinas">
          {["BCG", "Hepatite B"].map((x) => { const done = nb.vacinas.includes(x); return <div key={x} className="flex items-center justify-between border-b py-1.5 text-sm">{x}<button onClick={() => setNb({ vacinas: done ? nb.vacinas.filter((y) => y !== x) : [...nb.vacinas, x] })} className={cn("rounded px-2 py-0.5 text-xs font-semibold", done ? "bg-clinical text-accent-foreground" : "border text-muted-foreground")}>{done ? "Aplicada ✓" : "Registrar"}</button></div>; })}
        </Card>
        <Card title="Vínculo mãe-bebê">
          {mother ? <Link to="/pacientes/$id" params={{ id: mother.id }} className="block rounded-md border p-3 hover:bg-muted"><div className="text-xs text-muted-foreground">Mãe</div><div className="font-medium">{mother.name}</div><div className="text-xs text-muted-foreground">Pront. {mother.prontuario} · {mother.bed}</div></Link>
            : <p className="text-sm text-muted-foreground">Mãe: {p.motherName} (internada em outra unidade)</p>}
        </Card>
      </div>
    </div>
  );
}
