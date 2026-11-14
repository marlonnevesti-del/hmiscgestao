import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { doseByWeight, getPatient, WARDS, type Patient, type Professional } from "@/lib/hospital-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pacientes/$id")({
  loader: ({ params }) => { const p = getPatient(params.id); if (!p) throw notFound(); return { name: p.name }; },
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData ? `PEP · ${loaderData.name} – HMI Gestão` : "Prontuário – HMI Gestão" },
    { name: "description", content: "Prontuário eletrônico do paciente: evolução, prescrição, sinais vitais e partograma." },
    { property: "og:title", content: "Prontuário eletrônico – HMI Gestão" },
    { property: "og:description", content: "Evolução, prescrição, sinais vitais e partograma." },
  ] }),
  component: PEP,
});

function PEP() {
  const { id } = Route.useParams();
  const p = getPatient(id)!;
  const obst = p.type === "gestante";
  const showNB = p.type === "neonato" || !!p.newborn;
  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-5 -mt-5 border-b bg-card px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-primary-foreground", obst || p.type === "puerpera" ? "bg-maternal" : "bg-primary")}>{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
          <div className="min-w-0">
            <div className="text-lg font-semibold">{p.name}</div>
            <div className="text-xs text-muted-foreground">Pront. {p.prontuario} · {p.age}{p.ig ? ` · IG ${p.ig}` : ""} · {p.weight} kg{p.guardian ? ` · Resp.: ${p.guardian}` : ""}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.allergies.length > 0 ? <span className="pulse-alert rounded-md bg-maternal px-2 py-1 text-xs font-bold text-primary-foreground">ALERGIA: {p.allergies.join(", ")}</span> : <span className="rounded-md bg-muted px-2 py-1 text-xs">Sem alergias conhecidas</span>}
            {p.risks.map((r) => <span key={r} className={cn("rounded-full px-2 py-1 text-[10px] font-semibold text-foreground", r === "Queda" ? "bg-mt-yellow" : r === "Alergia" ? "bg-maternal-soft" : "bg-mt-orange/40")}>Pulseira: {r}</span>)}
          </div>
          <div className="ml-auto text-right text-xs"><div className="font-mono font-semibold">{p.bed}</div><div className="text-muted-foreground">{WARDS.find((w) => w.id === p.ward)?.name} · {p.insurance}</div></div>
        </div>
        <div className="mt-1 text-xs"><span className="font-medium">Diagnóstico:</span> {p.diagnosis}</div>
      </div>
      <Tabs defaultValue="resumo">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumo">Resumo & Evolução</TabsTrigger>
          <TabsTrigger value="prescricao">Prescrição</TabsTrigger>
          <TabsTrigger value="sinais">Sinais vitais & BH</TabsTrigger>
          {obst && <TabsTrigger value="partograma">Obstetrícia / Partograma</TabsTrigger>}
          {showNB && <TabsTrigger value="rn">Recém-nascido</TabsTrigger>}
        </TabsList>
        <TabsContent value="resumo"><Evolucao p={p} /></TabsContent>
        <TabsContent value="prescricao"><Prescricao p={p} /></TabsContent>
        <TabsContent value="sinais"><Sinais p={p} /></TabsContent>
        {obst && <TabsContent value="partograma"><Partograma p={p} /></TabsContent>}
        {showNB && <TabsContent value="rn"><RN p={p} /></TabsContent>}
      </Tabs>
    </div>
  );
}

const Card = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => <div className={cn("rounded-lg border bg-card p-4", className)}><h3 className="mb-3 text-sm font-semibold">{title}</h3>{children}</div>;

function Evolucao({ p }: { p: Patient }) {
  const [f, setF] = useState<Professional | "Todos">("Todos");
  const [items, setItems] = useState(p.evolutions);
  const [text, setText] = useState("");
  const list = items.filter((e) => f === "Todos" || e.prof === f);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card title="Linha do tempo">
        <div className="mb-3 flex gap-1">{(["Todos", "Médico", "Enfermagem", "Fisioterapia"] as const).map((x) => <button key={x} onClick={() => setF(x)} className={cn("rounded-full border px-3 py-1 text-xs", f === x && "bg-primary text-primary-foreground")}>{x}</button>)}</div>
        <ol className="space-y-3 border-l-2 pl-4">
          {list.map((e, i) => (
            <li key={i} className="relative"><span className={cn("absolute -left-[23px] top-1 h-3 w-3 rounded-full", e.prof === "Médico" ? "bg-primary" : e.prof === "Enfermagem" ? "bg-clinical" : "bg-bed-isolation")} />
              <div className="text-xs text-muted-foreground"><span className="font-mono">{e.time}</span> · {e.prof} · {e.author}</div><p className="text-sm">{e.text}</p></li>
          ))}
        </ol>
      </Card>
      <Card title="Nova evolução">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full rounded-md border bg-background p-2 text-sm" placeholder="Subjetivo, objetivo, avaliação, plano…" />
        <button disabled={!text.trim()} onClick={() => { setItems([{ time: "14/11 agora", prof: "Médico", author: "Dra. Helena Prado", text }, ...items]); setText(""); }} className="mt-2 w-full rounded-md bg-clinical py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">Registrar evolução</button>
      </Card>
    </div>
  );
}

