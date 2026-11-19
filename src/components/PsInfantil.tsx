import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RiskBadge } from "./RiskBadge";
import { CallPanelButton } from "./CallPanelButton";
import { can, type Patient } from "@/lib/hospital-data";
import { FLOW_LABELS } from "@/lib/care-flow";
import { ageBand } from "@/lib/amb-reports";
import { psAddScale, psAwaitDischarge, psEvasion, psOpenSepsis, psReleaseBed, psRequestReturn, psSetBed, psSetDestination, psUpdateSepsis, useStore } from "@/lib/hospital-store";
import { PCACR_MAX_MIN, PS_BED_GROUPS, PS_DESTINATIONS, PS_UNIT, SCALES, SEPSIS_BUNDLE, fmtMin, minutes, outcomeStatus, psReport, scaleTotal, toCsvRows, triagedAt, type PsDestination, type PsEncounter, type SepsisKind } from "@/lib/ps-infantil";
import { cn } from "@/lib/utils";

const box = "rounded-lg border bg-card p-3";
const sel = "h-8 rounded-md border bg-background px-2 text-xs";
const run = (fn: () => void, ok?: string) => { try { fn(); if (ok) toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Ação não concluída"); } };
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
function useNow() { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), 30000); return () => clearInterval(t); }, []); return n; }
function usePs() {
  const encounters = useStore((s) => s.encounters) as PsEncounter[];
  const patients = useStore((s) => s.patients);
  const active = encounters.filter((e) => e.type === PS_UNIT && e.status_fluxo !== "ALTA_HOSPITALAR");
  return { encounters, patients, active, name: (id: string) => patients.find((p) => p.id === id)?.name ?? "—" };
}
const STATUS_CLS = { ok: "", perto: "border-mt-yellow bg-mt-yellow/10", estourado: "border-destructive bg-destructive/10" };

function EvasionButton({ e }: { e: PsEncounter }) {
  const profile = useStore((s) => s.profile);
  if (!can(profile, "prescrever")) return null;
  return <Button size="sm" variant="outline" className="text-destructive" onClick={() => { const n = window.prompt("Alta por evasão – descreva o ocorrido (obrigatório):"); if (n == null) return; if (!window.confirm("Confirmar ALTA POR EVASÃO? O atendimento será encerrado.")) return; run(() => psEvasion(e.id, n), "Alta por evasão registrada"); }}>Alta por evasão</Button>;
}

/** 3.1 Pacientes aguardando consulta. */
export function PsWaiting() {
  const { active, name } = usePs(); const now = useNow(); const profile = useStore((s) => s.profile);
  const list = active.filter((e) => ["AGUARDANDO_MEDICO", "EM_OBSERVACAO_REAVALIACAO"].includes(e.status_fluxo) && !e.ps?.bed);
  const order = ["vermelho", "laranja", "amarelo", "verde", "azul"];
  list.sort((a, b) => order.indexOf(a.triage?.risk ?? "azul") - order.indexOf(b.triage?.risk ?? "azul") || (triagedAt(a) ?? a.openedAt).localeCompare(triagedAt(b) ?? b.openedAt));
  return <div className="space-y-2">
    {!list.length && <p className="py-6 text-sm text-muted-foreground">Nenhum paciente aguardando consulta.</p>}
    {list.map((e) => { const wait = minutes(triagedAt(e), new Date(now).toISOString()) ?? 0; const late = e.triage && wait > PCACR_MAX_MIN[e.triage.risk];
      return <div key={e.id} className={cn(box, "flex flex-wrap items-center justify-between gap-2", late && "border-destructive")}>
        <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><b>{name(e.patientId)}</b><RiskBadge risk={e.triage?.risk} /><span className="text-xs text-muted-foreground">{e.number}</span></div>
          <div className="text-xs text-muted-foreground">Classificado {fmt(triagedAt(e))} · Espera <span className={late ? "font-semibold text-destructive" : ""}>{fmtMin(wait)}{late ? " (acima do PCACR)" : ""}</span> · {FLOW_LABELS[e.status_fluxo]}{e.ps?.returnRequestedAt ? " · retorno médico" : ""}</div></div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Consultório de destino" className={sel} value={e.ps?.destination ?? "Consultório pediátrico"} disabled={!can(profile, "triagem") && !can(profile, "prescrever")} onChange={(ev) => run(() => psSetDestination(e.id, ev.target.value as PsDestination))}>{PS_DESTINATIONS.map((d) => <option key={d}>{d}</option>)}</select>
          <CallPanelButton patientId={e.patientId} />
          <Button size="sm" asChild><Link to="/pacientes/$id" params={{ id: e.patientId }}>Abrir prontuário</Link></Button>
          <EvasionButton e={e} />
        </div></div>; })}
  </div>;
}

