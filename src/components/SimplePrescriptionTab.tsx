import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Printer, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Letterhead } from "./DischargePrint";
import { DoctorNameInput } from "./DoctorNameInput";
import { canAct, type Patient, type SimplePrescription } from "@/lib/hospital-data";
import { currentDoctorFields, professionalName, rememberDoctor, saveSimplePrescription, useStore } from "@/lib/hospital-store";

const todayLabel = (iso?: string) => (iso ? new Date(iso) : new Date()).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const birthLabel = (p: Patient) => (p.registration?.birthDate ? new Date(`${p.registration.birthDate}T12:00:00`).toLocaleDateString("pt-BR") : p.age);

function printSheet(onDone: () => void) {
  document.body.classList.add("print-doc", "print-term");
  const finish = () => {
    document.body.classList.remove("print-doc", "print-term");
    onDone();
    window.removeEventListener("afterprint", finish);
  };
  window.addEventListener("afterprint", finish);
  setTimeout(() => window.print(), 120);
}

function SimpleRxSheet({ p, rx }: { p: Patient; rx: SimplePrescription }) {
  return (
    <section className="doc-page">
      <Letterhead title="RECEITUÁRIO SIMPLES" />
      <table className="doc-id">
        <tbody>
          <tr><td><b>Paciente:</b> {p.name}</td><td><b>Nascimento / Idade:</b> {birthLabel(p)}</td></tr>
          <tr><td><b>Prontuário:</b> {p.prontuario}{rx.encounterNumber ? ` · Atendimento: ${rx.encounterNumber}` : ""}</td><td><b>CNS:</b> {p.registration?.cns || "—"}</td></tr>
        </tbody>
      </table>
      <h3 style={{ marginTop: "1em" }}>Uso domiciliar</h3>
      <ol style={{ paddingLeft: "1.4em", lineHeight: 1.6 }}>
        {rx.items.map((item, idx) => (
          <li key={idx} style={{ marginBottom: "0.7em" }}>
            <b>{item.drug}</b>{item.qty ? ` — ${item.qty}` : ""}
            {item.dose && <div style={{ whiteSpace: "pre-wrap" }}>{item.dose}</div>}
          </li>
        ))}
      </ol>
      {rx.notes && (
        <div style={{ marginTop: "1em" }}>
          <b>Orientações gerais:</b>
          <p style={{ whiteSpace: "pre-wrap", margin: "0.3em 0 0" }}>{rx.notes}</p>
        </div>
      )}
      <p style={{ textAlign: "right", marginTop: "2em" }}>Criciúma - SC, {todayLabel(rx.at)}.</p>
      <div className="doc-sign"><div className="line" />{rx.doctor}{rx.council ? ` · ${rx.council}` : ""}</div>
    </section>
  );
}

