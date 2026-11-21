import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { FileText, Pill, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Letterhead } from "./DischargePrint";
import { DoctorNameInput } from "./DoctorNameInput";
import type { Encounter } from "@/lib/care-flow";
import type { Patient } from "@/lib/hospital-data";
import { canAct } from "@/lib/hospital-data";
import { KIND_LABELS, controlledRxIssues, type ControlledRx, type ExamKind, type ExamRequest } from "@/lib/exam-requests";
import { currentDoctorFields, professionalName, rememberDoctor, requestExam, useStore } from "@/lib/hospital-store";

const today = () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const birth = (p: Patient) => (p.registration?.birthDate ? new Date(`${p.registration.birthDate}T12:00:00`).toLocaleDateString("pt-BR") : p.age);
function addr(p: Patient) { const a = p.registration?.addresses?.find((x) => x.primary) ?? p.registration?.addresses?.[0]; return a ? [[a.streetType, a.street].filter(Boolean).join(" "), a.number, a.neighborhood, [a.city, a.state].filter(Boolean).join("/")].filter(Boolean).join(", ") : ""; }
function print(set: (v: boolean) => void) {
  document.body.classList.add("print-doc", "print-term");
  const done = () => { document.body.classList.remove("print-doc", "print-term"); set(false); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done); setTimeout(() => window.print(), 150);
}
const Sign = ({ name, council }: { name: string; council: string }) => <div className="doc-sign"><div className="line" />{name}{council && ` · ${council}`}</div>;

function PatientBox({ p }: { p: Patient }) {
  return <table className="doc-id"><tbody>
    <tr><td><b>Paciente:</b> {p.name}</td><td><b>Nascimento:</b> {birth(p)}</td></tr>
    <tr><td><b>Mãe:</b> {p.motherName || p.registration?.parent1 || "—"}</td><td><b>CNS:</b> {p.registration?.cns || "—"} · <b>Pront.:</b> {p.prontuario}</td></tr>
  </tbody></table>;
}

function ExamSheet({ p, r }: { p: Patient; r: ExamRequest }) {
  return <section className="doc-page">
    <Letterhead title={r.kind === "patologico" ? "SOLICITAÇÃO DE EXAME ANATOMOPATOLÓGICO" : `SOLICITAÇÃO DE EXAMES · ${KIND_LABELS[r.kind].toUpperCase()}`} />
    <PatientBox p={p} />
    <h3>Exame(s) solicitado(s)</h3><p style={{ whiteSpace: "pre-wrap" }}>{r.exams}</p>
    {r.kind === "patologico" && <><p><b>Material:</b> {r.material} · <b>Local da coleta:</b> {r.site}</p>{r.clinical && <p><b>Dados clínicos / hipótese:</b> {r.clinical}</p>}</>}
    <p><b>Justificativa clínica:</b> {r.justification}</p>{r.cid && <p><b>CID:</b> {r.cid}</p>}
    <p style={{ textAlign: "right", marginTop: "2em" }}>Criciúma - SC, {today()}.</p>
    <Sign name={r.requestedBy} council={r.council} />
  </section>;
}

