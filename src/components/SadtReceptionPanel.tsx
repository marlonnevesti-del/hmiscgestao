import { useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DoctorNameInput } from "./DoctorNameInput";
import { Letterhead } from "./DischargePrint";
import { printProcedure } from "./ProcedurePrint";
import { canAct } from "@/lib/hospital-data";
import type { Encounter } from "@/lib/care-flow";
import { matchPatientsForSadt, RECEPTION_SADT_EXAMS } from "@/lib/sadt-reception";
import { createReceptionSadtRequest, professionalName, useStore } from "@/lib/hospital-store";

export function SadtReceptionPanel() {
  const patients = useStore((s) => s.patients);
  const profile = useStore((s) => s.profile);
  const accessAreas = useStore((s) => s.accessAreas);
  const allowed = canAct(profile, "recepcao", accessAreas);
  const [query, setQuery] = useState("");
  const [birthFilter, setBirthFilter] = useState("");
  const [patientId, setPatientId] = useState("");
  const [examCode, setExamCode] = useState(RECEPTION_SADT_EXAMS[0]!.code);
  const [requester, setRequester] = useState("");
  const [insurance, setInsurance] = useState("SUS");
  const [printed, setPrinted] = useState<{ encounter: Encounter; examName: string; examCode: string; requester: string } | null>(null);

  if (!allowed) return null;
  const matches = matchPatientsForSadt(patients, query, birthFilter);
  const selectedPatient = patients.find((p) => p.id === patientId);
  const selectedExam = RECEPTION_SADT_EXAMS.find((e) => e.code === examCode) ?? RECEPTION_SADT_EXAMS[0]!;

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedPatient) { toast.error("Selecione o paciente antes de confirmar."); return; }
    try {
      const encounter = createReceptionSadtRequest(selectedPatient.id, {
        examCode: selectedExam.code, examName: selectedExam.name, specialty: selectedExam.specialty, requester, insurance,
      });
      toast.success(`Solicitação SADT registrada (${encounter.number})`);
      setPrinted({ encounter, examName: selectedExam.name, examCode: selectedExam.code, requester });
      setTimeout(() => printProcedure(), 60);
      setPatientId(""); setQuery(""); setBirthFilter(""); setRequester("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar a solicitação");
    }
  };

  return <section className="space-y-3 rounded-lg border bg-card p-4">
    <h3 className="font-semibold">Solicitação de Exames · Recepção (Pré-natal / Pré-operatório)</h3>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-xs">Localizar paciente (nome, nome da mãe, CPF ou prontuário)
        <Input placeholder="Digite o nome da paciente ou da mãe…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label className="grid gap-1 text-xs">Data de nascimento (opcional)
        <Input type="date" value={birthFilter} onChange={(e) => setBirthFilter(e.target.value)} />
      </label>
    </div>
    {matches.length > 0 && !selectedPatient && <div className="flex flex-wrap gap-2">
      {matches.map((p) => <Button key={p.id} type="button" size="sm" variant="outline" className="h-auto whitespace-normal text-left" onClick={() => setPatientId(p.id)}>
        {p.name} · Mãe: {p.motherName || p.registration?.parent1 || "—"} · Nasc.: {p.registration?.birthDate || p.age}
      </Button>)}
    </div>}
    {selectedPatient && <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
      <span><b>Paciente:</b> {selectedPatient.name} · <b>Mãe:</b> {selectedPatient.motherName || selectedPatient.registration?.parent1 || "—"} · <b>Prontuário:</b> {selectedPatient.prontuario}</span>
      <Button type="button" size="sm" variant="ghost" onClick={() => setPatientId("")}>Trocar paciente</Button>
    </div>}
    <form className="grid gap-3 md:grid-cols-4" onSubmit={submit}>
      <label className="grid gap-1 text-xs md:col-span-2">Exame solicitado (código SIGTAP)
        <select value={examCode} onChange={(e) => setExamCode(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          {RECEPTION_SADT_EXAMS.map((ex) => <option key={ex.code} value={ex.code}>{ex.shortCode} — {ex.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs">Médico solicitante
        <DoctorNameInput value={requester} onChange={setRequester} />
      </label>
      <label className="grid gap-1 text-xs">Convênio
        <select value={insurance} onChange={(e) => setInsurance(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="SUS">SUS</option><option value="Particular">Particular</option><option value="Convênio">Convênio</option>
        </select>
      </label>
      <div className="flex items-center gap-2 md:col-span-4">
        <Button type="submit" disabled={!selectedPatient}><Printer className="h-4 w-4" />Confirmar e imprimir boletim do exame</Button>
      </div>
    </form>
    {printed && (() => {
      const p = patients.find((x) => x.id === printed.encounter.patientId);
      return createPortal(<div className="print-doc-root proc-root"><div className="sheet-page" style={{ padding: "1.2cm 1.5cm" }}>
        <Letterhead title="BOLETIM DE SOLICITAÇÃO DE EXAME · SADT" />
        <p><b>Nº BAA:</b> {printed.encounter.number} · <b>Origem:</b> Ambulatório · <b>Convênio:</b> {insurance}</p>
        <p><b>Paciente:</b> {p?.name} · <b>Prontuário:</b> {p?.prontuario} · <b>Nascimento:</b> {p?.registration?.birthDate || p?.age}</p>
        <p><b>Nome da mãe:</b> {p?.motherName || p?.registration?.parent1 || "—"} · <b>CNS:</b> {p?.registration?.cns || "—"}</p>
        <div style={{ marginTop: 14, border: "1px solid #000", padding: 10 }}>
          <div><b>Exame solicitado:</b> {printed.examCode} — {printed.examName}</div>
          <div style={{ marginTop: 6 }}><b>Médico solicitante:</b> {printed.requester}</div>
          <div style={{ marginTop: 6 }}><b>Data/hora da emissão:</b> {new Date(printed.encounter.openedAt).toLocaleString("pt-BR")}</div>
        </div>
        <div style={{ marginTop: "2cm", textAlign: "center" }}><div style={{ width: "8cm", margin: "0 auto", borderTop: "1px solid #000" }} />Recepção · {professionalName(profile)}</div>
      </div></div>, document.body);
    })()}
  </section>;
}