export function SimplePrescriptionTab({ p, encounterNumber }: { p: Patient; encounterNumber?: string | undefined }) {
  const profile = useStore((s) => s.profile);
  const areas = useStore((s) => s.accessAreas);
  const me = useStore((s) => professionalName(s.profile));
  const allowed = canAct(profile, "prescrever", areas);

  const [doc, setDoc] = useState(() => { const d = currentDoctorFields(); return { name: d.name || me, council: d.crm }; });
  const [items, setItems] = useState([{ drug: "", qty: "", dose: "" }]);
  const [notes, setNotes] = useState("");
  const [printing, setPrinting] = useState<SimplePrescription | null>(null);

  const history = p.simplePrescriptions ?? [];

  const submit = (andPrint: boolean) => {
    try {
      const saved = saveSimplePrescription(p.id, {
        items,
        notes,
        doctor: doc.name,
        council: doc.council,
        ...(encounterNumber ? { encounterNumber } : {}),
      });
      rememberDoctor(saved.doctor, saved.council);
      setItems([{ drug: "", qty: "", dose: "" }]);
      setNotes("");
      toast.success("Receita simples salva no prontuário");
      if (andPrint) {
        setPrinting(saved);
        printSheet(() => setPrinting(null));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a receita.");
    }
  };

  const reprint = (rx: SimplePrescription) => {
    setPrinting(rx);
    printSheet(() => setPrinting(null));
  };

  return (
    <div className="space-y-6 py-4">
      {allowed ? (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div>
            <h2 className="text-base font-semibold">Nova receita simples</h2>
            <p className="text-xs text-muted-foreground">Receituário ambulatorial / uso domiciliar em folha timbrada HMISC.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">Médico emitente<DoctorNameInput value={doc.name} onChange={(name) => setDoc((d) => ({ ...d, name }))} onCrm={(council) => setDoc((d) => ({ ...d, council }))} /></label>
            <label className="grid gap-1 text-xs">CRM / Conselho<Input value={doc.council} onChange={(e) => setDoc((d) => ({ ...d, council: e.target.value }))} placeholder="CRM/SC 00000" /></label>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium">Medicamentos</div>
            {items.map((it, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[2fr_1fr_auto]">
                <Input aria-label={`Medicamento ${idx + 1}`} placeholder="Medicamento e concentração (ex.: Dipirona 500 mg/mL gotas)" value={it.drug} onChange={(e) => setItems((list) => list.map((x, j) => j === idx ? { ...x, drug: e.target.value } : x))} />
                <Input aria-label={`Quantidade ${idx + 1}`} placeholder="Quantidade (ex.: 1 frasco)" value={it.qty} onChange={(e) => setItems((list) => list.map((x, j) => j === idx ? { ...x, qty: e.target.value } : x))} />
                {items.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Remover medicamento" onClick={() => setItems((list) => list.filter((_, j) => j !== idx))}><X className="h-4 w-4" /></Button>}
                <Input aria-label={`Posologia ${idx + 1}`} className="sm:col-span-3" placeholder="Modo de usar / posologia (ex.: Tomar 20 gotas VO de 6/6h se dor ou febre)" value={it.dose} onChange={(e) => setItems((list) => list.map((x, j) => j === idx ? { ...x, dose: e.target.value } : x))} />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((list) => [...list, { drug: "", qty: "", dose: "" }])}><Plus className="mr-1 h-4 w-4" />Adicionar medicamento</Button>
          </div>
          <label className="grid gap-1 text-xs">Orientações gerais (opcional)<Textarea rows={3} placeholder="Sinais de alerta, retorno ao pronto-socorro, cuidados domiciliares..." value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => submit(true)}><Printer className="mr-1.5 h-4 w-4" />Salvar e imprimir receita</Button>
            <Button type="button" variant="outline" onClick={() => submit(false)}><Save className="mr-1.5 h-4 w-4" />Salvar no prontuário</Button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Apenas profissionais com permissão de prescrição podem emitir receitas simples.</p>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Receitas simples emitidas ({history.length})</h3>
        {!history.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma receita simples registrada para este paciente.</p>
        ) : (
          <div className="space-y-2">
            {history.map((rx) => (
              <div key={rx.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(rx.at).toLocaleString("pt-BR")} · <b>{rx.doctor}</b>{rx.council ? ` (${rx.council})` : ""}{rx.encounterNumber ? ` · ${rx.encounterNumber}` : ""}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => reprint(rx)}><Printer className="mr-1 h-3.5 w-3.5" />Reimprimir</Button>
                </div>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  {rx.items.map((it, i) => <li key={i}><b>{it.drug}</b>{it.qty ? ` — ${it.qty}` : ""}{it.dose ? <div className="text-xs text-muted-foreground">{it.dose}</div> : null}</li>)}
                </ol>
                {rx.notes && <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{rx.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {printing && typeof document !== "undefined" && createPortal(<div className="print-doc-root term-root"><SimpleRxSheet p={p} rx={printing} /></div>, document.body)}
    </div>
  );
}