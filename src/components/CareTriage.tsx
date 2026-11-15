import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Baby, Clock, Siren } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RiskBadge, RiskStripe } from "./RiskBadge";
import { SpecialConditionBadges } from "./SpecialConditions";
import { can, MANCHESTER, type Manchester, type Patient } from "@/lib/hospital-data";
import { callPatient, completeTriage, useStore } from "@/lib/hospital-store";
import { sortMedicalQueue, type Encounter } from "@/lib/care-flow";
import { descritorPorId, FLUXOGRAMAS, fluxogramaPorId, PUBLICO_LABEL, sugerirCorPCACR, TEMPO_PCACR, type Publico } from "@/lib/pcacr";
import { cn } from "@/lib/utils";

const RISKS = Object.keys(MANCHESTER) as Manchester[];
type Group = "obstetrica" | "pediatria";
const isObstetric = (patient?: Patient) => patient?.type === "gestante" || patient?.type === "puerpera";
const audienceFor = (patient?: Patient): Publico => isObstetric(patient) ? "obstetricia" : "pediatria";

export function CareTriage() {
  const encounters = useStore((state) => state.encounters);
  const patients = useStore((state) => state.patients);
  const [selected, setSelected] = useState<Encounter | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const active = encounters.filter((encounter) => encounter.status_fluxo !== "ALTA_HOSPITALAR");

  return <div className="space-y-5">
    <div><h1 className="text-xl font-semibold">Painel de filas · Acolhimento e risco</h1><p className="text-sm text-muted-foreground">Protocolo de Classificação de Acolhimento e Risco (PCACR) · Santa Catarina · {active.length} atendimentos ativos</p></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {RISKS.map((risk) => {
        const count = active.filter((encounter) => encounter.triage?.risk === risk && encounter.status_fluxo === "AGUARDANDO_MEDICO").length;
        return <div key={risk} className={cn("rounded-lg px-4 py-3", MANCHESTER[risk].cls)}><div className="text-xs font-semibold uppercase tracking-wide">{MANCHESTER[risk].label}</div><div className="flex flex-wrap items-baseline justify-between gap-1"><span className="font-mono text-3xl font-semibold">{count}</span><span className="text-xs">{risk === "vermelho" ? "Imediato" : "Por gravidade"}</span></div></div>;
      })}
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      {(["obstetrica", "pediatria"] as const).map((group) => <QueueColumn key={group} group={group} items={active.filter((encounter) => isObstetric(patients.find((patient) => patient.id === encounter.patientId)) === (group === "obstetrica"))} now={now} onSelect={setSelected} />)}
    </div>
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{selected?.triage ? "Reclassificar" : "Classificar"} · {patients.find((patient) => patient.id === selected?.patientId)?.name}</DialogTitle></DialogHeader>{selected && <TriageForm encounter={selected} onDone={() => setSelected(null)} />}</DialogContent>
    </Dialog>
  </div>;
}

function QueueColumn({ group, items, now, onSelect }: { group: Group; items: Encounter[]; now: number; onSelect: (encounter: Encounter) => void }) {
  const Icon = group === "obstetrica" ? Baby : Siren;
  const triage = items.filter((encounter) => encounter.status_fluxo === "AGUARDANDO_TRIAGEM").sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const medical = sortMedicalQueue(items.filter((encounter) => encounter.status_fluxo === "AGUARDANDO_MEDICO"));
  const inCare = items.filter((encounter) => ["EM_ATENDIMENTO_MEDICO", "EM_OBSERVACAO_REAVALIACAO"].includes(encounter.status_fluxo));
  return <section className="rounded-xl border bg-card">
    <header className="flex items-center gap-2 border-b px-4 py-3"><Icon className="h-5 w-5 text-primary" /><h2 className="font-semibold">{group === "obstetrica" ? "Obstetrícia / Maternidade" : "Pediatria / Neonatologia"}</h2><span className="ml-auto font-mono text-sm text-muted-foreground">{items.length}</span></header>
    <div className="space-y-4 p-3"><QueueGroup title="Aguardando classificação" items={triage} now={now} onSelect={onSelect} /><QueueGroup title="Fila médica por gravidade" items={medical} now={now} onSelect={onSelect} numbered /><QueueGroup title="Em atendimento / reavaliação" items={inCare} now={now} onSelect={onSelect} /></div>
  </section>;
}