function Prescricao({ p }: { p: Patient }) {
  const ped = p.type === "pediatria" || p.type === "neonato";
  const [mgkg, setMgkg] = useState(15); const [max, setMax] = useState(500);
  const cats = ["Dieta", "Hidratação", "Medicamento", "Cuidados", "Exames"] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card title="Prescrição vigente – 14/11/2026">
        {cats.map((c) => { const it = p.prescriptions.filter((x) => x.cat === c); return (
          <div key={c} className="mb-3"><div className="mb-1 text-xs font-semibold uppercase text-primary">{c}</div>
            {it.length === 0 ? <div className="text-xs text-muted-foreground">—</div> : it.map((x, i) => (
              <div key={i} className="flex items-center justify-between border-b py-1.5 text-sm"><div><span className="font-medium">{x.item}</span> <span className="text-muted-foreground">· {x.posologia}</span></div>
                <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", x.status === "Ativo" ? "bg-clinical-soft text-clinical" : x.status === "Checado" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground line-through")}>{x.status}</span></div>
            ))}</div>); })}
      </Card>
      <Card title={ped ? "Calculadora de dose (mg/kg)" : "Calculadora de dose"}>
        <div className="space-y-2 text-sm">
          <div className="text-xs text-muted-foreground">Peso do paciente: <b className="text-foreground">{p.weight} kg</b></div>
          <label className="block text-xs">Dose (mg/kg)<input type="number" value={mgkg} onChange={(e) => setMgkg(+e.target.value)} className="mt-1 h-8 w-full rounded-md border bg-background px-2" /></label>
          <label className="block text-xs">Dose máxima (mg)<input type="number" value={max} onChange={(e) => setMax(+e.target.value)} className="mt-1 h-8 w-full rounded-md border bg-background px-2" /></label>
          <div className="rounded-md bg-clinical-soft p-3 text-center"><div className="text-xs text-muted-foreground">Dose calculada</div><div className="font-mono text-2xl font-semibold text-clinical">{doseByWeight(mgkg, p.weight, max)} mg</div>{mgkg * p.weight > max && <div className="text-[10px] text-maternal">Limitada à dose máxima</div>}</div>
        </div>
      </Card>
    </div>
  );
}

function Sinais({ p }: { p: Patient }) {
  const data = p.vitals.map((v) => ({ ...v, balanco: v.ingest - v.elim }));
  const total = data.reduce((s, v) => s + v.balanco, 0);
  return (
    <div className="space-y-4">
      <Card title="Controle de sinais vitais e balanço hídrico">
        <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr>{["Hora", "PA", "FC", "FR", "Tax", "SatO2", "Dor", "Ganhos (mL)", "Perdas (mL)", "Balanço"].map((h) => <th key={h} className="py-1">{h}</th>)}</tr></thead>
          <tbody className="font-mono">{data.map((v) => <tr key={v.time} className="border-t"><td className="py-1.5">{v.time}</td><td>{v.pas}/{v.pad}</td><td>{v.fc}</td><td>{v.fr}</td><td className={cn(v.tax >= 37.8 && "font-bold text-maternal")}>{v.tax.toFixed(1)}</td><td>{v.sat}%</td><td>{v.dor}</td><td>{v.ingest}</td><td>{v.elim}</td><td>{v.balanco > 0 ? "+" : ""}{v.balanco}</td></tr>)}</tbody>
        </table>
        <div className="mt-2 text-right text-sm">Balanço acumulado: <b className="font-mono text-clinical">{total > 0 ? "+" : ""}{total} mL</b></div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Curva térmica"><ResponsiveContainer width="100%" height={220}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="time" fontSize={11} /><YAxis domain={[35, 40]} fontSize={11} /><Tooltip /><Line dataKey="tax" name="Tax °C" stroke="var(--maternal)" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
        <Card title="Curva pressórica"><ResponsiveContainer width="100%" height={220}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="time" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Line dataKey="pas" name="PAS" stroke="var(--primary)" strokeWidth={2} /><Line dataKey="pad" name="PAD" stroke="var(--clinical)" strokeWidth={2} /><Line dataKey="fc" name="FC" stroke="var(--chart-4)" strokeDasharray="4 2" /></LineChart></ResponsiveContainer></Card>
      </div>
    </div>
  );
}

