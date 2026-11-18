import { useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rememberDoctor, saveSigtapCode, useStore } from "@/lib/hospital-store";
import { DoctorNameInput } from "./DoctorNameInput";
import { SigtapPicker } from "./SigtapPicker";
import { formatCode } from "@/lib/sigtap";
import type { Patient } from "@/lib/hospital-data";
import { Letterhead, LetterFooter } from "./DischargePrint";

const SECTORS = ["Recepção", "Acolhimento / Triagem", "Consultório médico", "Posto de enfermagem", "Farmácia", "Centro cirúrgico / obstétrico", "Internação", "Fisioterapia", "Serviço social"];
interface Proc { sector: string; name: string; code: string; date: string; start: string; end: string; professional: string; register: string; assistant: string; indication: string; description: string; materials: string; complications: string; notes: string }

/** Imprime somente a ficha de procedimento (oculta o resto da tela). */
export function printProcedure() {
  document.body.classList.add("print-proc");
  const done = () => { document.body.classList.remove("print-proc"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 80);
}

/** Botão "Imprimir procedimento": abre a ficha técnica timbrada, editável, para qualquer setor. */
export function ProcedurePrintButton({ patientId, sector = "", procedure = "", size = "sm" }: { patientId?: string | undefined; sector?: string; procedure?: string; size?: "sm" | "default" }) {
  const p = useStore((s) => s.patients.find((x) => x.id === patientId));
  const enc = useStore((s) => s.encounters.slice().reverse().find((x) => x.patientId === patientId));
  const employee = useStore((s) => s.employeeName);
  const [open, setOpen] = useState(false);
  const now = new Date();
  const blank = (): Proc => ({ sector, name: procedure, code: "", date: now.toISOString().slice(0, 10), start: now.toTimeString().slice(0, 5), end: "", professional: employee, register: "", assistant: "", indication: enc?.medical?.diagnosis ?? enc?.complaint ?? "", description: "", materials: "", complications: "", notes: "" });
  const [f, setF] = useState<Proc>(blank);
  const set = (k: keyof Proc) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const field = (k: keyof Proc, label: string, type = "text") => <label className="grid gap-1 text-xs">{label}<Input type={type} value={f[k]} onChange={(e) => set(k)(e.target.value)} /></label>;
  const area = (k: keyof Proc, label: string) => <label className="grid gap-1 text-xs sm:col-span-2">{label}<textarea aria-label={label} value={f[k]} onChange={(e) => set(k)(e.target.value)} className="min-h-16 rounded-md border bg-background p-2 text-sm" /></label>;
  return <>
    <Button type="button" size={size} variant="outline" onClick={() => { setF(blank()); setOpen(true); }}><Printer className="mr-1 h-4 w-4" />Imprimir procedimento</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Ficha de procedimento{p ? ` · ${p.name}` : ""}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">Setor<select aria-label="Setor" value={f.sector} onChange={(e) => set("sector")(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">Selecionar</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <SigtapPicker onPick={(x) => setF((v) => ({ ...v, name: x.n, code: formatCode(x.c) }))} />{field("name", "Procedimento *")}{field("code", "Código SIGTAP / TUSS")}{field("date", "Data", "date")}{field("start", "Início", "time")}{field("end", "Término", "time")}
          <label className="grid gap-1 text-xs">Profissional executante<DoctorNameInput value={f.professional} onChange={set("professional")} onCrm={set("register")} /></label>{field("register", "Registro (CRM / COREN / CREFITO)")}{field("assistant", "Auxiliar / equipe")}{field("indication", "Indicação / diagnóstico")}
          {area("description", "Descrição técnica")}{area("materials", "Materiais / medicamentos utilizados")}{area("complications", "Intercorrências")}{area("notes", "Orientações / observações")}
        </div>
        <Button disabled={!f.name.trim()} onClick={() => { rememberDoctor(f.professional, f.register); if (enc && f.code) saveSigtapCode(enc.id, f.code); setOpen(false); printProcedure(); }}><Printer className="mr-1 h-4 w-4" />Imprimir ficha</Button>
      </DialogContent>
    </Dialog>
    {open || f.name ? <ProcedureSheet f={f} p={p} be={enc?.number} /> : null}
  </>;
}

function ProcedureSheet({ f, p, be }: { f: Proc; p?: Patient | undefined; be?: string | undefined }) {
  if (typeof document === "undefined") return null;
  const row = (l: string, v: string) => <p><b>{l}:</b> {v || "—"}</p>;
  return createPortal(<div className="print-doc-root proc-root">
    <section className="doc-page">
      <Letterhead title="REGISTRO DE PROCEDIMENTO" />
      <table className="doc-id"><tbody>
        <tr><td><b>Paciente:</b> {p?.name ?? "—"}</td><td><b>Prontuário:</b> {p?.prontuario ?? "—"}</td></tr>
        <tr><td><b>Idade:</b> {p?.age ?? "—"}{p?.weight ? ` · ${p.weight} kg` : ""}</td><td><b>Convênio:</b> {p?.insurance ?? "—"}</td></tr>
        <tr><td><b>Atendimento (BAA):</b> {be ?? "—"}</td><td><b>Alergias:</b> {p?.allergies?.length ? p.allergies.join(", ") : "Nega"}</td></tr>
        <tr><td><b>Setor:</b> {f.sector || "—"}</td><td><b>Leito:</b> {p?.bed ?? "—"}</td></tr>
      </tbody></table>
      {row("Procedimento", f.name)}{row("Código SIGTAP/TUSS", f.code)}
      {row("Data", f.date ? f.date.split("-").reverse().join("/") : "")}{row("Horário", `${f.start || "—"} às ${f.end || "—"}`)}
      {row("Executante", `${f.professional}${f.register ? ` · ${f.register}` : ""}`)}{row("Auxiliar / equipe", f.assistant)}{row("Indicação", f.indication)}
      <h3>Descrição técnica</h3><p className="pre">{f.description || "—"}</p>
      <h3>Materiais / medicamentos</h3><p className="pre">{f.materials || "—"}</p>
      <h3>Intercorrências</h3><p className="pre">{f.complications || "Sem intercorrências."}</p>
      <h3>Orientações / observações</h3><p className="pre">{f.notes || "—"}</p>
      <div className="doc-sign"><div className="line" />{f.professional}<br />Carimbo / {f.register || "Registro profissional"}</div>
      <LetterFooter />
    </section>
  </div>, document.body);
}