function RxSheet({ p, rx, name, council }: { p: Patient; rx: ControlledRx; name: string; council: string }) {
  const via = (n: string) => <section className="doc-page" key={n}>
    <Letterhead title="RECEITUÁRIO DE CONTROLE ESPECIAL" />
    <p style={{ textAlign: "right" }}><b>{n}</b></p>
    <table className="doc-id"><tbody><tr><td colSpan={2}><b>IDENTIFICAÇÃO DO EMITENTE</b></td></tr><tr><td><b>Nome:</b> {name}</td><td><b>CRM:</b> {council || "________"}</td></tr><tr><td colSpan={2}><b>Endereço:</b> Rua Wenceslau Braz, 1015 - Operária Nova, Criciúma - SC</td></tr></tbody></table>
    <p><b>Paciente:</b> {p.name} · <b>Endereço:</b> {addr(p) || "______________________________"}</p>
    <ol>{rx.items.filter((x) => x.drug.trim()).map((x, i) => <li key={i}><b>{x.drug}</b> — {x.qty}<br />{x.dose}</li>)}</ol>
    <p style={{ textAlign: "right", marginTop: "1.5em" }}>Criciúma - SC, {today()}.</p>
    <Sign name={name} council={council} />
    <table className="doc-id" style={{ marginTop: "1.5em" }}><tbody>
      <tr><td><b>IDENTIFICAÇÃO DO COMPRADOR</b><br />Nome: {rx.buyer || "____________________"}<br />Ident.: {rx.buyerDoc || "__________"}<br />Endereço: {rx.buyerAddress || "____________________"}</td>
        <td><b>IDENTIFICAÇÃO DO FORNECEDOR</b><br /><br />______________________<br />Assinatura do farmacêutico · Data</td></tr>
    </tbody></table>
  </section>;
  return <>{via("1ª via – Farmácia")}{via("2ª via – Paciente")}</>;
}

