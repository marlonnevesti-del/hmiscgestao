import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Letterhead } from "./DischargePrint";
import { printProcedure } from "./ProcedurePrint";
import { NoPermission } from "./AppShell";
import { can } from "@/lib/hospital-data";
import { GROUP_LABELS, type SadtReport, type SpecialtyGroup } from "@/lib/ambulatorio";
import type { Encounter } from "@/lib/care-flow";
import { checkInAppointment, createAmbSpecialty, professionalName, saveSadtReport, scheduleAppointment, setAppointmentStatus, toggleAmbSpecialty, useStore } from "@/lib/hospital-store";

const act = (fn: () => void, ok?: string) => { try { fn(); if (ok) toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Ação não concluída"); } };
const today = () => new Date().toLocaleDateString("sv-SE");
const sel = "h-9 rounded-md border bg-background px-2 text-sm";
const STATUS: Record<string, string> = { agendado: "Agendado", chegou: "Chegou", faltou: "Faltou", cancelado: "Cancelado" };

export function SpecialtyManager() {
  const list = useStore((s) => s.ambSpecialties); const profile = useStore((s) => s.profile);
  const [name, setName] = useState(""); const [group, setGroup] = useState<SpecialtyGroup>("medica");
  const editable = can(profile, "recepcao");
  return <div className="space-y-4">
    {editable && <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); act(() => { createAmbSpecialty(name, group); setName(""); }, "Especialidade cadastrada"); }}>
      <label className="grid gap-1 text-xs">Nova especialidade<Input value={name} onChange={(e) => setName(e.target.value)} className="w-72" /></label>
      <label className="grid gap-1 text-xs">Grupo<select className={sel} value={group} onChange={(e) => setGroup(e.target.value as SpecialtyGroup)}>{(Object.keys(GROUP_LABELS) as SpecialtyGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}</select></label>
      <Button type="submit">Cadastrar</Button>
    </form>}
    <div className="grid gap-4 lg:grid-cols-3">
      {(Object.keys(GROUP_LABELS) as SpecialtyGroup[]).map((g) => <section key={g} className="rounded-lg border bg-card p-3">
        <h3 className="mb-2 text-sm font-semibold">{GROUP_LABELS[g]}</h3>
        <ul className="space-y-1">{list.filter((x) => x.group === g).map((x) => <li key={x.id} className="flex items-center justify-between gap-2 text-sm">
          <span className={x.active ? "" : "text-muted-foreground line-through"}>{x.name}</span>
          {editable && <Button size="sm" variant="ghost" onClick={() => act(() => toggleAmbSpecialty(x.id))}>{x.active ? "Desativar" : "Ativar"}</Button>}
        </li>)}</ul>
      </section>)}
    </div>
  </div>;
}