/** 3.2 Observação + 3.3 mapa dos leitos. */
export function PsObservation() {
  const { active, name } = usePs(); const now = useNow(); const profile = useStore((s) => s.profile);
  const [pick, setPick] = useState<string>("");
  const occ = (b: string) => active.find((e) => e.ps?.bed === b);
  const candidates = active.filter((e) => !e.ps?.bed && e.status_fluxo !== "AGUARDANDO_TRIAGEM");
  const nurse = can(profile, "checar") || can(profile, "triagem") || can(profile, "prescrever");
  const free = PS_BED_GROUPS.flatMap((g) => g.beds).filter((b) => !occ(b)).length;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 text-sm"><b>Leitos do PS Infantil:</b><span className="rounded bg-bed-free px-2 py-0.5 text-xs text-primary-foreground">{free} livres</span><span className="rounded bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">{15 - free} ocupados</span>
      {nurse && <><select aria-label="Paciente para observação" className={sel} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Colocar em observação…</option>{candidates.map((e) => <option key={e.id} value={e.id}>{name(e.patientId)} · {e.number}</option>)}</select></>}</div>
    {PS_BED_GROUPS.map((g) => <section key={g.local} className="space-y-1"><h3 className="text-xs font-semibold uppercase text-primary">{g.local}</h3>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{g.beds.map((b) => { const e = occ(b); const st = e ? outcomeStatus(e, new Date(now).toISOString()) : "ok";
        return <div key={b} className={cn(box, "space-y-1 text-xs", e ? STATUS_CLS[st] || "border-primary" : "opacity-80")}>
          <div className="flex justify-between font-semibold"><span>Leito {b}</span><span>{e ? "Ocupado" : "Livre"}</span></div>
          {!e && pick && nurse && <Button size="sm" className="h-7 w-full" onClick={() => run(() => { psSetBed(pick, b); setPick(""); }, `Paciente no leito ${b}`)}>Alocar aqui</Button>}
          {e && <><div className="flex items-center gap-1"><b className="truncate">{name(e.patientId)}</b><RiskBadge risk={e.triage?.risk} /></div>
            <div className="text-muted-foreground">Entrada {fmt(e.ps?.obsAt)} · {fmtMin(minutes(e.openedAt, new Date(now).toISOString()))} no PS{st !== "ok" && <b className="ml-1 text-destructive">{st === "estourado" ? "meta estourada" : "perto da meta"}</b>}</div>
            <div className="text-muted-foreground">{FLOW_LABELS[e.status_fluxo]}{e.ps?.awaitingDischargeAt ? " · aguardando alta médica" : ""}{e.medical?.cid ? ` · ${e.medical.cid}` : ""}</div>
            <div className="flex flex-wrap gap-1 pt-1">
              <Button size="sm" variant="outline" className="h-7" asChild><Link to="/pacientes/$id" params={{ id: e.patientId }}>PEP</Link></Button>
              {nurse && <Button size="sm" variant="outline" className="h-7" onClick={() => run(() => psRequestReturn(e.id), "Retorno médico solicitado")}>Retorno médico</Button>}
              {nurse && <Button size="sm" variant="outline" className="h-7" onClick={() => run(() => psRequestReturn(e.id, "Reavaliação solicitada pela enfermagem"), "Reavaliação solicitada")}>Reavaliação</Button>}
              {nurse && !e.ps?.awaitingDischargeAt && <Button size="sm" variant="outline" className="h-7" onClick={() => { if (window.confirm("Registrar alta assistencial (aguardando alta médica)?")) run(() => psAwaitDischarge(e.id), "Aguardando alta médica"); }}>Aguardando alta</Button>}
              {nurse && <Button size="sm" variant="ghost" className="h-7" onClick={() => { if (window.confirm(`Liberar o leito ${b}?`)) run(() => psReleaseBed(e.id), "Leito liberado"); }}>Liberar leito</Button>}
              <EvasionButton e={e} />
            </div></>}
        </div>; })}</div></section>)}
  </div>;
}