function Partograma({ p }: { p: Patient }) {
  const [pts, setPts] = useState(p.partograma ?? []);
  const [d, setD] = useState({ dilat: 8, altura: 0, bcf: 140, contr: 4 });
  const last = pts[pts.length - 1];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card title="Partograma">
        {pts.length === 0 ? <p className="text-sm text-muted-foreground">Sem registros — paciente fora de trabalho de parto ativo.</p> : <>
          <ResponsiveContainer width="100%" height={260}><LineChart data={pts}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} fontSize={11} /><YAxis yAxisId="d" domain={[0, 10]} fontSize={11} /><YAxis yAxisId="a" orientation="right" domain={[-4, 4]} reversed fontSize={11} /><Tooltip /><Legend />
            <Line yAxisId="d" dataKey="dilat" name="Dilatação (cm)" stroke="var(--maternal)" strokeWidth={2} /><Line yAxisId="a" dataKey="altura" name="Altura apresentação (De Lee)" stroke="var(--primary)" strokeWidth={2} /></LineChart></ResponsiveContainer>
          <ResponsiveContainer width="100%" height={140}><LineChart data={pts}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} fontSize={11} /><YAxis domain={[100, 180]} fontSize={11} /><Tooltip /><Line dataKey="bcf" name="BCF (bpm)" stroke="var(--clinical)" strokeWidth={2} /></LineChart></ResponsiveContainer>
          <div className="mt-2 flex gap-1">{pts.map((x) => <div key={x.hour} className="flex-1 rounded bg-maternal-soft p-1 text-center text-[10px]"><div className="font-mono font-semibold text-maternal">{x.contr}/10'</div><div>{x.hour}h</div></div>)}</div>
        </>}
      </Card>
      <Card title="Registrar avaliação">
        {last && <div className="mb-2 text-xs text-muted-foreground">Último: {last.dilat} cm · {last.altura} · BCF {last.bcf}</div>}
        {([["dilat", "Dilatação (cm)"], ["altura", "Altura (De Lee)"], ["bcf", "BCF (bpm)"], ["contr", "Contrações/10min"]] as const).map(([k, l]) => (
          <label key={k} className="mb-2 block text-xs">{l}<input type="number" value={d[k]} onChange={(e) => setD({ ...d, [k]: +e.target.value })} className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm" /></label>
        ))}
        <button onClick={() => setPts([...pts, { hour: (last?.hour ?? -1) + 1, ...d }])} className="w-full rounded-md bg-maternal py-2 text-sm font-medium text-primary-foreground">Adicionar ao partograma</button>
      </Card>
    </div>
  );
}

function RN({ p }: { p: Patient }) {
  const nb = p.newborn;
  if (!nb) return <Card title="Recém-nascido"><p className="text-sm text-muted-foreground">Sem registro de sala de parto.</p></Card>;
  const link = nb.motherId ? getPatient(nb.motherId) : nb.babyIds?.map(getPatient)[0];
  const Box = ({ l, v, s }: { l: string; v: string | number; s?: string }) => <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="font-mono text-2xl font-semibold text-primary">{v}</div>{s && <div className="text-[10px] text-muted-foreground">{s}</div>}</div>;
  return (
    <div className="space-y-4">
      <Card title="Boletim de sala de parto">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Box l="Apgar 1º min" v={nb.apgar1} s={nb.apgar1 < 7 ? "Asfixia leve/moderada" : "Boa vitalidade"} /><Box l="Apgar 5º min" v={nb.apgar5} />
          <Box l="Peso ao nascer" v={`${nb.pesoNascer} g`} s={nb.pesoNascer < 2500 ? "Baixo peso" : "Adequado"} /><Box l="Tipagem sanguínea" v={nb.tipagem} />
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Vacinas e profilaxias iniciais">
          {["Vitamina K", "Hepatite B", "BCG"].map((x) => <div key={x} className="flex justify-between border-b py-1.5 text-sm">{x}<span className={cn("text-xs font-semibold", nb.vacinas.includes(x) ? "text-clinical" : "text-muted-foreground")}>{nb.vacinas.includes(x) ? "Aplicada" : "Pendente"}</span></div>)}
        </Card>
        <Card title={nb.motherId ? "Vínculo: prontuário da mãe" : "Vínculo: prontuário do RN"}>
          {link ? <Link to="/pacientes/$id" params={{ id: link.id }} className="block rounded-md border p-3 hover:bg-muted"><div className="font-medium">{link.name}</div><div className="text-xs text-muted-foreground">Pront. {link.prontuario} · {link.bed} · {link.diagnosis}</div></Link>
            : <p className="text-sm text-muted-foreground">Mãe: {p.motherName} (internada em outra unidade)</p>}
        </Card>
      </div>
    </div>
  );
}
