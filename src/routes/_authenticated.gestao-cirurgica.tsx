import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DESTINATIONS, PROCEDURES, can } from "@/lib/hospital-data";
import { getState, setState, useStore } from "@/lib/hospital-store";
import { ALDRETE_ITEMS, CO_BEDS, EMPTY_OBST, EMPTY_SAEP, POSITIONS, SAFE_BIRTH, SRPA_BEDS, SUSPENSION_REASONS, aldreteDischarge, aldreteScore, ccReport, coReport, countMismatch, minutesBetween, nextVitalDue, robson, suspensionIssue, toCsv, type Aldrete, type Obstetric, type Saep, type SurgX } from "@/lib/surgical-center";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/gestao-cirurgica")({
  head: () => ({ meta: [
    { title: "SRPA, Centro Obstétrico e Indicadores – HMI Gestão" },
    { name: "description", content: "SAEP, suspensões, SRPA com Aldrete-Kroulik, leitos do Centro Obstétrico, Robson e indicadores do CC e CME." },
    { property: "og:title", content: "SRPA, Centro Obstétrico e Indicadores – HMI Gestão" },
    { property: "og:description", content: "Recuperação pós-anestésica, parto seguro, Robson e relatórios cirúrgicos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Gestao,
});

const now = () => new Date().toISOString();
const who = () => getState().employeeName || "Colaborador";
const upd = (id: string, patch: (s: SurgX) => Partial<SurgX>) => setState((st) => ({ surgeries: st.surgeries.map((s) => (s.id === id ? { ...s, ...patch(s as SurgX) } : s)) }));
const sel = "h-8 rounded-md border bg-background px-2 text-xs";
const box = "rounded-lg border bg-card p-3";

function Gestao() {
  const profile = useStore((s) => s.profile);
  const ok = can(profile, "cirurgia");
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Gestão cirúrgica e obstétrica</h1><p className="text-sm text-muted-foreground">SAEP e suspensões · SRPA · Centro Obstétrico · CME · Indicadores</p></div>
      <Tabs defaultValue="cc">
        <TabsList className="flex-wrap"><TabsTrigger value="cc">Centro cirúrgico / SAEP</TabsTrigger><TabsTrigger value="srpa">SRPA (6 leitos)</TabsTrigger><TabsTrigger value="co">Centro obstétrico</TabsTrigger><TabsTrigger value="cme">CME instrumentais</TabsTrigger><TabsTrigger value="rel">Relatórios</TabsTrigger></TabsList>
        <TabsContent value="cc"><CcTab ok={ok} /></TabsContent>
        <TabsContent value="srpa"><SrpaTab ok={ok} /></TabsContent>
        <TabsContent value="co"><CoTab ok={ok} /></TabsContent>
        <TabsContent value="cme"><CmeTab ok={ok} /></TabsContent>
        <TabsContent value="rel"><Reports /></TabsContent>
      </Tabs>
    </div>
  );
}

function useDaySurgeries(day: string) {
  const all = useStore((s) => s.surgeries) as SurgX[];
  return all.filter((s) => (s.date ?? day) === day && !s.obstetric);
}

function CcTab({ ok }: { ok: boolean }) {
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const list = useDaySurgeries(day);
  const [id, setId] = useState<string>("");
  const s = list.find((x) => x.id === id);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-8 w-40" />
        <select aria-label="Cirurgia" className={sel} value={id} onChange={(e) => setId(e.target.value)}><option value="">Selecione a cirurgia…</option>{list.map((x) => <option key={x.id} value={x.id}>{x.room} · {x.start}h · {x.patient} · {x.type}{x.suspension ? " (SUSPENSA)" : ""}</option>)}</select></div>
      {!list.length && <p className="text-sm text-muted-foreground">Nenhuma cirurgia agendada no dia. Agende pelo Mapa Cirúrgico.</p>}
      {s && <div className="grid gap-3 lg:grid-cols-2">
        <Procedures s={s} ok={ok} /><SuspendBox s={s} ok={ok} />
        <div className="lg:col-span-2"><SaepForm key={s.id} s={s} ok={ok} /></div>
      </div>}
    </div>
  );
}

