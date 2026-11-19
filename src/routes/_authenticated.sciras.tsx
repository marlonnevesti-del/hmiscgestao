import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addIsolate, addScirasEvolution, closeInfectionCase, decideAntimicrobial, openInfectionCase, saveBundle, useStore } from "@/lib/hospital-store";
import { BUNDLES, MDR_ORGANISMS, PRECAUTIONS, bundleAdherence, scirasAlert, type BundleType } from "@/lib/sciras";
import type { Patient } from "@/lib/hospital-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sciras")({
  head: () => ({ meta: [
    { title: "SCIRAS / CCIH – Controle de Infecção – HMI Gestão" },
    { name: "description", content: "Vigilância de multirresistentes, liberação de antimicrobianos, bundles de prevenção e evolução SCIRAS." },
    { property: "og:title", content: "SCIRAS / CCIH – HMI Gestão" },
    { property: "og:description", content: "Controle de infecção hospitalar e antimicrobianos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Sciras,
});

const run = (fn: () => void, ok: string) => { try { fn(); toast.success(ok); return true; } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); return false; } };
const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const area = "min-h-20 w-full rounded-md border bg-background p-2 text-sm";

function PatientSelect({ value, onChange, patients }: { value: string; onChange: (v: string) => void; patients: Patient[] }) {
  return <select aria-label="Paciente" value={value} onChange={(e) => onChange(e.target.value)} className={sel}><option value="">Selecione o paciente…</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name} · Pront. {p.prontuario}</option>)}</select>;
}

function Sciras() {
  const patients = useStore((s) => s.patients);
  const encounters = useStore((s) => s.encounters);
  const opened = (id: string) => encounters.filter((e) => e.patientId === id).map((e) => e.openedAt);
  const pending = patients.flatMap((p) => p.prescriptions.filter((r) => r.atb?.status === "Aguardando SCIRAS").map((r) => ({ p, r })));
  const alerts = patients.map((p) => ({ p, a: scirasAlert(p, opened(p.id)) })).filter((x) => x.a.mdr || x.a.readmitted);
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2"><ShieldAlert className="h-6 w-6 text-destructive" /><div><h1 className="text-xl font-semibold">SCIRAS / CCIH</h1><p className="text-xs text-muted-foreground">Controle de infecção relacionada à assistência à saúde</p></div></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Alertas ativos" value={alerts.filter((x) => x.a.alert).length} hot />
        <Kpi label="Antimicrobianos aguardando parecer" value={pending.length} hot={pending.length > 0} />
        <Kpi label="Casos de infecção abertos" value={patients.reduce((n, p) => n + (p.sciras?.cases.filter((c) => c.status === "Aberto").length ?? 0), 0)} />
      </div>
      <Tabs defaultValue="vigilancia">
        <TabsList className="flex-wrap"><TabsTrigger value="vigilancia">Vigilância e alertas</TabsTrigger><TabsTrigger value="atb">Antimicrobianos ({pending.length})</TabsTrigger><TabsTrigger value="casos">Casos de infecção</TabsTrigger><TabsTrigger value="bundles">Bundles</TabsTrigger><TabsTrigger value="evolucao">Evolução SCIRAS</TabsTrigger></TabsList>
        <TabsContent value="vigilancia"><Vigilance patients={patients} alerts={alerts} /></TabsContent>
        <TabsContent value="atb"><Antimicrobials patients={patients} /></TabsContent>
        <TabsContent value="casos"><Cases patients={patients} /></TabsContent>
        <TabsContent value="bundles"><Bundles patients={patients} /></TabsContent>
        <TabsContent value="evolucao"><Evolution patients={patients} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
  return <div className={cn("rounded-lg border p-3", hot && value > 0 && "border-destructive bg-destructive/5")}><div className="text-xs text-muted-foreground">{label}</div><div className={cn("text-2xl font-bold", hot && value > 0 && "text-destructive")}>{value}</div></div>;
}

