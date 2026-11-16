import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoPermission } from "./AppShell";
import { EncounterTimeline } from "./EncounterTimeline";
import { SpecialConditionBadges } from "./SpecialConditions";
import { PatientRegistrationFields } from "./PatientRegistrationFields";
import { registrationFor, registrationPatch } from "@/lib/patient-registration-mapping";
import { registrationSchema } from "@/lib/patient-registration";
import { ATTENDANCE_TYPES, type Encounter } from "@/lib/care-flow";
import { can, type Patient } from "@/lib/hospital-data";
import { deleteEncounter, openEncounter, professionalName, savePatientRegistration, useStore } from "@/lib/hospital-store";
import { SPECIAL_CONDITIONS } from "@/lib/special-conditions";

const INITIAL_FORM = {
  name: "", cpf: "", birth: "", mother: "", guardian: "", insurance: "SUS",
  type: ATTENDANCE_TYPES[0] as string, specialty: "Obstetrícia",
  patientType: "gestante" as Patient["type"], complaint: "",
  conditions: [] as string[], otherCondition: "",
};

export function CareReception() {
  const patients = useStore((s) => s.patients);
  const encounters = useStore((s) => s.encounters);
  const profile = useStore((s) => s.profile);
  const [search, setSearch] = useState("");
  const [existing, setExisting] = useState("");
  const [created, setCreated] = useState<Encounter | null>(null);
  const [f, setF] = useState(INITIAL_FORM);
  const [registration, setRegistration] = useState(() => registrationFor());
  const set = (key: keyof Omit<typeof f, "conditions">, value: string) => setF((current) => ({ ...current, [key]: value }));

  const choose = (patient: Patient) => {
    setRegistration(registrationFor(patient));
    setExisting(patient.id);
    setF((current) => ({
      ...current, name: patient.name, cpf: patient.cpf, birth: patient.age,
      mother: patient.motherName ?? "", guardian: patient.guardian ?? "", insurance: patient.insurance,
      patientType: patient.type, conditions: patient.specialConditions ?? [], otherCondition: patient.otherSpecialCondition ?? "",
    }));
    setSearch("");
  };

  const clearIdentity = () => {
    setRegistration(registrationFor());
    setExisting("");
    setF((current) => ({ ...current, name: "", cpf: "", birth: "", mother: "", guardian: "", conditions: [], otherCondition: "" }));
  };

  const submit = () => {
    try {
      const parsed = registrationSchema.safeParse(registration);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Confira os dados do cadastro.");
      if (!f.specialty.trim()) throw new Error("Preencha a especialidade em Abertura de atendimento.");
      if (!f.complaint.trim()) throw new Error("Preencha a queixa principal em Abertura de atendimento.");
      if (["pediatria", "neonato"].includes(f.patientType) && !registration.guardian.trim() && !registration.parent1.trim()) {
        throw new Error("Para criança ou recém-nascido, preencha o nome do responsável ou da mãe (filiação 1).");
      }
      if (f.conditions.includes("Outra") && !f.otherCondition.trim()) throw new Error("Descreva a outra condição especial.");
      const old = patients.find((patient) => patient.id === existing || (registration.cpf.replace(/\D/g, "").length === 11 && patient.cpf.replace(/\D/g, "") === registration.cpf.replace(/\D/g, "")));
      const id = old?.id ?? crypto.randomUUID();
      const patient: Patient = {
        ...(old ?? {
          id, prontuario: `PR-${new Date().getFullYear()}-${String(patients.length + 1).padStart(6, "0")}`,
          weight: 0, allergies: [], risks: [], diagnosis: "Em avaliação", days: 1, evolutions: [], vitals: [], prescriptions: [],
        }),
        name: f.name.trim(), cpf: f.cpf || "—", age: f.birth || "—", motherName: f.mother, guardian: f.guardian || registration.parent1,
        ...registrationPatch(registration, professionalName(profile), old),
        type: f.patientType, insurance: registration.insurance, authorized: registration.insurance === "SUS" || registration.insurance === "Particular",
        ward: f.patientType === "gestante" || f.patientType === "puerpera" ? "PSO" : "PSP", bed: "",
        admission: new Date().toLocaleString("pt-BR"), prescriptions: [], vitals: old?.vitals ?? [],
        specialConditions: f.conditions, otherSpecialCondition: f.otherCondition.trim(),
      };
      const encounter = openEncounter(patient, f.type, f.specialty, f.complaint);
      setCreated(encounter);
      toast.success(`${encounter.number} gerado e enviado para triagem`);
      clearIdentity();
      setF((current) => ({ ...current, complaint: "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o atendimento");
    }
  };

  const textFields = [
    ["specialty", "Especialidade"], ["complaint", "Queixa principal"],
  ] as const;

  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">Recepção · Boletim de Atendimento</h1>
    {!can(profile, "recepcao") ? <NoPermission action="abrir atendimento" /> : <>
      <div className="max-w-xl space-y-2">
        <Input aria-label="Buscar paciente cadastrado" placeholder="Buscar paciente por nome, CPF ou prontuário" value={search} onChange={(event) => setSearch(event.target.value)} />
        {search.length > 1 && patients.filter((patient) => [patient.name, patient.registration?.civilName ?? "", patient.registration?.socialName ?? "", patient.cpf, patient.prontuario, patient.registration?.cns ?? ""].some((value) => value.toLowerCase().includes(search.toLowerCase()))).slice(0, 6).map((patient) => <Button variant="outline" className="h-auto max-w-full whitespace-normal" key={patient.id} onClick={() => choose(patient)}>{patient.name} · {patient.prontuario}</Button>)}
        {existing && <div className="text-xs text-clinical">Paciente cadastrado selecionado <Button variant="link" onClick={clearIdentity}>Novo paciente</Button></div>}
      </div>
      <form className="grid gap-3 border-y py-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="min-w-0 md:col-span-3"><PatientRegistrationFields value={registration} onChange={setRegistration} recordNumber={patients.find(p => p.id === existing)?.prontuario} /></div>
        {existing && <div className="md:col-span-3"><Button type="button" variant="outline" onClick={() => { try { savePatientRegistration(existing, registration); toast.success("Cadastro atualizado sem abrir novo atendimento"); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar"); } }}>Salvar alterações do cadastro</Button></div>}
        <h2 className="mt-3 border-t pt-4 font-semibold md:col-span-3">Abertura de atendimento</h2>
        {textFields.map(([key, label]) => <label key={key} className="grid gap-1 text-xs">{label}<Input value={f[key]} onChange={(event) => set(key, event.target.value)} required={["name", "specialty", "complaint"].includes(key)} /></label>)}
        <label className="grid gap-1 text-xs">Tipo de paciente<select aria-label="Tipo de paciente" value={f.patientType} onChange={(event) => set("patientType", event.target.value)} className="h-9 rounded-md border bg-background px-2">{[["gestante", "Gestante"], ["puerpera", "Puérpera"], ["pediatria", "Criança"], ["neonato", "Recém-nascido"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="grid gap-1 text-xs">Tipo de atendimento<select value={f.type} onChange={(event) => set("type", event.target.value)} className="h-9 rounded-md border bg-background px-2">{ATTENDANCE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>

        <fieldset className="rounded-lg border bg-card p-4 md:col-span-3">
          <legend className="px-1 text-sm font-semibold">Condições especiais</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {SPECIAL_CONDITIONS.map((condition) => <label key={condition} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={f.conditions.includes(condition)} onCheckedChange={(checked) => setF((current) => ({ ...current, conditions: checked ? [...current.conditions, condition] : current.conditions.filter((item) => item !== condition) }))} />
              {condition}
            </label>)}
          </div>
          {f.conditions.includes("Outra") && <label className="mt-3 grid max-w-xl gap-1 text-xs">Descreva a outra condição<Input aria-label="Descreva a outra condição" value={f.otherCondition} onChange={(event) => set("otherCondition", event.target.value)} required /></label>}
        </fieldset>
        <div className="flex items-end md:col-span-3"><Button type="submit">Gerar Atendimento (BE)</Button></div>
      </form>
    </>}

    <h2 className="font-semibold">Atendimentos abertos ({encounters.filter((encounter) => encounter.status_fluxo !== "ALTA_HOSPITALAR").length})</h2>
    {encounters.slice().reverse().map((encounter) => {
      const patient = patients.find((item) => item.id === encounter.patientId);
      return <div key={encounter.id} className="border-b py-2"><div className="flex flex-wrap items-center gap-2"><Button variant="link" asChild><Link to="/pacientes/$id" params={{ id: encounter.patientId }}>{patient?.name}</Link></Button><SpecialConditionBadges patient={patient} /><span className="text-xs text-muted-foreground">{encounter.number}</span>{profile === "Administrador" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (!window.confirm(`Apagar o atendimento ${encounter.number} de ${patient?.name ?? "paciente"}? Esta ação não pode ser desfeita.`)) return; try { deleteEncounter(encounter.id); toast.success("Atendimento apagado"); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível apagar"); } }}>Apagar</Button>}</div><EncounterTimeline patientId={encounter.patientId} /></div>;
    })}
    {!encounters.length && <p className="py-6 text-sm text-muted-foreground">Nenhum atendimento aberto.</p>}

    <Dialog open={!!created} onOpenChange={(open) => !open && setCreated(null)}>
      <DialogContent><DialogHeader><DialogTitle>Etiqueta / Pulseira · {created?.number}</DialogTitle></DialogHeader>
        <div className="border-2 border-primary p-4"><b>{patients.find((patient) => patient.id === created?.patientId)?.name}</b><div>{created?.number} · {patients.find((patient) => patient.id === created?.patientId)?.prontuario}</div><div>Mãe: {patients.find((patient) => patient.id === created?.patientId)?.motherName}</div><div>Responsável: {patients.find((patient) => patient.id === created?.patientId)?.guardian}</div></div>
        <Button onClick={() => window.print()}>Imprimir etiqueta / pulseira</Button><Button variant="outline" asChild><Link to="/acolhimento">Abrir triagem</Link></Button>
      </DialogContent>
    </Dialog>
  </div>;
}