/** 4. Escalas assistenciais, SAE/SBAR e protocolos de sepse. */
export function PsCare() {
  const { active, name } = usePs(); const profile = useStore((s) => s.profile);
  const [id, setId] = useState(""); const e = active.find((x) => x.id === id);
  const [scale, setScale] = useState(SCALES[0]!.id); const def = SCALES.find((s) => s.id === scale)!;
  const [ans, setAns] = useState<number[]>([]); const [text, setText] = useState(""); const [kindText, setKindText] = useState<"sae" | "sbar">("sae");
  const ok = can(profile, "checar") || can(profile, "triagem") || can(profile, "prescrever") || can(profile, "evoluir");
  const total = scaleTotal(def, ans);
  return <div className="space-y-3">
    <select aria-label="Paciente" className={cn(sel, "w-full max-w-md")} value={id} onChange={(ev) => { setId(ev.target.value); setAns([]); }}><option value="">Selecione o paciente do PS Infantil…</option>{active.map((x) => <option key={x.id} value={x.id}>{name(x.patientId)} · {x.number}{x.ps?.bed ? ` · leito ${x.ps.bed}` : ""}</option>)}</select>
    {e && <div className="grid gap-3 xl:grid-cols-2">
      <div className={box}><div className="mb-2 flex flex-wrap gap-1">{SCALES.map((s) => <Button key={s.id} size="sm" variant={s.id === scale ? "default" : "outline"} className="h-7 text-xs" onClick={() => { setScale(s.id); setAns([]); }}>{s.name}</Button>)}</div>
        <div className="space-y-1 text-xs">{def.items.map((it, i) => <label key={it.label} className="flex items-center justify-between gap-2">{it.label}<select className={cn(sel, "w-64")} value={ans[i] ?? 0} onChange={(ev) => { const n = [...ans]; n[i] = +ev.target.value; setAns(n); }}>{it.options.map((o, j) => <option key={j} value={j}>{o.score} · {o.label}</option>)}</select></label>)}</div>
        <div className="mt-2 rounded bg-secondary px-2 py-1 text-sm font-semibold">{def.name}: {total} pontos · {def.interpret(total)}</div>
        <Button size="sm" className="mt-2" disabled={!ok} onClick={() => run(() => psAddScale(e.id, { scale, total, result: `${total} – ${def.interpret(total)}` }), "Escala registrada")}>Registrar escala</Button>
        <div className="mt-3 border-t pt-2"><div className="mb-1 flex gap-1"><Button size="sm" variant={kindText === "sae" ? "default" : "outline"} className="h-7" onClick={() => setKindText("sae")}>SAE</Button><Button size="sm" variant={kindText === "sbar" ? "default" : "outline"} className="h-7" onClick={() => setKindText("sbar")}>SBAR – transferência</Button></div>
          <Textarea value={text} onChange={(ev) => setText(ev.target.value)} placeholder={kindText === "sae" ? "Histórico · Diagnóstico de enfermagem · Planejamento · Implementação · Avaliação" : "S – Situação\nB – Breve histórico\nA – Avaliação\nR – Recomendação"} className="min-h-28" />
          <Button size="sm" className="mt-2" disabled={!ok || !text.trim()} onClick={() => run(() => { psAddScale(e.id, { scale: kindText, result: kindText.toUpperCase(), text: text.trim() }); setText(""); }, "Registro salvo")}>Salvar {kindText.toUpperCase()}</Button></div>
        <div className="mt-3 border-t pt-2 text-xs"><div className="font-semibold">Histórico</div>{[...(e.ps?.scales ?? [])].reverse().map((r) => <div key={r.id} className="border-b py-1">{fmt(r.at)} · <b>{SCALES.find((s) => s.id === r.scale)?.name ?? r.scale.toUpperCase()}</b> · {r.result} · {r.by}{r.text && <p className="whitespace-pre-wrap text-muted-foreground">{r.text}</p>}</div>)}{!e.ps?.scales?.length && <p className="text-muted-foreground">Sem registros.</p>}</div>
      </div>
      <SepsisBox e={e} ok={ok} />
    </div>}
  </div>;
}