function Vigilance({ patients, alerts }: { patients: Patient[]; alerts: { p: Patient; a: ReturnType<typeof scirasAlert> }[] }) {
  const [pid, setPid] = useState(""); const [f, setF] = useState({ organism: MDR_ORGANISMS[0] as string, material: "", resistance: "", precaution: "Contato" });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border p-3">
        <h2 className="mb-2 font-semibold">Pacientes em vigilância</h2>
        {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum paciente com microrganismo multirresistente ou reinternação recente.</p> :
          <div className="space-y-2">{alerts.map(({ p, a }) => (
            <div key={p.id} className={cn("rounded-md border p-2 text-sm", a.alert && "border-destructive bg-destructive/5")}>
              <div className="flex items-center justify-between gap-2"><Link to="/pacientes/$id" params={{ id: p.id }} className="font-medium hover:underline">{p.name}</Link><span className="text-xs text-muted-foreground">Pront. {p.prontuario} · {p.bed || "sem leito"}</span></div>
              {a.alert && <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Reinternação &lt; 6 meses com microrganismo multirresistente</div>}
              {!a.alert && a.readmitted && <div className="mt-1 text-xs text-muted-foreground">Reinternação &lt; 6 meses</div>}
              {p.sciras?.isolates.map((i) => <div key={i.id} className="mt-1 text-xs"><span className="rounded bg-destructive px-1.5 py-0.5 font-semibold text-destructive-foreground">{i.organism.split(" – ")[0]}</span> {i.material} · Precaução {i.precaution} · {i.at}{i.resistance && ` · ${i.resistance}`}</div>)}
            </div>))}</div>}
      </section>
      <section className="space-y-2 rounded-lg border p-3">
        <h2 className="font-semibold">Registrar resultado microbiológico</h2>
        <PatientSelect value={pid} onChange={setPid} patients={patients} />
        <select aria-label="Microrganismo" value={f.organism} onChange={(e) => setF({ ...f, organism: e.target.value })} className={sel}>{MDR_ORGANISMS.map((o) => <option key={o}>{o}</option>)}</select>
        <Input placeholder="Material (hemocultura, urocultura, swab…)" value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} />
        <Input placeholder="Perfil de resistência / antibiograma" value={f.resistance} onChange={(e) => setF({ ...f, resistance: e.target.value })} />
        <select aria-label="Precaução" value={f.precaution} onChange={(e) => setF({ ...f, precaution: e.target.value })} className={sel}>{PRECAUTIONS.map((o) => <option key={o}>{o}</option>)}</select>
        <Button className="w-full" disabled={!pid} onClick={() => run(() => addIsolate(pid, f), "Resultado registrado e alerta ativado") && setF({ ...f, material: "", resistance: "" })}>Registrar</Button>
      </section>
    </div>
  );
}

