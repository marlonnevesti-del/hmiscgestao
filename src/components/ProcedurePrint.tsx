import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addEncounterProcedures, currentDoctorFields, rememberDoctor, useStore } from "@/lib/hospital-store";
import { DoctorNameInput } from "./DoctorNameInput";
import { SigtapPicker } from "./SigtapPicker";
import { formatCode } from "@/lib/sigtap";
import type { Patient } from "@/lib/hospital-data";
import { Letterhead, LetterFooter } from "./DischargePrint";

const SECTORS = ["Recepção", "Acolhimento / Triagem", "Consultório médico", "Posto de enfermagem", "Farmácia", "Centro cirúrgico / obstétrico", "Internação", "Fisioterapia", "Serviço social"];
interface ProcItem { id: string; name: string; code: string }
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
  const blank = (): Proc => ({ sector, name: procedure, code: "", date: now.toISOString().slice(0, 10), start: now.toTimeString().slice(0, 5), end: "", professional: currentDoctorFields().name || employee, register: currentDoctorFields().crm, assistant: "", indication: enc?.medical?.diagnosis ?? enc?.complaint ?? "", description: "", materials: "", complications: "", notes: "" });
  const [f, setF] = useState<Proc>(blank);
  const [items, setItems] = useState<ProcItem[]>([]);
  const [adding, setAdding] = useState(true);
  const set = (k: keyof Proc) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const field = (k: keyof Proc, label: string, type = "text") => <label className="grid gap-1 text-xs">{label}<Input type={type} value={f[k]} onChange={(e) => set(k)(e.target.value)} /></label>;
  const area = (k: keyof Proc, label: string) => <label className="grid gap-1 text-xs sm:col-span-2">{label}<textarea aria-label={label} value={f[k]} onChange={(e) => set(k)(e.target.value)} className="min-h-16 rounded-md border bg-background p-2 text-sm" /></label>;
  const confirmItem = () => {
    if (!f.name.trim()) return;
    setItems((prev) => [...prev, { id: `p-${crypto.randomUUID()}`, name: f.name.trim(), code: f.code.trim() }]);
    setF((x) => ({ ...x, name: "", code: "" }));
    setAdding(false);
  };
  const allItems: ProcItem[] = f.name.trim() ? [...items, { id: "draft", name: f.name.trim(), code: f.code.trim() }] : items;
  return <>
    <Button type="button" size={size} variant="outline" onClick={() => { setF(blank()); setItems([]); setAdding(true); setOpen(true); }}><Printer className="mr-1 h-4 w-4" />Imprimir procedimento</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Ficha de procedimento{p ? ` · ${p.name}` : ""}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">Setor<select aria-label="Setor" value={f.sector} onChange={(e) => set("sector")(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">Selecionar</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <div className="space-y-2 rounded-md border p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Procedimentos e códigos SIGTAP ({items.length})</span>
              {!adding && <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" />Inserir mais código</Button>}
            </div>
            {items.length > 0 && <ul className="space-y-1">
              {items.map((it) => <li key={it.id} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
                <span><b>{it.name}</b>{it.code ? <span className="ml-2 font-mono text-muted-foreground">{it.code}</span> : null}</span>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label={`Remover ${it.name}`} onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}><X className="h-3.5 w-3.5" /></Button>
              </li>)}
            </ul>}
            {adding && <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2"><SigtapPicker onPick={(x) => setF((v) => ({ ...v, name: x.n, code: formatCode(x.c) }))} /></div>
              {field("name", "Procedimento *")}{field("code", "Código SIGTAP / TUSS")}
              <div className="flex items-center gap-2 sm:col-span-2">
                <Button type="button" size="sm" disabled={!f.name.trim()} onClick={confirmItem}><Check className="mr-1 h-4 w-4" />Confirmar código</Button>
                {items.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => { setF((x) => ({ ...x, name: "", code: "" })); setAdding(false); }}>Cancelar</Button>}
              </div>
            </div>}
          </div>
          {field("date", "Data", "date")}{field("start", "Início", "time")}{field("end", "Término", "time")}
          <label className="grid gap-1 text-xs">Profissional executante<DoctorNameInput value={f.professional} onChange={set("professional")} onCrm={set("register")} /></label>{field("register", "Registro (CRM / COREN / CREFITO)")}{field("assistant", "Auxiliar / equipe")}{field("indication", "Indicação / diagnóstico")}
          {area("description", "Descrição técnica")}{area("materials", "Materiais / medicamentos utilizados")}{area("complications", "Intercorrências")}{area("notes", "Orientações / observações")}
        </div>
        <Button disabled={!allItems.length} onClick={() => { rememberDoctor(f.professional, f.register); if (enc) addEncounterProcedures(enc.id, allItems.map((x) => ({ name: x.name, code: x.code, sector: f.sector }))); setOpen(false); printProcedure(); }}><Printer className="mr-1 h-4 w-4" />Imprimir ficha</Button>
      </DialogContent>
    </Dialog>
    {open || allItems.length > 0 ? <ProcedureSheet f={f} items={allItems} p={p} be={enc?.number} /> : null}
  </>;
}

function ProcedureSheet({ f, items, p, be }: { f: Proc; items: ProcItem[]; p?: Patient | undefined; be?: string | undefined }) {
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
      {items.length <= 1 ? <>{row("Procedimento", items[0]?.name ?? f.name)}{row("Código SIGTAP/TUSS", items[0]?.code ?? f.code)}</> : <>
        <h3>Procedimentos realizados</h3>
        <table className="doc-id"><thead><tr><th style={{ textAlign: "left" }}>Procedimento</th><th style={{ textAlign: "left" }}>Código SIGTAP/TUSS</th></tr></thead><tbody>
          {items.map((it) => <tr key={it.id}><td>{it.name}</td><td>{it.code || "—"}</td></tr>)}
        </tbody></table>
      </>}
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