function SepsisBox({ e, ok }: { e: PsEncounter; ok: boolean }) {
  return <div className={box}><div className="mb-2 flex flex-wrap items-center gap-2"><b className="text-sm">Protocolos de sepse</b>{ok && (["Pediátrica", "Neonatal"] as SepsisKind[]).map((k) => <Button key={k} size="sm" variant="destructive" className="h-7" onClick={() => { if (window.confirm(`Abrir protocolo de Sepse ${k}?`)) run(() => psOpenSepsis(e.id, k), `Protocolo de sepse ${k} aberto`); }}>Abrir Sepse {k}</Button>)}</div>
    {(e.ps?.sepsis ?? []).map((s) => <SepsisCard key={s.id} e={e} s={s} ok={ok} />)}{!e.ps?.sepsis?.length && <p className="text-xs text-muted-foreground">Nenhum protocolo aberto.</p>}</div>;
}
function SepsisCard({ e, s, ok }: { e: PsEncounter; s: NonNullable<NonNullable<PsEncounter["ps"]>["sepsis"]>[number]; ok: boolean }) {
  const [checks, setChecks] = useState(s.checks); const [out, setOut] = useState("");
  const elapsed = minutes(s.openedAt, s.closedAt ?? new Date().toISOString()) ?? 0;
  return <div className={cn("mb-2 rounded border p-2 text-xs", !s.closedAt && "border-destructive")}>
    <div className="font-semibold">Sepse {s.kind} · aberto {fmt(s.openedAt)} por {s.openedBy} · {s.closedAt ? `encerrado: ${s.outcome}` : <span className={elapsed > 60 ? "text-destructive" : ""}>{fmtMin(elapsed)} desde a abertura{elapsed > 60 ? " (1ª hora excedida)" : ""}</span>}</div>
    {SEPSIS_BUNDLE[s.kind].map((i) => <label key={i} className="flex items-center gap-2 py-0.5"><input type="checkbox" disabled={!ok || !!s.closedAt} checked={!!checks[i]} onChange={(ev) => setChecks((c) => { const n = { ...c }; if (ev.target.checked) n[i] = new Date().toISOString(); else delete n[i]; return n; })} />{i}{checks[i] && <span className="text-muted-foreground">({fmt(checks[i])})</span>}</label>)}
    {ok && !s.closedAt && <div className="mt-1 flex flex-wrap gap-1"><Button size="sm" className="h-7" onClick={() => run(() => psUpdateSepsis(e.id, s.id, checks), "Protocolo atualizado")}>Salvar</Button><Input className="h-7 w-48" placeholder="Desfecho (alta, internação, UTI…)" value={out} onChange={(ev) => setOut(ev.target.value)} /><Button size="sm" variant="outline" className="h-7" disabled={!out.trim()} onClick={() => run(() => psUpdateSepsis(e.id, s.id, checks, out.trim()), "Protocolo encerrado")}>Encerrar</Button></div>}
  </div>;
}