function QueueGroup({ title, items, now, onSelect, numbered }: { title: string; items: Encounter[]; now: number; onSelect: (encounter: Encounter) => void; numbered?: boolean }) {
  return <div><h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title} <span className="font-mono">({items.length})</span></h3>{items.length === 0 ? <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">Ninguém aqui</p> : <ul className="space-y-2">{items.map((encounter, index) => <QueueCard key={encounter.id} encounter={encounter} now={now} onSelect={onSelect} position={numbered ? index + 1 : undefined} />)}</ul>}</div>;
}

function QueueCard({ encounter, now, onSelect, position }: { encounter: Encounter; now: number; onSelect: (encounter: Encounter) => void; position?: number | undefined }) {
  const patient = useStore((state) => state.patients.find((item) => item.id === encounter.patientId));
  const profile = useStore((state) => state.profile);
  const navigate = useNavigate();
  const risk = encounter.triage?.risk;
  const wait = Math.max(0, Math.floor((now - Date.parse(encounter.openedAt)) / 60000));
  const maxWait = risk ? encounter.triage?.maxWait ?? TEMPO_PCACR[audienceFor(patient)][risk] : null;
  const overdue = encounter.status_fluxo === "AGUARDANDO_MEDICO" && maxWait != null && wait > maxWait;
  const flowchart = fluxogramaPorId(encounter.triage?.flowchart);
  const call = () => {
    try { callPatient(encounter.id); void navigate({ to: "/pacientes/$id", params: { id: encounter.patientId } }); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível chamar o paciente"); }
  };
  return <li className={cn("flex overflow-hidden rounded-md border bg-background", overdue && "animate-pulse ring-2 ring-destructive", (patient?.specialConditions?.length ?? 0) > 0 && "border-2 border-clinical")}>
    <RiskStripe risk={risk} />
    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
      {position && <span className="font-mono text-lg font-semibold text-muted-foreground">{position}</span>}
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate font-medium">{patient?.name}</span><span className="text-xs text-muted-foreground">{patient?.age}</span><SpecialConditionBadges patient={patient} /></div>
        <div className="truncate text-xs text-muted-foreground">{encounter.complaint}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs"><RiskBadge risk={risk} />{maxWait != null && <span className="text-muted-foreground">Limite: {maxWait === 0 ? "imediato" : `${maxWait} min`}</span>}<span className={cn("flex items-center gap-1 font-mono", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}><Clock className="h-3 w-3" />{wait} min</span></div>
        {flowchart && <details className="mt-2 text-xs"><summary className="cursor-pointer text-primary">PCACR · {flowchart.nome} · {encounter.triage?.descriptors?.length ?? 0} descritor(es)</summary><div className="mt-1 rounded-md border bg-muted/40 p-2"><div className="font-semibold">{PUBLICO_LABEL[flowchart.publico]}</div><ul className="mt-1 space-y-1">{encounter.triage?.descriptors?.map((id) => { const descriptor = descritorPorId(flowchart, id); return descriptor && <li key={id} className="flex items-center gap-1.5"><span className={cn("h-2 w-2 shrink-0 rounded-full", MANCHESTER[descriptor.cor].cls)} />{descriptor.texto}</li>; })}</ul></div></details>}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {encounter.status_fluxo === "AGUARDANDO_TRIAGEM" && <Button size="sm" disabled={!can(profile, "triagem")} onClick={() => onSelect(encounter)}>Classificar</Button>}
        {encounter.status_fluxo === "AGUARDANDO_MEDICO" && <><Button size="sm" disabled={!can(profile, "prescrever")} onClick={call}>Chamar</Button><Button size="sm" variant="ghost" disabled={!can(profile, "triagem")} onClick={() => onSelect(encounter)}>Reclassificar</Button></>}
        {encounter.status_fluxo === "EM_ATENDIMENTO_MEDICO" && <Button size="sm" variant="secondary" asChild><Link to="/pacientes/$id" params={{ id: encounter.patientId }}>Abrir</Link></Button>}
        {encounter.status_fluxo === "EM_OBSERVACAO_REAVALIACAO" && <Button size="sm" variant="secondary" disabled={!can(profile, "prescrever")} onClick={call}>Reavaliar</Button>}
      </div>
    </div>
  </li>;
}

function TriageForm({ encounter, onDone }: { encounter: Encounter; onDone: () => void }) {
  const patient = useStore((state) => state.patients.find((item) => item.id === encounter.patientId));
  const previous = encounter.triage;
  const [f, setF] = useState({
    pas: previous?.vital.pas ? String(previous.vital.pas) : "", pad: previous?.vital.pad ? String(previous.vital.pad) : "",
    fc: previous?.vital.fc ? String(previous.vital.fc) : "", fr: previous?.vital.fr ? String(previous.vital.fr) : "",
    tax: previous?.vital.tax ? String(previous.vital.tax) : "", sat: previous?.vital.sat ? String(previous.vital.sat) : "", dor: previous ? String(previous.vital.dor) : "",
    weight: previous?.weight ? String(previous.weight) : patient?.weight ? String(patient.weight) : "", allergies: previous?.allergies.join(", ") ?? patient?.allergies.join(", ") ?? "",
    ig: previous?.ig ?? patient?.ig ?? "", dum: previous?.dum ?? patient?.dum ?? "", bcf: previous?.bcf ?? "", contractions: previous?.contractions ?? "",
    fluid: previous?.fluid ?? "Não", bleeding: previous?.bleeding ?? "Ausente", height: previous?.height ?? "", head: previous?.head ?? "",
    guardian: previous?.guardian ?? patient?.guardian ?? "", complaint: previous?.complaint ?? encounter.complaint,
  });
  const [risk, setRisk] = useState<Manchester>(previous?.risk ?? "verde");
  const [flowchartId, setFlowchartId] = useState(previous?.flowchart ?? "");
  const [descriptors, setDescriptors] = useState<string[]>(previous?.descriptors ?? []);
  const obstetric = isObstetric(patient);
  const audience: Publico = obstetric ? "obstetricia" : "pediatria";
  const flowcharts = FLUXOGRAMAS.filter((flowchart) => flowchart.publico === audience);
  const currentFlowchart = fluxogramaPorId(flowchartId);
  const suggestion = sugerirCorPCACR(flowchartId, descriptors);
  const effectiveRisk = suggestion?.cor ?? risk;

  const save = () => {
    try {
      const number = (key: keyof typeof f) => Number(f[key].replace(",", "."));
      completeTriage(encounter.id, {
        risk: effectiveRisk, weight: number("weight"),
        vital: { time: new Date().toLocaleTimeString("pt-BR"), pas: number("pas"), pad: number("pad"), fc: number("fc"), fr: number("fr"), tax: number("tax"), sat: number("sat"), dor: number("dor"), ingesta: 0, diurese: 0, vomitos: 0 },
        allergies: f.allergies.split(",").map((item) => item.trim()).filter(Boolean), ig: f.ig, dum: f.dum, bcf: f.bcf,
        contractions: f.contractions, fluid: f.fluid, bleeding: f.bleeding, height: f.height, head: f.head, guardian: f.guardian, complaint: f.complaint,
        flowchart: flowchartId, descriptors, maxWait: suggestion?.tempoMax ?? TEMPO_PCACR[audience][effectiveRisk],
      });
      toast.success(previous ? "Reclassificação registrada" : "Triagem concluída · paciente enviado ao médico"); onDone();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível classificar"); }
  };

  const fields: [keyof typeof f, string][] = [
    ["pas", "PA sistólica"], ["pad", "PA diastólica"], ["fc", "FC"], ["fr", "FR"], ["tax", "Temperatura"], ["sat", "SatO2"], ["dor", "Dor (0–10)"],
    ["weight", obstetric ? "Peso (kg)" : "Peso atual (kg) *"], ["allergies", "Alergias (separar por vírgulas)"], ["complaint", "Queixa principal"],
    ...(obstetric ? [["ig", "Idade gestacional"], ["dum", "DUM"], ["bcf", "BCF"], ["contractions", "Dinâmica uterina"], ["fluid", "Perda de líquido"], ["bleeding", "Sangramento"]] as [keyof typeof f, string][] : [["height", "Estatura (cm)"], ["head", "Perímetro cefálico"], ["guardian", "Responsável legal"]] as [keyof typeof f, string][]),
  ];

  return <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-5">
    <section><h2 className="mb-2 font-semibold">Sinais vitais e dados assistenciais</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fields.map(([key, label]) => <label key={key} className="grid gap-1 text-xs">{label}<Input value={f[key]} onChange={(event) => setF((current) => ({ ...current, [key]: event.target.value }))} required={["pas", "pad", "fc", "fr", "tax", "sat", "dor", "complaint"].includes(key) || (!obstetric && ["weight", "guardian"].includes(key))} /></label>)}</div></section>
    <section className="rounded-lg border bg-card p-4"><h2 className="font-semibold">Fluxograma PCACR · {PUBLICO_LABEL[audience]}</h2><p className="mb-3 text-xs text-muted-foreground">Selecione a queixa e marque todos os descritores presentes. A cor mais grave é aplicada automaticamente.</p>
      <div className="mb-4 flex flex-wrap gap-2">{flowcharts.map((flowchart) => <Button type="button" variant={flowchartId === flowchart.id ? "default" : "outline"} size="sm" key={flowchart.id} onClick={() => { setFlowchartId(flowchart.id); setDescriptors([]); }}>{flowchart.nome}</Button>)}</div>
      {currentFlowchart && <div className="grid gap-1.5 md:grid-cols-2">{currentFlowchart.descritores.map((descriptor) => <label key={descriptor.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted"><Checkbox checked={descriptors.includes(descriptor.id)} onCheckedChange={(checked) => setDescriptors((current) => checked ? [...current, descriptor.id] : current.filter((id) => id !== descriptor.id))} /><span className={cn("h-3 w-3 shrink-0 rounded-full", MANCHESTER[descriptor.cor].cls)} />{descriptor.texto}</label>)}</div>}
      {suggestion && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm"><RiskBadge risk={suggestion.cor} /><span>Classificação calculada pelo PCACR · espera máxima: <b>{suggestion.tempoMax === 0 ? "imediata" : `${suggestion.tempoMax} min`}</b></span></div>}
    </section>
    <section><h2 className="mb-2 font-semibold">Classificação de risco</h2><div className="grid gap-2 sm:grid-cols-3 md:grid-cols-5">{RISKS.map((item) => <Button type="button" variant="outline" key={item} onClick={() => { setRisk(item); setFlowchartId(""); setDescriptors([]); }} className={cn("h-auto flex-col items-start px-3 py-3 whitespace-normal", MANCHESTER[item].cls, effectiveRisk === item && "ring-2 ring-ring ring-offset-2")}><b className="uppercase">{item}</b><span className="text-xs">{MANCHESTER[item].label}</span></Button>)}</div>{suggestion && <p className="mt-2 text-xs text-muted-foreground">Para escolher outra cor manualmente, clique nela; os descritores serão limpos.</p>}</section>
    <Button type="submit">{previous ? "Salvar reclassificação" : "Salvar triagem e liberar para médico"}</Button>
  </form>;
}