function Procedures({ s, ok }: { s: SurgX; ok: boolean }) {
  const [p, setP] = useState(PROCEDURES[0]!);
  const procs = s.procedures ?? [s.type];
  return <div className={box}><div className="mb-2 text-xs font-semibold uppercase text-primary">Procedimentos do agendamento</div>
    {procs.map((x, i) => <div key={i} className="flex justify-between text-sm"><span>{i + 1}. {x}</span>{ok && i > 0 && <button className="text-xs text-destructive" onClick={() => upd(s.id, () => ({ procedures: procs.filter((_, j) => j !== i) }))}>remover</button>}</div>)}
    {ok && <div className="mt-2 flex gap-1"><select className={cn(sel, "flex-1")} value={p} onChange={(e) => setP(e.target.value)}>{PROCEDURES.map((x) => <option key={x}>{x}</option>)}</select><Button size="sm" onClick={() => upd(s.id, () => ({ procedures: [...procs, p] }))}>Adicionar</Button></div>}
  </div>;
}

function SuspendBox({ s, ok }: { s: SurgX; ok: boolean }) {
  const [reason, setReason] = useState(""); const [just, setJust] = useState("");
  if (s.suspension) return <div className={cn(box, "border-destructive")}><div className="text-xs font-semibold uppercase text-destructive">Cirurgia suspensa</div><p className="text-sm">{s.suspension.reason}</p><p className="text-xs text-muted-foreground">{s.suspension.justification} — {s.suspension.by}, {new Date(s.suspension.at).toLocaleString("pt-BR")}</p></div>;
  const issue = suspensionIssue(reason, just);
  return <div className={box}><div className="mb-2 text-xs font-semibold uppercase text-primary">Suspender cirurgia</div>
    <select className={cn(sel, "w-full")} value={reason} onChange={(e) => setReason(e.target.value)} disabled={!ok}><option value="">Motivo…</option>{SUSPENSION_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
    <Textarea className="mt-2" placeholder="Justificativa obrigatória" value={just} onChange={(e) => setJust(e.target.value)} disabled={!ok} />
    <Button size="sm" variant="destructive" className="mt-2" disabled={!ok || !!issue} onClick={() => { if (!confirm("Tem certeza que deseja suspender esta cirurgia?")) return; upd(s.id, () => ({ suspension: { reason, justification: just.trim(), by: who(), at: now() } })); toast.success("Cirurgia suspensa"); }}>Suspender</Button>
    {issue && (reason || just) && <p className="mt-1 text-xs text-destructive">{issue}</p>}
  </div>;
}

function SaepForm({ s, ok }: { s: SurgX; ok: boolean }) {
  const [f, setF] = useState<Saep>(s.saep ?? EMPTY_SAEP);
  const set = (p: Partial<Saep>) => setF((x) => ({ ...x, ...p }));
  const phases = ["Inicial", "Pré-fechamento", "Final"] as const;
  const getC = (ph: (typeof phases)[number]) => f.counts.find((c) => c.phase === ph) ?? { phase: ph, gauze: 0, compresses: 0, instruments: 0 };
  const setC = (ph: (typeof phases)[number], k: "gauze" | "compresses" | "instruments", v: number) => set({ counts: [...f.counts.filter((c) => c.phase !== ph), { ...getC(ph), [k]: v }] });
  const mismatch = countMismatch(f);
  return <div className={box}><div className="mb-2 text-xs font-semibold uppercase text-primary">SAEP – Ficha de enfermagem perioperatória</div>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs">Posicionamento<select className={cn(sel, "w-full")} value={f.position} onChange={(e) => set({ position: e.target.value })}><option value="">—</option>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></label>
      <label className="text-xs">Proteção de proeminências ósseas<Input className="h-8" value={f.protections} onChange={(e) => set({ protections: e.target.value })} /></label>
      <label className="text-xs">Dispositivos invasivos (drenos, sondas, acessos)<Input className="h-8" value={f.devices} onChange={(e) => set({ devices: e.target.value })} /></label>
      <label className="text-xs">Antibioticoprofilaxia (SCIRAS) – fármaco / horário<div className="flex gap-1"><Input className="h-8" value={f.prophylaxisDrug} onChange={(e) => set({ prophylaxisDrug: e.target.value })} /><Input type="time" className="h-8 w-28" value={f.prophylaxisTime} onChange={(e) => set({ prophylaxisTime: e.target.value })} /></div></label>
    </div>
    <table className="mt-3 w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Contagem</th><th>Gazes</th><th>Compressas</th><th>Instrumentais</th></tr></thead><tbody>
      {phases.map((ph) => <tr key={ph}><td className="py-1">{ph}</td>{(["gauze", "compresses", "instruments"] as const).map((k) => <td key={k}><Input type="number" min={0} className="h-7 w-20" value={getC(ph)[k]} onChange={(e) => setC(ph, k, +e.target.value)} /></td>)}</tr>)}
    </tbody></table>
    <p className={cn("mt-1 text-xs", mismatch ? "text-destructive" : "text-clinical")}>{mismatch ?? "Contagem conferida."}</p>
    <Textarea className="mt-2" placeholder="Observações / tempos cirúrgicos registrados no mapa" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
    <Button size="sm" className="mt-2" disabled={!ok} onClick={() => { if (mismatch && !confirm(`${mismatch} Salvar mesmo assim?`)) return; upd(s.id, () => ({ saep: { ...f, by: who(), at: now() } })); toast.success("SAEP salva"); }}>Salvar SAEP</Button>
    {s.saep?.at && <span className="ml-2 text-xs text-muted-foreground">Salva por {s.saep.by} em {new Date(s.saep.at).toLocaleString("pt-BR")}</span>}
  </div>;
}

const FULL: Aldrete = { activity: 2, breathing: 2, circulation: 2, consciousness: 2, saturation: 2 };
function SrpaTab({ ok }: { ok: boolean }) {
  const all = useStore((s) => s.surgeries) as SurgX[];
  const occupied = (b: string) => all.find((s) => s.srpa?.bed === b && !s.srpa.outAt);
  const waiting = all.filter((s) => !s.srpa && !s.suspension && !s.obstetric && (s.status === "Em Sala" || s.status === "RPA"));
  const [pick, setPick] = useState("");
  return <div className="space-y-3">
    {ok && <div className="flex flex-wrap items-center gap-2 text-sm"><span>Admitir na SRPA:</span><select className={sel} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Paciente em sala…</option>{waiting.map((s) => <option key={s.id} value={s.id}>{s.patient} · {s.type}</option>)}</select>
      <select className={sel} id="srpa-bed" defaultValue="">{<option value="">Leito…</option>}{SRPA_BEDS.filter((b) => !occupied(b)).map((b) => <option key={b}>{b}</option>)}</select>
      <Button size="sm" onClick={() => { const bed = (document.getElementById("srpa-bed") as HTMLSelectElement).value; if (!pick || !bed) { toast.error("Selecione paciente e leito"); return; } upd(pick, () => ({ status: "RPA", srpa: { bed, inAt: now(), vitals: [] } })); setPick(""); toast.success(`Admitido no ${bed}`); }}>Admitir</Button></div>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{SRPA_BEDS.map((b) => { const s = occupied(b); return <div key={b} className={cn(box, s ? "border-primary" : "opacity-70")}><div className="flex justify-between text-sm font-semibold"><span>{b}</span><span className="text-xs text-muted-foreground">{s ? "Ocupado" : "Livre"}</span></div>{s && <SrpaBed s={s} ok={ok} />}</div>; })}</div>
  </div>;
}

function SrpaBed({ s, ok }: { s: SurgX; ok: boolean }) {
  const st = s.srpa!;
  const [a, setA] = useState<Aldrete>(st.vitals.at(-1)?.aldrete ?? FULL);
  const [v, setV] = useState({ pa: "", fc: "", spo2: "", pain: 0 });
  const [regional, setRegional] = useState(/raqui|peridural|bloqueio/i.test(s.report?.anesthesia ?? ""));
  const [dest, setDest] = useState(DESTINATIONS[2]!);
  const score = aldreteScore(a); const free = aldreteDischarge(a, regional);
  const due = nextVitalDue(st); const late = due.getTime() < Date.now();
  return <div className="mt-2 space-y-2 text-xs">
    <div>{s.patient} · {s.type}</div>
    <div className={late ? "font-semibold text-destructive" : "text-muted-foreground"}>Próximos sinais: {due.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{late ? " (atrasado)" : ""}</div>
    {!st.dischargeAt && ok && <>
      <div className="grid grid-cols-4 gap-1"><Input className="h-7" placeholder="PA" value={v.pa} onChange={(e) => setV({ ...v, pa: e.target.value })} /><Input className="h-7" placeholder="FC" value={v.fc} onChange={(e) => setV({ ...v, fc: e.target.value })} /><Input className="h-7" placeholder="SpO₂" value={v.spo2} onChange={(e) => setV({ ...v, spo2: e.target.value })} /><select className="h-7 rounded border bg-background text-xs" aria-label="Dor EVA" value={v.pain} onChange={(e) => setV({ ...v, pain: +e.target.value })}>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>EVA {i}</option>)}</select></div>
      {ALDRETE_ITEMS.map((it) => <label key={it.key} className="flex items-center justify-between gap-1">{it.label}<select className="h-7 w-40 rounded border bg-background text-xs" value={a[it.key]} onChange={(e) => setA({ ...a, [it.key]: +e.target.value })}>{it.options.map((o, i) => <option key={i} value={i}>{i} · {o}</option>)}</select></label>)}
      <label className="flex items-center gap-1"><input type="checkbox" checked={regional} onChange={(e) => setRegional(e.target.checked)} />Anestesia regional (alta com ≥ 8)</label>
      <div className={cn("rounded px-2 py-1 font-semibold", free ? "bg-bed-free text-primary-foreground" : "bg-mt-yellow text-foreground")}>Aldrete-Kroulik: {score}/10 · {free ? "Apto para alta anestésica" : "Manter em observação"}</div>
      <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => { upd(s.id, (x) => ({ srpa: { ...x.srpa!, vitals: [...x.srpa!.vitals, { ...v, aldrete: a, at: now(), by: who() }] } })); setV({ pa: "", fc: "", spo2: "", pain: 0 }); toast.success("Sinais registrados"); }}>Registrar sinais</Button>
        <select className="h-8 rounded border bg-background text-xs" value={dest} onChange={(e) => setDest(e.target.value)}>{DESTINATIONS.filter((d) => d !== "RPA").map((d) => <option key={d}>{d}</option>)}</select>
        <Button size="sm" disabled={!free} onClick={() => { if (!confirm(`Confirmar alta anestésica para ${dest}?`)) return; upd(s.id, (x) => ({ srpa: { ...x.srpa!, vitals: [...x.srpa!.vitals, { ...v, aldrete: a, at: now(), by: who() }], dischargeAt: now(), destination: dest, bedRequestedAt: now() } })); toast.success("Alta anestésica registrada e leito solicitado"); }}>Alta anestésica</Button></div>
    </>}
    {st.dischargeAt && <div className="space-y-1"><div>Alta anestésica {new Date(st.dischargeAt).toLocaleTimeString("pt-BR")} → {st.destination}</div><div className="font-semibold">Aguardando leito há {minutesBetween(st.bedRequestedAt, now())} min</div>{ok && <Button size="sm" onClick={() => upd(s.id, (x) => ({ status: "Finalizado", srpa: { ...x.srpa!, outAt: now() } }))}>Paciente transferido</Button>}</div>}
    {!!st.vitals.length && <div className="border-t pt-1 text-muted-foreground">{st.vitals.slice(-4).map((x, i) => <div key={i}>{new Date(x.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · PA {x.pa} · FC {x.fc} · SpO₂ {x.spo2} · EVA {x.pain} · AK {aldreteScore(x.aldrete)}</div>)}</div>}
  </div>;
}

function CoTab({ ok }: { ok: boolean }) {
  const all = useStore((s) => s.surgeries) as SurgX[];
  const patients = useStore((s) => s.patients);
  const at = (b: string) => all.find((s) => s.coBed === b && s.status !== "Finalizado");
  const [bed, setBed] = useState<string | null>(null);
  const [pid, setPid] = useState("");
  const cur = bed ? at(bed) : undefined;
  return <div className="grid gap-3 lg:grid-cols-[1fr_420px]">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">{CO_BEDS.map((b) => { const s = at(b); return <button key={b} onClick={() => setBed(b)} className={cn("rounded-lg border p-2 text-left text-xs", s ? "border-maternal bg-maternal/10" : "bg-card", bed === b && "ring-2 ring-ring")}><div className="font-semibold">{b}</div><div className="truncate text-muted-foreground">{s ? s.patient : "Livre"}</div>{s?.obstetric?.delivery && <div>{s.obstetric.delivery} · Robson {robson(s.obstetric)}</div>}</button>; })}</div>
    <div className={box}>{!bed ? <p className="text-sm text-muted-foreground">Selecione um leito.</p> : cur ? <ObstForm key={cur.id} s={cur} ok={ok} /> : <div className="space-y-2 text-sm"><div className="font-semibold">{bed} livre</div>{ok && <><select className={cn(sel, "w-full")} value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Paciente…</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <Button size="sm" disabled={!pid} onClick={() => { const p = patients.find((x) => x.id === pid)!; setState((st) => ({ surgeries: [...st.surgeries, { id: crypto.randomUUID(), patientId: p.id, patient: p.name, room: "Sala de Parto 1", start: new Date().getHours(), duration: 1, type: "Parto Normal", tuss: "", surgeon: who(), status: "Em Preparo", checks: {}, gastos: [], date: new Date().toISOString().slice(0, 10), coBed: bed, obstetric: EMPTY_OBST } as SurgX] })); setPid(""); toast.success(`Admitida no ${bed}`); }}>Admitir no leito</Button></>}</div>}</div>
  </div>;
}

function ObstForm({ s, ok }: { s: SurgX; ok: boolean }) {
  const [o, setO] = useState<Obstetric>(s.obstetric ?? EMPTY_OBST);
  const set = (p: Partial<Obstetric>) => setO((x) => ({ ...x, ...p }));
  const [handover, setHandover] = useState("");
  const save = (extra: Partial<SurgX> = {}) => { upd(s.id, () => ({ obstetric: o, ...extra })); toast.success("Registro salvo"); };
  return <div className="space-y-2 text-xs">
    <div className="text-sm font-semibold">{s.coBed} · {s.patient}</div>
    <div className="grid grid-cols-2 gap-1">
      <select className={sel} value={o.parity} onChange={(e) => set({ parity: e.target.value as Obstetric["parity"] })}><option>Nulípara</option><option>Multípara</option></select>
      <select className={sel} value={o.presentation} onChange={(e) => set({ presentation: e.target.value as Obstetric["presentation"] })}><option>Cefálica</option><option>Pélvica</option><option>Transversa/oblíqua</option></select>
      <label className="flex items-center gap-1">IG (sem.)<Input type="number" className="h-7" value={o.gestationalWeeks} onChange={(e) => set({ gestationalWeeks: +e.target.value })} /></label>
      <label className="flex items-center gap-1">Fetos<Input type="number" min={1} className="h-7" value={o.fetuses} onChange={(e) => set({ fetuses: +e.target.value })} /></label>
      <select className={cn(sel, "col-span-2")} value={o.labor} onChange={(e) => set({ labor: e.target.value as Obstetric["labor"] })}><option>Espontâneo</option><option>Induzido</option><option>Cesárea antes do trabalho de parto</option></select>
      <label className="col-span-2 flex items-center gap-1"><input type="checkbox" checked={o.previousCesarean} onChange={(e) => set({ previousCesarean: e.target.checked })} />Cesárea anterior</label>
    </div>
    <div className="rounded bg-secondary px-2 py-1 font-semibold">Classificação de Robson: Grupo {robson(o)}</div>
    {(Object.entries(SAFE_BIRTH) as [string, string[]][]).map(([k, items]) => <div key={k}><div className="font-semibold uppercase text-primary">{{ admissao: "Na admissão", antesExpulsivo: "Antes do expulsivo", posParto: "Após o parto (1 h)", alta: "Antes da alta" }[k]}</div>{items.map((i) => <label key={i} className="flex items-center gap-1"><input type="checkbox" checked={!!o.checks[`${k}:${i}`]} onChange={(e) => set({ checks: { ...o.checks, [`${k}:${i}`]: e.target.checked } })} />{i}</label>)}</div>)}
    <div className="font-semibold uppercase text-primary">Parto e Golden Hour</div>
    <select className={cn(sel, "w-full")} value={o.delivery} onChange={(e) => set({ delivery: e.target.value as Obstetric["delivery"] })}><option value="">Via de parto…</option><option>Vaginal</option><option>Cesárea</option></select>
    <div className="grid grid-cols-2 gap-1">
      <label className="flex items-center gap-1"><input type="checkbox" checked={o.skinToSkin} onChange={(e) => set({ skinToSkin: e.target.checked })} />Pele a pele 1ª hora</label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={o.breastfeeding1h} onChange={(e) => set({ breastfeeding1h: e.target.checked })} />Amamentação 1ª hora</label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={o.episiotomy} onChange={(e) => set({ episiotomy: e.target.checked })} />Episiotomia</label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={o.pph} onChange={(e) => set({ pph: e.target.checked })} />Hemorragia pós-parto</label>
      <label className="col-span-2 flex items-center gap-1">Clampeamento do cordão (min)<Input className="h-7 w-20" value={o.cordClampMin} onChange={(e) => set({ cordClampMin: e.target.value })} /></label>
    </div>
    <Textarea placeholder="Passagem de plantão (registro eletrônico)" value={handover} onChange={(e) => setHandover(e.target.value)} />
    {ok && <div className="flex flex-wrap gap-1"><Button size="sm" onClick={() => save(handover.trim() ? { report: { ...(s.report ?? ({} as NonNullable<SurgX["report"]>)), anesthesiaNotes: `${s.report?.anesthesiaNotes ?? ""}\n[Plantão ${new Date().toLocaleString("pt-BR")} – ${who()}] ${handover.trim()}`.trim() } } : {})}>Salvar</Button>
      <Button size="sm" variant="outline" disabled={!o.delivery} onClick={() => { if (!confirm("Confirmar alta do leito do Centro Obstétrico?")) return; save({ status: "Finalizado", type: o.delivery === "Cesárea" ? "Cesárea" : "Parto Normal" }); }}>Liberar leito</Button></div>}
    {s.report?.anesthesiaNotes && <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">{s.report.anesthesiaNotes}</pre>}
  </div>;
}

const ISSUES = ["Avariado", "Extraviado", "Enviado para manutenção", "Enviado para afiação", "Retornou da manutenção"];
function CmeTab({ ok }: { ok: boolean }) {
  const kits = useStore((s) => s.cmeKits); const cycles = useStore((s) => s.cmeCycles);
  const [kid, setKid] = useState(""); const [kind, setKind] = useState(ISSUES[0]!); const [item, setItem] = useState("");
  const events = kits.flatMap((k) => k.history.filter((h) => h.note.startsWith("Instrumental")).map((h) => ({ ...h, kit: k.name }))).sort((a, b) => b.at.localeCompare(a.at));
  const fail = cycles.filter((c) => c.chemical === "Reprovado" || c.bio === "Reprovado").length;
  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-4">{[["Ciclos registrados", cycles.length], ["Ciclos com falha", fail], ["Taxa de falha", `${cycles.length ? Math.round((fail / cycles.length) * 100) : 0}%`], ["Caixas bloqueadas", kits.filter((k) => k.status === "Bloqueado").length]].map(([l, v]) => <div key={l} className={box}><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-semibold">{v}</div></div>)}</div>
    {ok && <div className={cn(box, "flex flex-wrap items-end gap-2")}><select className={sel} value={kid} onChange={(e) => setKid(e.target.value)}><option value="">Caixa…</option>{kits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select><select className={sel} value={kind} onChange={(e) => setKind(e.target.value)}>{ISSUES.map((i) => <option key={i}>{i}</option>)}</select><Input className="h-8 w-56" placeholder="Instrumental (ex.: Pinça Kelly)" value={item} onChange={(e) => setItem(e.target.value)} />
      <Button size="sm" disabled={!kid || !item.trim()} onClick={() => { const block = kind !== "Retornou da manutenção"; setState((st) => ({ cmeKits: st.cmeKits.map((k) => k.id === kid ? { ...k, status: block ? "Bloqueado" : "Sujo", history: [...k.history, { at: now(), by: who(), note: `Instrumental ${kind.toLowerCase()}: ${item.trim()}` }] } : k) })); setItem(""); toast.success(block ? "Registrado e caixa bloqueada" : "Retorno registrado; caixa liberada para reprocessamento"); }}>Registrar</Button></div>}
    <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Data</th><th>Caixa</th><th>Ocorrência</th><th>Por</th></tr></thead><tbody>{events.map((e, i) => <tr key={i} className="border-t"><td className="py-1">{new Date(e.at).toLocaleString("pt-BR")}</td><td>{e.kit}</td><td>{e.note}</td><td>{e.by}</td></tr>)}{!events.length && <tr><td colSpan={4} className="py-2 text-muted-foreground">Nenhuma ocorrência.</td></tr>}</tbody></table>
  </div>;
}

function download(name: string, rows: (string | number)[][]) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" })); a.download = name; a.click(); }
function Reports() {
  const all = useStore((s) => s.surgeries) as SurgX[]; const cycles = useStore((s) => s.cmeCycles);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const cc = ccReport(all, month); const co = coReport(all, month);
  const mc = cycles.filter((c) => c.at.startsWith(month));
  const byAuto = Object.entries(mc.reduce<Record<string, number>>((a, c) => ({ ...a, [c.autoclave]: (a[c.autoclave] ?? 0) + 1 }), {}));
  const Kpi = ({ l, v }: { l: string; v: string | number }) => <div className={box}><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-semibold">{v}</div></div>;
  const Tbl = ({ h, rows }: { h: string[]; rows: (string | number)[][] }) => <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground">{h.map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="py-1">{c}</td>)}</tr>)}{!rows.length && <tr><td className="py-1 text-muted-foreground">Sem dados</td></tr>}</tbody></table>;
  const robsonRows = co.groups.map((g) => [`Grupo ${g.group}`, g.total, g.cesarean, `${g.groupSize}%`, `${g.cesareanRate}%`, `${g.contribution}%`]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 w-44" />
      <Button size="sm" variant="outline" onClick={() => download(`indicadores-${month}.csv`, [["Centro Cirúrgico", month], ["Agendadas", cc.scheduled], ["Realizadas", cc.done], ["Suspensas", cc.suspended], ["Taxa de suspensão %", cc.suspensionRate], ["Tempo médio de sala (min)", cc.avgRoomMin], ["Tempo médio SRPA (min)", cc.avgSrpaMin], [], ["Cirurgião", "Cirurgias"], ...cc.bySurgeon, [], ["Motivo de suspensão", "Qtd"], ...cc.byReason, [], ["Centro Obstétrico"], ["Partos", co.births], ["Vaginais", co.vaginal], ["Cesáreas", co.cesarean], ["Taxa de cesárea %", co.cesareanRate], ["Episiotomia %", co.episiotomyRate], ["HPP %", co.pphRate], ["Pele a pele %", co.skinToSkinRate], ["Amamentação 1h %", co.breastfeedingRate], [], ["Robson", "Partos", "Cesáreas", "Tamanho do grupo", "Taxa de cesárea", "Contribuição"], ...robsonRows, [], ["CME – Autoclave", "Ciclos"], ...byAuto])}>Exportar planilha</Button>
      <Button size="sm" variant="outline" onClick={() => window.print()}>Imprimir</Button></div>
    <section className="space-y-2"><h2 className="font-semibold">Centro cirúrgico</h2><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><Kpi l="Agendadas" v={cc.scheduled} /><Kpi l="Realizadas" v={cc.done} /><Kpi l="Suspensas" v={cc.suspended} /><Kpi l="Taxa de suspensão" v={`${cc.suspensionRate}%`} /><Kpi l="Tempo médio de sala" v={`${cc.avgRoomMin} min`} /><Kpi l="Tempo médio SRPA" v={`${cc.avgSrpaMin} min`} /></div>
      <div className="grid gap-3 md:grid-cols-3"><div className={box}><Tbl h={["Cirurgião", "Qtd"]} rows={cc.bySurgeon} /></div><div className={box}><Tbl h={["Sala", "Qtd"]} rows={cc.byRoom} /></div><div className={box}><Tbl h={["Motivo de suspensão", "Qtd"]} rows={cc.byReason} /></div></div></section>
    <section className="space-y-2"><h2 className="font-semibold">Centro obstétrico</h2><div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8"><Kpi l="Partos" v={co.births} /><Kpi l="Vaginais" v={co.vaginal} /><Kpi l="Cesáreas" v={co.cesarean} /><Kpi l="Taxa de cesárea" v={`${co.cesareanRate}%`} /><Kpi l="Episiotomia" v={`${co.episiotomyRate}%`} /><Kpi l="HPP" v={`${co.pphRate}%`} /><Kpi l="Pele a pele" v={`${co.skinToSkinRate}%`} /><Kpi l="Amamentação 1h" v={`${co.breastfeedingRate}%`} /></div>
      <div className={box}><div className="mb-1 text-xs font-semibold">Classificação de Robson (10 grupos)</div><Tbl h={["Grupo", "Partos", "Cesáreas", "Tamanho do grupo", "Taxa de cesárea", "Contribuição"]} rows={robsonRows} /></div></section>
    <section className="space-y-2"><h2 className="font-semibold">CME</h2><div className="grid gap-3 md:grid-cols-2"><div className={box}><Tbl h={["Autoclave", "Ciclos no mês"]} rows={byAuto} /></div><div className={box}><Tbl h={["Indicador", "Valor"]} rows={[["Ciclos", mc.length], ["Reprovados (químico/biológico)", mc.filter((c) => c.chemical === "Reprovado" || c.bio === "Reprovado").length], ["Biológicos pendentes", mc.filter((c) => c.bio === "Pendente").length], ["Caixas processadas", mc.reduce((a, c) => a + c.kitIds.length, 0)]]} /></div></div></section>
  </div>;
}