function Antimicrobials({ patients }: { patients: Patient[] }) {
  const [form, setForm] = useState<Record<string, { days: string; note: string }>>({});
  const rows = patients.flatMap((p) => p.prescriptions.filter((r) => r.atb).map((r) => ({ p, r })));
  const pending = rows.filter((x) => x.r.atb!.status === "Aguardando SCIRAS");
  const history = rows.filter((x) => x.r.atb!.status !== "Aguardando SCIRAS");
  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-3">
        <h2 className="mb-2 font-semibold">Solicitações aguardando parecer do infectologista</h2>
        {pending.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p> : pending.map(({ p, r }) => { const a = r.atb!; const v = form[r.id] ?? { days: String(a.days), note: "" }; const set = (x: Partial<typeof v>) => setForm({ ...form, [r.id]: { ...v, ...x } }); return (
          <div key={r.id} className="mb-3 rounded-md border border-destructive/40 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><div><span className="font-semibold">{r.item}</span> · {a.dose} {a.interval}</div><span className="text-xs text-muted-foreground">{p.name} · solicitado por {a.requestedBy} em {a.requestedAt}</span></div>
            <div className="mt-1 grid gap-1 text-xs sm:grid-cols-2"><div>Peso: {a.weight} kg</div><div>Sinais vitais: {a.vitals}</div><div>Foco: {a.focus}</div><div>Tempo previsto: {a.days} dias</div><div className="sm:col-span-2">Justificativa: {a.justification}</div></div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr_auto_auto]">
              <Input aria-label="Dias autorizados" value={v.days} onChange={(e) => set({ days: e.target.value })} placeholder="Dias" />
              <Input aria-label="Parecer" value={v.note} onChange={(e) => set({ note: e.target.value })} placeholder="Parecer / orientação (obrigatório)" />
              <Button onClick={() => run(() => decideAntimicrobial(p.id, r.id, true, parseInt(v.days) || 0, v.note), "Antimicrobiano autorizado – liberado para a farmácia")}>Autorizar</Button>
              <Button variant="destructive" onClick={() => run(() => decideAntimicrobial(p.id, r.id, false, 0, v.note), "Antimicrobiano negado")}>Negar</Button>
            </div>
          </div>); })}
      </section>
      <section className="overflow-x-auto rounded-lg border p-3">
        <h2 className="mb-2 font-semibold">Histórico de antibioticoterapia</h2>
        <table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-1">Paciente</th><th>Antimicrobiano</th><th>Dose / intervalo</th><th>Foco</th><th>Solicitado</th><th>Situação</th><th>Parecer</th></tr></thead>
          <tbody>{history.map(({ p, r }) => { const a = r.atb!; return <tr key={r.id} className="border-t"><td className="py-1">{p.name}</td><td>{r.item}</td><td>{a.dose} {a.interval}</td><td>{a.focus}</td><td>{a.requestedAt} · {a.requestedBy}</td><td className={cn("font-semibold", a.status === "Negado" && "text-destructive")}>{a.status}{a.authorizedDays ? ` · ${a.authorizedDays} dias` : ""}</td><td>{a.decisionNote ? `${a.decisionNote} (${a.decidedBy}, ${a.decidedAt})` : "—"}</td></tr>; })}
            {history.length === 0 && <tr><td colSpan={7} className="py-2 text-muted-foreground">Sem registros.</td></tr>}</tbody></table>
      </section>
    </div>
  );
}

const CLASSES = ["IRAS – confirmada (critério ANVISA)", "Infecção comunitária", "Colonização", "Descartado"];
function Cases({ patients }: { patients: Patient[] }) {
  const [pid, setPid] = useState(""); const [site, setSite] = useState(""); const [notes, setNotes] = useState(""); const [cls, setCls] = useState<Record<string, string>>({});
  const cases = patients.flatMap((p) => (p.sciras?.cases ?? []).map((c) => ({ p, c })));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="rounded-lg border p-3"><h2 className="mb-2 font-semibold">Casos em acompanhamento</h2>
        {cases.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum caso registrado.</p> : cases.map(({ p, c }) => (
          <div key={c.id} className="mb-2 rounded-md border p-2 text-sm">
            <div className="flex justify-between gap-2"><span className="font-medium">{p.name} · {c.site}</span><span className={cn("text-xs font-semibold", c.status === "Aberto" ? "text-destructive" : "text-muted-foreground")}>{c.status}</span></div>
            <div className="text-xs text-muted-foreground">Aberto em {c.openedAt} por {c.openedBy}{c.notes && ` · ${c.notes}`}</div>
            {c.status === "Aberto" ? <div className="mt-2 flex gap-2"><select aria-label="Classificação" value={cls[c.id] ?? ""} onChange={(e) => setCls({ ...cls, [c.id]: e.target.value })} className={sel}><option value="">Classificação final…</option>{CLASSES.map((x) => <option key={x}>{x}</option>)}</select><Button onClick={() => run(() => closeInfectionCase(p.id, c.id, cls[c.id] ?? ""), "Caso encerrado")}>Encerrar</Button></div>
              : <div className="text-xs">Encerrado: {c.classification} · {c.closedAt} · {c.closedBy}</div>}
          </div>))}
      </section>
      <section className="space-y-2 rounded-lg border p-3"><h2 className="font-semibold">Abrir investigação</h2>
        <PatientSelect value={pid} onChange={setPid} patients={patients} />
        <Input placeholder="Sítio (ex.: corrente sanguínea, sítio cirúrgico)" value={site} onChange={(e) => setSite(e.target.value)} />
        <textarea className={area} placeholder="Observações / dados microbiológicos" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="w-full" disabled={!pid} onClick={() => { if (run(() => openInfectionCase(pid, site, notes), "Investigação aberta")) { setSite(""); setNotes(""); } }}>Abrir caso</Button>
      </section>
    </div>
  );
}