/** 8. Coordenação – indicadores exclusivos da porta PS Infantil. */
export function PsCoordination() {
  const { encounters, patients, active, name } = usePs(); const movements = useStore((s) => s.movements); const now = useNow();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); const [mode, setMode] = useState<"dia" | "mes" | "ano">("mes");
  const [cmp, setCmp] = useState("");
  const info = useMemo(() => patients.map((p: Patient) => { const a = p.registration?.addresses?.find((x) => x.primary) ?? p.registration?.addresses?.[0]; return { id: p.id, city: a?.city ? `${a.city}${a.state ? `/${a.state}` : ""}` : "", sex: p.registration?.sex ?? "", ageBand: ageBand(p.registration?.birthDate, new Date()) }; }), [patients]);
  const r = useMemo(() => psReport(encounters, info, movements, period), [encounters, info, movements, period]);
  const c = useMemo(() => (cmp ? psReport(encounters, info, movements, cmp) : null), [encounters, info, movements, cmp]);
  const Kpi = ({ l, v, d }: { l: string; v: string | number; d?: string | number | null | undefined }) => <div className={box}><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-semibold">{v}</div>{d != null && c && <div className="text-[11px] text-muted-foreground">comparação: {d}</div>}</div>;
  const Tbl = ({ t, h, rows }: { t: string; h: string[]; rows: (string | number)[][] }) => <div className={box}><div className="mb-1 text-xs font-semibold">{t}</div><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground">{h.map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t">{row.map((x, j) => <td key={j} className="py-0.5">{x}</td>)}</tr>)}{!rows.length && <tr><td className="py-1 text-muted-foreground">Sem dados</td></tr>}</tbody></table></div>;
  const live = active.map((e) => ({ e, st: outcomeStatus(e, new Date(now).toISOString()), m: minutes(e.openedAt, new Date(now).toISOString()) ?? 0 })).sort((a, b) => b.m - a.m);
  const risk = r.byRisk.map((x) => [x.risk, x.n, `${x.pct}%`]);
  const sepsisRows = r.sepsis.map(({ e, s }) => { const p = patients.find((x) => x.id === e.patientId); return [p?.name ?? "—", e.number, p?.registration?.birthDate ?? "", p?.age ?? "", fmt(s.openedAt), s.kind, s.openedBy, s.outcome ?? (e.status_fluxo === "ALTA_HOSPITALAR" ? "Alta" : "Em aberto")]; });
  const exportCsv = () => { const rows: (string | number)[][] = [["Pronto-Socorro Infantil", period], ["Atendimentos", r.total], ["Internações", r.internacoes], ["Ortopedia", r.ortopedia], ["Pediatria", r.pediatria], ["Classificações", r.classified], [], ["Risco", "Qtd", "%"], ...risk, [], ["Espera média até triagem (min)", r.avgTriageWaitMin], ["Chamada médica no prazo", r.doctorInside], ["Fora do prazo", r.doctorOutside], ["% no prazo", r.doctorRate], [], ["Diurno ≤6h", r.diurno.inside, "acima", r.diurno.outside, "%", r.diurno.rate], ["Noturno ≤12h", r.noturno.inside, "acima", r.noturno.outside, "%", r.noturno.rate], ["Permanência média (min)", r.avgStayMin], [], ["Evasões", r.evasions, "%", r.evasionRate], ...r.evasionByRisk, [], ["Município", "Qtd"], ...r.byCity, [], ["Faixa etária", "Qtd"], ...r.byAge, [], ["Sexo", "Qtd"], ...r.bySex, [], ["Diagnóstico", "Qtd"], ...r.byCid, [], ["Farmácia – medicamento", "Qtd"], ...r.pharmacy, [], ["Almoxarifado – material", "Qtd"], ...r.warehouse, [], ["Sepse – paciente", "Atendimento", "Nascimento", "Idade", "Abertura", "Tipo", "Profissional", "Desfecho"], ...sepsisRows];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([toCsvRows(rows)], { type: "text/csv;charset=utf-8" })); a.download = `ps-infantil-${period}.csv`; a.click(); };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 print:hidden"><select className={sel} value={mode} onChange={(e) => { const m = e.target.value as typeof mode; setMode(m); const t = new Date().toISOString(); setPeriod(m === "dia" ? t.slice(0, 10) : m === "mes" ? t.slice(0, 7) : t.slice(0, 4)); setCmp(""); }}><option value="dia">Diário</option><option value="mes">Mensal</option><option value="ano">Anual</option></select>
      <Input aria-label="Período" type={mode === "dia" ? "date" : mode === "mes" ? "month" : "number"} value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 w-44" />
      <span className="text-xs">Comparar com</span><Input aria-label="Período de comparação" type={mode === "dia" ? "date" : mode === "mes" ? "month" : "number"} value={cmp} onChange={(e) => setCmp(e.target.value)} className="h-8 w-44" />
      <Button size="sm" variant="outline" onClick={exportCsv}>Exportar Excel</Button><Button size="sm" variant="outline" onClick={() => window.print()}>Imprimir / PDF</Button>
      <span className="text-xs text-muted-foreground">Somente a porta Pronto-Socorro Infantil</span></div>

    <section className="space-y-2"><h2 className="font-semibold">Painel em tempo real – tempo até o desfecho</h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{live.map(({ e, st, m }) => <div key={e.id} className={cn(box, "text-xs", STATUS_CLS[st])}><div className="flex items-center gap-1"><b className="truncate">{name(e.patientId)}</b><RiskBadge risk={e.triage?.risk} /></div><div>{fmtMin(m)} no PS · meta {e.openedAt && new Date(e.openedAt).getHours() >= 7 && new Date(e.openedAt).getHours() < 19 ? "6h (diurno)" : "12h (noturno)"}</div><div className="text-muted-foreground">{FLOW_LABELS[e.status_fluxo]}{e.ps?.bed ? ` · leito ${e.ps.bed}` : ""}</div>{st !== "ok" && <b className="text-destructive">{st === "estourado" ? "Meta ultrapassada" : "Próximo do limite"}</b>}</div>)}{!live.length && <p className="text-sm text-muted-foreground">Nenhum paciente no PS agora.</p>}</div></section>

    <section className="space-y-2"><h2 className="font-semibold">Produção</h2><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><Kpi l="Atendimentos" v={r.total} d={c?.total} /><Kpi l="Internações pelo PS" v={r.internacoes} d={c?.internacoes} /><Kpi l="Ortopedia" v={r.ortopedia} d={c?.ortopedia} /><Kpi l="Pediatria" v={r.pediatria} d={c?.pediatria} /><Kpi l="Evasões" v={`${r.evasions} (${r.evasionRate}%)`} d={c && `${c.evasions} (${c.evasionRate}%)`} /><Kpi l="Permanência média" v={fmtMin(r.avgStayMin)} d={c && fmtMin(c.avgStayMin)} /></div></section>

    <section className="space-y-2"><h2 className="font-semibold">Classificação de risco e tempos</h2>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><Kpi l="Classificações" v={r.classified} d={c?.classified} /><Kpi l="Espera até classificação" v={fmtMin(r.avgTriageWaitMin)} d={c && fmtMin(c.avgTriageWaitMin)} /><Kpi l="Chamada médica no prazo" v={`${r.doctorRate}%`} d={c && `${c.doctorRate}%`} /><Kpi l="Fora do prazo PCACR" v={r.doctorOutside} d={c?.doctorOutside} /><Kpi l="Desfecho diurno ≤ 6h" v={`${r.diurno.rate}% (${r.diurno.inside}/${r.diurno.total})`} d={c && `${c.diurno.rate}%`} /><Kpi l="Desfecho noturno ≤ 12h" v={`${r.noturno.rate}% (${r.noturno.inside}/${r.noturno.total})`} d={c && `${c.noturno.rate}%`} /></div>
      <div className="grid gap-3 md:grid-cols-3"><Tbl t="Distribuição PCACR" h={["Cor", "Pacientes", "%"]} rows={risk} /><Tbl t="Efetividade médica por cor" h={["Cor", "Atendidos", "No prazo", "Média"]} rows={r.doctorByRisk.map((x) => [x.risk, x.n, x.inside, fmtMin(x.avgMin)])} /><Tbl t="Fora do tempo preconizado" h={["Paciente", "Cor", "Atendimento"]} rows={r.doctorLate.map((e) => [name(e.patientId), e.triage?.risk ?? "", e.number])} /></div>
      <div className="grid gap-3 md:grid-cols-2"><Tbl t="Permanência por turno" h={["Turno", "Total", "Dentro da meta", "Acima", "Média"]} rows={[["Diurno (07–19h)", r.diurno.total, r.diurno.inside, r.diurno.outside, fmtMin(r.diurno.avgMin)], ["Noturno (19–07h)", r.noturno.total, r.noturno.inside, r.noturno.outside, fmtMin(r.noturno.avgMin)]]} /><Tbl t="Evasão por classificação" h={["Cor", "Evasões"]} rows={r.evasionByRisk} /></div></section>

    <section className="space-y-2"><h2 className="font-semibold">Perfil dos pacientes</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Tbl t="Procedência por município" h={["Município", "Qtd"]} rows={r.byCity} /><Tbl t="Faixa etária" h={["Faixa", "Qtd"]} rows={r.byAge} /><Tbl t="Gênero" h={["Sexo", "Qtd"]} rows={r.bySex} /><Tbl t="Principais diagnósticos" h={["CID", "Qtd"]} rows={r.byCid} /></div></section>

    <section className="space-y-2"><h2 className="font-semibold">Consumo do PS Infantil</h2><div className="grid gap-3 md:grid-cols-2"><Tbl t="Farmácia – medicamentos" h={["Medicamento", "Qtd"]} rows={r.pharmacy} /><Tbl t="Almoxarifado – materiais" h={["Material", "Qtd"]} rows={r.warehouse} /></div></section>

    <section className="space-y-2"><h2 className="font-semibold">Protocolos de sepse · {r.sepsisPed} pediátricos · {r.sepsisNeo} neonatais</h2>
      <div className={box}><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground">{["Paciente", "Atendimento", "Nascimento", "Idade", "Abertura", "Tipo", "Profissional", "Desfecho", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{r.sepsis.map(({ e, s }, i) => <tr key={s.id} className="border-t">{sepsisRows[i]!.map((x, j) => <td key={j} className="py-0.5">{x}</td>)}<td><Link className="text-primary underline" to="/pacientes/$id" params={{ id: e.patientId }}>abrir</Link></td></tr>)}{!r.sepsis.length && <tr><td className="py-1 text-muted-foreground">Nenhum protocolo no período.</td></tr>}</tbody></table></div></section>
  </div>;
}