export function AmbulatoryAgenda() {
  const list = useStore((s) => s.appointments); const specs = useStore((s) => s.ambSpecialties); const patients = useStore((s) => s.patients); const profile = useStore((s) => s.profile);
  const [date, setDate] = useState(today()); const [filter, setFilter] = useState("");
  const [f, setF] = useState({ time: "", specialtyId: "", professional: "", patientId: "", note: "" }); const [q, setQ] = useState("");
  const found = q.length > 1 ? patients.filter((p) => [p.name, p.cpf, p.prontuario, p.registration?.cns ?? ""].some((v) => v.toLowerCase().includes(q.toLowerCase()))).slice(0, 6) : [];
  const day = useMemo(() => list.filter((a) => a.date === date && (!filter || a.specialtyId === filter)).sort((a, b) => a.time.localeCompare(b.time)), [list, date, filter]);
  const editable = can(profile, "recepcao");
  const chosen = patients.find((p) => p.id === f.patientId);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs">Data<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="grid gap-1 text-xs">Especialidade<select className={sel} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todas</option>{specs.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    </div>
    {editable && <form className="grid gap-2 rounded-lg border bg-card p-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); act(() => { scheduleAppointment({ ...f, date }); setF({ ...f, time: "", patientId: "", note: "" }); }, "Consulta agendada"); }}>
      <h3 className="text-sm font-semibold md:col-span-3">Agendar consulta em {new Date(`${date}T12:00`).toLocaleDateString("pt-BR")}</h3>
      <div className="grid gap-1 text-xs md:col-span-3">Paciente {chosen ? <span className="text-sm font-medium">{chosen.name} · {chosen.prontuario} <Button type="button" variant="link" size="sm" onClick={() => setF({ ...f, patientId: "" })}>trocar</Button></span> : <>
        <Input placeholder="Buscar por nome, CPF, CNS ou prontuário (paciente novo: cadastre na aba Recepção)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1">{found.map((p) => <Button type="button" key={p.id} size="sm" variant="outline" onClick={() => { setF({ ...f, patientId: p.id }); setQ(""); }}>{p.name} · {p.prontuario}</Button>)}</div></>}
      </div>
      <label className="grid gap-1 text-xs">Especialidade<select className={sel} value={f.specialtyId} onChange={(e) => setF({ ...f, specialtyId: e.target.value })}><option value="">Selecione…</option>{(["medica", "nao_medica", "sadt"] as const).map((g) => <optgroup key={g} label={GROUP_LABELS[g]}>{specs.filter((s) => s.group === g && s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}</select></label>
      <label className="grid gap-1 text-xs">Horário<Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
      <label className="grid gap-1 text-xs">Profissional<Input value={f.professional} onChange={(e) => setF({ ...f, professional: e.target.value })} /></label>
      <label className="grid gap-1 text-xs md:col-span-2">Observação<Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <div className="flex items-end"><Button type="submit">Agendar</Button></div>
    </form>}
    <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Hora</th><th>Paciente</th><th>Especialidade</th><th>Profissional</th><th>Situação</th><th /></tr></thead>
      <tbody>{day.map((a) => { const p = patients.find((x) => x.id === a.patientId); return <tr key={a.id} className="border-b">
        <td className="py-2 font-mono">{a.time}</td><td>{p?.name ?? "—"}{a.note && <div className="text-xs text-muted-foreground">{a.note}</div>}</td><td>{specs.find((s) => s.id === a.specialtyId)?.name}</td><td>{a.professional}</td><td>{STATUS[a.status]}</td>
        <td className="space-x-1 text-right">{editable && a.status === "agendado" && <><Button size="sm" onClick={() => act(() => { checkInAppointment(a.id); }, "Chegada registrada · BAA gerado")}>Registrar chegada</Button><Button size="sm" variant="ghost" onClick={() => act(() => setAppointmentStatus(a.id, "faltou"))}>Faltou</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => act(() => setAppointmentStatus(a.id, "cancelado"))}>Cancelar</Button></>}</td>
      </tr>; })}</tbody></table>
    {!day.length && <p className="py-4 text-sm text-muted-foreground">Nenhuma consulta agendada nesta data.</p>}
  </div>;
}

export function SadtPanel() {
  const encounters = useStore((s) => s.encounters); const patients = useStore((s) => s.patients); const specs = useStore((s) => s.ambSpecialties); const profile = useStore((s) => s.profile);
  const sadt = new Set(specs.filter((s) => s.group === "sadt").map((s) => s.name));
  const list = encounters.filter((e) => e.type === "Ambulatório" && sadt.has(e.specialty));
  const pending = list.filter((e) => e.status_fluxo !== "ALTA_HOSPITALAR"); const done = list.filter((e) => e.sadtReport).slice(-20).reverse();
  const [open, setOpen] = useState<Encounter | null>(null); const [print, setPrint] = useState<Encounter | null>(null);
  const doPrint = (e: Encounter) => { setPrint(e); setTimeout(printProcedure, 50); };
  return <div className="space-y-4">
    <h3 className="font-semibold">Aguardando exame / laudo ({pending.length})</h3>
    {pending.map((e) => <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2"><div><b>{patients.find((p) => p.id === e.patientId)?.name}</b> <span className="text-xs text-muted-foreground">{e.number} · {e.specialty}</span></div><Button size="sm" disabled={!can(profile, "prescrever")} onClick={() => setOpen(e)}>Emitir laudo</Button></div>)}
    {!pending.length && <p className="text-sm text-muted-foreground">Nenhum exame pendente.</p>}
    <h3 className="pt-2 font-semibold">Laudos emitidos</h3>
    {done.map((e) => <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"><div><b>{patients.find((p) => p.id === e.patientId)?.name}</b> · {e.sadtReport?.exam} · {new Date(e.sadtReport!.at).toLocaleString("pt-BR")}</div><Button size="sm" variant="outline" onClick={() => doPrint(e)}>Imprimir laudo</Button></div>)}
    <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Laudo · {open?.specialty}</DialogTitle></DialogHeader>{open && <ReportForm e={open} onDone={(e) => { setOpen(null); doPrint(e); }} />}</DialogContent></Dialog>
    {print?.sadtReport && <ReportSheet e={print} />}
  </div>;
}

function ReportForm({ e, onDone }: { e: Encounter; onDone: (e: Encounter) => void }) {
  const name = useStore((s) => professionalName(s.profile));
  const [r, setR] = useState<Omit<SadtReport, "at">>({ exam: e.specialty, technique: "", findings: "", conclusion: "", professional: name, council: "" });
  const field = (k: keyof typeof r, label: string, area = false) => <label className="grid gap-1 text-xs">{label}{area ? <Textarea rows={4} value={r[k]} onChange={(x) => setR({ ...r, [k]: x.target.value })} /> : <Input value={r[k]} onChange={(x) => setR({ ...r, [k]: x.target.value })} />}</label>;
  return <form className="grid gap-3" onSubmit={(x) => { x.preventDefault(); act(() => { saveSadtReport(e.id, r); onDone({ ...e, sadtReport: { ...r, at: new Date().toISOString() } }); }, "Laudo emitido"); }}>
    {field("exam", "Exame")}{field("technique", "Técnica / preparo", true)}{field("findings", "Achados / descrição", true)}{field("conclusion", "Conclusão / impressão diagnóstica", true)}
    <div className="grid gap-3 sm:grid-cols-2">{field("professional", "Profissional responsável")}{field("council", "CRM / conselho")}</div>
    <Button type="submit">Salvar e imprimir laudo</Button>
  </form>;
}

function ReportSheet({ e }: { e: Encounter }) {
  const p = useStore((s) => s.patients.find((x) => x.id === e.patientId)); const r = e.sadtReport!;
  return createPortal(<div className="print-doc-root proc-root"><div className="sheet-page" style={{ padding: "1.2cm 1.5cm" }}>
    <Letterhead title={`LAUDO DE EXAME · ${r.exam.toUpperCase()}`} />
    <p><b>Paciente:</b> {p?.name} · <b>Prontuário:</b> {p?.prontuario} · <b>Nascimento/idade:</b> {p?.age} · <b>BAA:</b> {e.number}</p>
    <p><b>Data do exame:</b> {new Date(r.at).toLocaleString("pt-BR")}</p>
    {r.technique && <><h3 style={{ fontWeight: 700, marginTop: 12 }}>Técnica</h3><p style={{ whiteSpace: "pre-wrap" }}>{r.technique}</p></>}
    <h3 style={{ fontWeight: 700, marginTop: 12 }}>Achados</h3><p style={{ whiteSpace: "pre-wrap" }}>{r.findings}</p>
    <h3 style={{ fontWeight: 700, marginTop: 12 }}>Conclusão</h3><p style={{ whiteSpace: "pre-wrap" }}>{r.conclusion}</p>
    <div style={{ marginTop: "2cm", textAlign: "center" }}><div style={{ width: "8cm", margin: "0 auto", borderTop: "1px solid #000" }} />{r.professional}{r.council && ` · ${r.council}`}</div>
  </div></div>, document.body);
}

export { NoPermission };