function Bundles({ patients }: { patients: Patient[] }) {
  const [pid, setPid] = useState(""); const [type, setType] = useState<BundleType>("PAV"); const [items, setItems] = useState<Record<string, boolean>>({});
  const all = patients.flatMap((p) => (p.sciras?.bundles ?? []).map((b) => ({ p, b })));
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <section className="space-y-2 rounded-lg border p-3"><h2 className="font-semibold">Checklist diário</h2>
        <PatientSelect value={pid} onChange={setPid} patients={patients} />
        <select aria-label="Bundle" value={type} onChange={(e) => { setType(e.target.value as BundleType); setItems({}); }} className={sel}>{(Object.keys(BUNDLES) as BundleType[]).map((b) => <option key={b}>{b}</option>)}</select>
        {BUNDLES[type].map((it) => <label key={it} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!items[it]} onChange={(e) => setItems({ ...items, [it]: e.target.checked })} />{it}</label>)}
        <Button className="w-full" disabled={!pid} onClick={() => { if (run(() => saveBundle(pid, type, items), "Bundle registrado")) setItems({}); }}>Registrar checklist</Button>
      </section>
      <section className="overflow-x-auto rounded-lg border p-3"><h2 className="mb-2 font-semibold">Avaliações registradas</h2>
        <table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-1">Data</th><th>Paciente</th><th>Bundle</th><th>Adesão</th><th>Responsável</th></tr></thead>
          <tbody>{all.map(({ p, b }) => { const pct = bundleAdherence(b); return <tr key={b.id} className="border-t"><td className="py-1">{b.at}</td><td>{p.name}</td><td>{b.type}</td><td className={cn("font-semibold", pct < 100 && "text-destructive")}>{pct}%</td><td>{b.by}</td></tr>; })}
            {all.length === 0 && <tr><td colSpan={5} className="py-2 text-muted-foreground">Sem avaliações.</td></tr>}</tbody></table>
      </section>
    </div>
  );
}

function Evolution({ patients }: { patients: Patient[] }) {
  const [pid, setPid] = useState("");
  const p = patients.find((x) => x.id === pid);
  const atbs = p?.prescriptions.filter((r) => r.atb).map((r) => `${r.item} (${r.atb!.status})`).join("; ") || "nenhum";
  const isos = p?.sciras?.isolates.map((i) => `${i.organism.split(" – ")[0]} em ${i.material}`).join("; ") || "nenhum";
  const template = p ? `Antimicrobianos em uso: ${atbs}\nCulturas / isolados: ${isos}\nFoco infeccioso: \nConduta (manter / desescalonar / suspender): \nPrecaução / isolamento indicado: ` : "";
  const [text, setText] = useState("");
  return (
    <section className="space-y-2 rounded-lg border p-3">
      <h2 className="font-semibold">Evolução padrão SCIRAS</h2>
      <PatientSelect value={pid} onChange={(v) => { setPid(v); setText(""); }} patients={patients} />
      {p && <>
        <textarea aria-label="Evolução SCIRAS" className={cn(area, "min-h-40 font-mono text-xs")} value={text || template} onChange={(e) => setText(e.target.value)} />
        <Button onClick={() => { if (run(() => addScirasEvolution(p.id, text || template), "Evolução SCIRAS registrada no prontuário")) setText(""); }}>Assinar e registrar no prontuário</Button>
      </>}
    </section>
  );
}