function ExamDialog({ p, e, kind, onClose }: { p: Patient; e: Encounter; kind: ExamKind; onClose: () => void }) {
  const me = useStore((s) => professionalName(s.profile));
  const [f, setF] = useState(() => { const d = currentDoctorFields(); return { exams: "", justification: e.medical?.diagnosis ?? "", cid: e.medical?.cid ?? "", material: "", site: "", clinical: "", by: d.name || me, council: d.crm }; });
  const [printed, setPrinted] = useState<ExamRequest | null>(null);
  const s = (k: keyof typeof f) => (x: { target: { value: string } }) => setF({ ...f, [k]: x.target.value });
  const save = () => { try { rememberDoctor(f.by, f.council); const r = requestExam(e.id, { kind, exams: f.exams, justification: f.justification, cid: f.cid, council: f.council, ...(kind === "patologico" ? { material: f.material, site: f.site, clinical: f.clinical } : {}) }); toast.success(kind === "laboratorial" ? "Pedido registrado" : "Pedido enviado ao SADT"); setPrinted(r); print(() => { setPrinted(null); onClose(); }); } catch (x) { toast.error(x instanceof Error ? x.message : "Erro"); } };
  return <>
    <div className="grid gap-3">
      <label className="grid gap-1 text-xs">Exame(s) {kind === "laboratorial" ? "(um por linha)" : ""}<Textarea rows={3} value={f.exams} onChange={s("exams")} placeholder={kind === "imagem" ? "Ex.: USG transvaginal; Mamografia bilateral" : kind === "patologico" ? "Ex.: Biópsia de colo uterino" : "Hemograma\nPCR"} /></label>
      {kind === "patologico" && <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs">Material enviado<Input value={f.material} onChange={s("material")} /></label><label className="grid gap-1 text-xs">Local da coleta<Input value={f.site} onChange={s("site")} /></label><label className="grid gap-1 text-xs sm:col-span-2">Dados clínicos / hipótese<Textarea rows={2} value={f.clinical} onChange={s("clinical")} /></label></div>}
      <label className="grid gap-1 text-xs">Justificativa clínica<Textarea rows={2} value={f.justification} onChange={s("justification")} /></label>
      <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs">CID<Input value={f.cid} onChange={s("cid")} /></label><label className="grid gap-1 text-xs">Médico solicitante<DoctorNameInput value={f.by} onChange={(v) => setF((x) => ({ ...x, by: v }))} onCrm={(c) => setF((x) => ({ ...x, council: c }))} /></label><label className="grid gap-1 text-xs">CRM<Input value={f.council} onChange={s("council")} /></label></div>
      <Button onClick={save}>Registrar e imprimir</Button>
    </div>
    {printed && createPortal(<div className="print-doc-root term-root"><ExamSheet p={p} r={printed} /></div>, document.body)}
  </>;
}

function RxDialog({ p, onClose }: { p: Patient; onClose: () => void }) {
  const me = useStore((s) => professionalName(s.profile));
  const [rx, setRx] = useState<ControlledRx>({ items: [{ drug: "", qty: "", dose: "" }], buyer: "", buyerDoc: "", buyerAddress: "" });
  const [doc, setDoc] = useState(() => { const d = currentDoctorFields(); return { name: d.name || me, council: d.crm }; }); const [on, setOn] = useState(false);
  const item = (i: number, k: "drug" | "qty" | "dose", v: string) => setRx({ ...rx, items: rx.items.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const go = () => { const issues = controlledRxIssues(rx); if (issues.length) { toast.error(issues.join(" ")); return; } if (!window.confirm("Confirma a emissão da receita de controle especial (2 vias)?")) return; rememberDoctor(doc.name, doc.council); setOn(true); print(() => { setOn(false); onClose(); }); };
  return <>
    <div className="grid gap-3">
      {rx.items.map((x, i) => <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-3"><Input placeholder="Medicamento e concentração" value={x.drug} onChange={(v) => item(i, "drug", v.target.value)} /><Input placeholder="Quantidade (ex.: 30 – trinta comprimidos)" value={x.qty} onChange={(v) => item(i, "qty", v.target.value)} /><Input placeholder="Posologia" value={x.dose} onChange={(v) => item(i, "dose", v.target.value)} /></div>)}
      <Button variant="outline" size="sm" onClick={() => setRx({ ...rx, items: [...rx.items, { drug: "", qty: "", dose: "" }] })}>+ Medicamento</Button>
      <div className="grid gap-2 sm:grid-cols-3"><Input placeholder="Comprador (opcional)" value={rx.buyer} onChange={(v) => setRx({ ...rx, buyer: v.target.value })} /><Input placeholder="RG do comprador" value={rx.buyerDoc} onChange={(v) => setRx({ ...rx, buyerDoc: v.target.value })} /><Input placeholder="Endereço do comprador" value={rx.buyerAddress} onChange={(v) => setRx({ ...rx, buyerAddress: v.target.value })} /></div>
      <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs">Médico<DoctorNameInput value={doc.name} onChange={(v) => setDoc((d) => ({ ...d, name: v }))} onCrm={(c) => setDoc((d) => ({ ...d, council: c }))} /></label><label className="grid gap-1 text-xs">CRM<Input value={doc.council} onChange={(v) => setDoc({ ...doc, council: v.target.value })} /></label></div>
      <Button onClick={go}>Imprimir receita (2 vias)</Button>
    </div>
    {on && createPortal(<div className="print-doc-root term-root"><RxSheet p={p} rx={rx} name={doc.name} council={doc.council} /></div>, document.body)}
  </>;
}

type Open = ExamKind | "rx" | null;
/** Documentos médicos do consultório: pedidos de exames (vão para o SADT), anatomopatológico e receituário controlado. */
export function MedicalDocsButtons({ p, e }: { p: Patient; e?: Encounter | undefined }) {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  const [open, setOpen] = useState<Open>(null);
  if (!e || !canAct(profile, "prescrever", areas)) return null;
  const btn = "flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted";
  const title = open === "rx" ? "Receituário de controle especial" : open ? `Solicitação · ${KIND_LABELS[open]}` : "";
  return <>
    <button className={btn} onClick={() => setOpen("imagem")}><FileText className="h-4 w-4" />Exame de imagem</button>
    <button className={btn} onClick={() => setOpen("laboratorial")}><FileText className="h-4 w-4" />Exame laboratorial</button>
    <button className={btn} onClick={() => setOpen("patologico")}><Microscope className="h-4 w-4" />Exame patológico</button>
    <button className={btn} onClick={() => setOpen("rx")}><Pill className="h-4 w-4" />Receita controlada</button>
    <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      {open === "rx" ? <RxDialog p={p} onClose={() => setOpen(null)} /> : open && <ExamDialog p={p} e={e} kind={open} onClose={() => setOpen(null)} />}
    </DialogContent></Dialog>
  </>;
}
