import { useEffect, useState } from "react";
import { ArrowLeftRight, Printer, X } from "lucide-react";
import { PatientSheetPrint, printSheet } from "./PatientSheetPrint";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoPermission } from "./AppShell";
import { EncounterTimeline } from "./EncounterTimeline";
import { InpatientDocsButtons } from "./InpatientDocsPrint";
import { SpecialConditionBadges } from "./SpecialConditions";
import { PatientRegistrationFields } from "./PatientRegistrationFields";
import { patientsByCpf, registrationFor, registrationPatch } from "@/lib/patient-registration-mapping";
import { PEDIATRIC_EXCEPTION_REASONS, ageYears, pediatricAgeIssue, newbornBirthIssue, registrationIssues, registrationSchema, unknownPatientName, type PatientRegistration, type RegistrationMode } from "@/lib/patient-registration";
import { ATTENDANCE_TYPES, type Encounter } from "@/lib/care-flow";
import { can, canAct, WARDS, type Patient } from "@/lib/hospital-data";
import { cancelUnattendedEncounter, deleteEncounter, openEncounter, professionalName, rectifyOpenEncounter, registerPatientOnly, requestAdmission, savePatientRegistration, switchAmbulatorySector, useStore } from "@/lib/hospital-store";
import { SPECIAL_CONDITIONS } from "@/lib/special-conditions";
import { AMBULATORY_MOTIVES, GROUP_LABELS, canEditOrCancelEncounter, isObstetricSpecialty, type AmbulatoryMotive, type CareUnit } from "@/lib/ambulatorio";
import { AMBULATORY_PRESETS, buildInfoSusProcedures, type AmbulatoryPreset } from "@/lib/sadt-reception";

const INITIAL_FORM = {
  name: "", cpf: "", birth: "", mother: "", guardian: "", insurance: "SUS",
  type: ATTENDANCE_TYPES[0] as string, specialty: "Obstetrícia",
  patientType: "gestante" as Patient["type"], complaint: "", ambMotive: "CONSULTA" as AmbulatoryMotive,
  conditions: [] as string[], otherCondition: "", nursingPreConsult: false,
};

export function CareReception({ unit }: { unit?: CareUnit } = {}) {
  const ambSpecialties = useStore((s) => s.ambSpecialties);
  const patients = useStore((s) => s.patients);
  const encounters = useStore((s) => s.encounters);
  const profile = useStore((s) => s.profile); const accessAreas = useStore((s) => s.accessAreas);
  const [search, setSearch] = useState("");
  const [existing, setExisting] = useState("");
  const [cpfStatus, setCpfStatus] = useState("");
  const [created, setCreated] = useState<Encounter | null>(null);
  const [preset, setPreset] = useState<AmbulatoryPreset | null>(null);
  const [infoSusCodes, setInfoSusCodes] = useState<string[]>([]);
  const [rectifyEnc, setRectifyEnc] = useState<Encounter | null>(null);
  const [rectifyForm, setRectifyForm] = useState({ specialty: "", complaint: "" });
  const [admEnc, setAdmEnc] = useState<Encounter | null>(null);
  const [admForm, setAdmForm] = useState({ ward: "", character: "Urgência" as "Urgência" | "Eletiva", cid: "", justification: "", isolation: false, oxygen: false });
  // Assim que o atendimento é confirmado, a BAA abre direto para impressão e assinatura.
  useEffect(() => {
    if (!created) return;
    const t = setTimeout(() => printSheet("BAA"), 400);
    return () => clearTimeout(t);
  }, [created]);
  const [f, setF] = useState(() => unit ? { ...INITIAL_FORM, type: unit, specialty: unit === "Ambulatório" ? "" : unit === "Maternidade" ? "Obstetrícia" : "Pediatria", patientType: (unit === "Pronto socorro" ? "pediatria" : "gestante") as Patient["type"] } : INITIAL_FORM);
  const [registration, setRegistration] = useState(() => registrationFor());
  const [mode, setMode] = useState<RegistrationMode>("completo");
  const [pedEx, setPedEx] = useState<{ on: boolean; reason: string; note: string }>({ on: false, reason: "", note: "" });
  const set = (key: keyof Omit<typeof f, "conditions" | "nursingPreConsult">, value: string) => setF((current) => ({ ...current, [key]: value }));

  const choose = (patient: Patient) => {
    setCpfStatus("");
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
    setCpfStatus("");
    setRegistration(registrationFor());
    setExisting("");
    setF((current) => ({ ...current, name: "", cpf: "", birth: "", mother: "", guardian: "", conditions: [], otherCondition: "" }));
  };

  const changeRegistration = (next: PatientRegistration) => {
    if (next.cpf === registration.cpf) {
      setRegistration(next);
      return;
    }
    // A changed identifier must never silently retain another patient's identity.
    if (existing && next.cpf.replace(/\D/g, "") !== registration.cpf.replace(/\D/g, "")) {
      clearIdentity();
      next = { ...registrationFor(), cpf: next.cpf };
    }
    const matches = patientsByCpf(patients, next.cpf);
    const patient = matches.length === 1 ? matches[0] : undefined;
    if (patient) {
      choose(patient);
      setCpfStatus("Dados recuperados do cadastro HMISC. Confira antes de salvar.");
      return;
    }
    setRegistration(next);
    setCpfStatus(next.cpf.replace(/\D/g, "").length !== 11 ? "" : matches.length > 1
      ? "CPF presente em mais de um cadastro. Selecione o paciente pela busca antes de continuar."
      : "CPF não encontrado no HMISC. Preencha os dados do novo paciente.");
  };

  const birthError = f.patientType === "neonato" && !registration.estimatedAge ? newbornBirthIssue(registration.birthDate) : null;
  const isPediatric = f.patientType === "pediatria" || /pediatr/i.test(f.specialty);
  const pedAge = isPediatric && !registration.estimatedAge ? ageYears(registration.birthDate) : null;
  const overPedAge = pedAge !== null && pedAge > 14;
  const pedError = isPediatric && !registration.estimatedAge ? pediatricAgeIssue(registration.birthDate, pedEx.on ? pedEx : null) : null;
  const buildPatient = (requireEncounterFields: boolean) => {
    if (birthError) throw new Error(birthError);
    if (requireEncounterFields && pedError) throw new Error(pedError);
    const reg = registration.unknownIdentity && !registration.civilName.trim() ? { ...registration, civilName: unknownPatientName(registration.unknownNumber) } : registration;
    const missing = registrationIssues(reg, mode);
    if (missing.length) throw new Error(missing[0]);
    const parsed = registrationSchema.safeParse(reg);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Confira os dados do cadastro.");
    if (requireEncounterFields) {
      if (!f.specialty.trim()) throw new Error("Preencha a especialidade em Abertura de atendimento.");
      if (!f.complaint.trim()) throw new Error("Preencha a queixa principal em Abertura de atendimento.");
    }
    if (mode === "completo" && ["pediatria", "neonato"].includes(f.patientType) && !registration.guardian.trim() && !registration.parent1.trim()) {
      throw new Error("Para criança ou recém-nascido, preencha o nome do responsável ou da mãe (filiação 1).");
    }
    if (f.conditions.includes("Outra") && !f.otherCondition.trim()) throw new Error("Descreva a outra condição especial.");
    const cpfMatches = patientsByCpf(patients, registration.cpf);
    if (!existing && cpfMatches.length > 1) throw new Error("CPF duplicado. Selecione o paciente pela busca antes de continuar.");
    const old = patients.find((patient) => patient.id === existing) ?? cpfMatches[0];
    const id = old?.id ?? crypto.randomUUID();
    const patient: Patient = {
      ...(old ?? {
        id, prontuario: `PR-${new Date().getFullYear()}-${String(patients.length + 1).padStart(6, "0")}`,
        weight: 0, allergies: [], risks: [], diagnosis: "Em avaliação", days: 1, evolutions: [], vitals: [], prescriptions: [],
      }),
      name: f.name.trim() || reg.civilName, cpf: f.cpf || "—", age: f.birth || "—", motherName: f.mother, guardian: f.guardian || registration.parent1,
      ...registrationPatch(reg, professionalName(profile), old),
      type: f.patientType, insurance: registration.insurance, authorized: registration.insurance === "SUS" || registration.insurance === "Particular",
      ward: f.patientType === "gestante" || f.patientType === "puerpera" ? "PSO" : "PSP", bed: "",
      admission: old?.admission ?? new Date().toLocaleString("pt-BR"), prescriptions: old?.prescriptions ?? [], vitals: old?.vitals ?? [],
      specialConditions: f.conditions, otherSpecialCondition: f.otherCondition.trim(),
      ...(overPedAge && pedEx.on ? { pediatricException: { reason: pedEx.reason, note: pedEx.note.trim(), age: pedAge ?? 0, at: new Date().toISOString(), by: professionalName(profile) } } : {}),
    };
    return { patient, reg };
  };
  const saveOnly = () => {
    try {
      const { patient } = buildPatient(false);
      registerPatientOnly(patient);
      toast.success(`Paciente ${patient.name} cadastrado com sucesso (sem gerar atendimento)`);
      clearIdentity();
      setF((current) => ({ ...current, complaint: "", nursingPreConsult: false }));
      setPedEx({ on: false, reason: "", note: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cadastro");
    }
  };
  const submit = () => {
    try {
      const { patient, reg } = buildPatient(true);
      if (!window.confirm(`Confirmar o cadastro e a abertura do atendimento de ${patient.name}?\nNascimento: ${reg.birthDate || "não informado"} · Sexo: ${reg.sex || "—"} · CNS/CPF: ${reg.cns || reg.cpf || "—"}`)) return;
      const baseComplaint = unit === "Ambulatório" ? (f.complaint.trim() ? `${f.ambMotive} · ${f.complaint.trim()}` : f.ambMotive) : f.complaint;
      const finalComplaint = overPedAge && pedEx.on ? `${baseComplaint} [Exceção pediátrica ${pedAge} anos: ${pedEx.reason}${pedEx.note.trim() ? ` – ${pedEx.note.trim()}` : ""}]` : baseComplaint;
      const toNursing = unit === "Ambulatório" ? (f.nursingPreConsult || isObstetricSpecialty(f.specialty)) : f.nursingPreConsult;
      const at = new Date().toISOString();
      const extraProcedures = preset ? buildInfoSusProcedures(preset, infoSusCodes, professionalName(profile), at) : undefined;
      const encounter = openEncounter(
        { ...patient, admission: new Date().toLocaleString("pt-BR"), prescriptions: [] },
        f.type, f.specialty, finalComplaint, toNursing,
        preset ? { sigtapCode: preset.mainSigtap.code, ...(extraProcedures?.length ? { extraProcedures } : {}) } : undefined,
      );
      setCreated(encounter);
      toast.success(`${encounter.number} gerado e enviado para ${encounter.status_fluxo === "AGUARDANDO_TRIAGEM" ? "Triagem / Enfermagem" : "Consultório Ambulatório"}`);
      clearIdentity();
      setF((current) => ({ ...current, complaint: "", ambMotive: "CONSULTA", nursingPreConsult: false }));
      setPreset(null); setInfoSusCodes([]);
      setPedEx({ on: false, reason: "", note: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o atendimento");
    }
  };

  const textFields = (unit === "Ambulatório" ? [["complaint", "Observação / Queixa (opcional)"]] : [["specialty", "Especialidade"], ["complaint", "Queixa principal"]]) as readonly (readonly ["specialty" | "complaint", string])[];
  const shown = unit ? encounters.filter((encounter) => encounter.type === unit) : encounters;

  return <div className="space-y-4">
    {!unit && <h1 className="text-xl font-semibold">Recepção · Boletim de Atendimento</h1>}
    {!canAct(profile, "recepcao", accessAreas) ? <NoPermission action="abrir atendimento" /> : <>
      <div className="max-w-xl space-y-2">
        <Input aria-label="Buscar paciente cadastrado" placeholder="Buscar paciente por nome, CPF ou prontuário" value={search} onChange={(event) => setSearch(event.target.value)} />
        {search.length > 1 && patients.filter((patient) => [patient.name, patient.registration?.civilName ?? "", patient.registration?.socialName ?? "", patient.cpf, patient.prontuario, patient.registration?.cns ?? ""].some((value) => value.toLowerCase().includes(search.toLowerCase()))).slice(0, 6).map((patient) => <Button variant="outline" className="h-auto max-w-full whitespace-normal" key={patient.id} onClick={() => choose(patient)}>{patient.name} · {patient.prontuario}</Button>)}
        {existing && <div className="text-xs text-clinical">Paciente cadastrado selecionado <Button variant="link" onClick={clearIdentity}>Novo paciente</Button></div>}
      </div>
      <form className="grid gap-3 border-y py-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="flex flex-wrap gap-2 md:col-span-3" role="group" aria-label="Tipo de cadastro">
          <Button type="button" variant={mode === "completo" ? "default" : "outline"} onClick={() => setMode("completo")}>Cadastro completo</Button>
          <Button type="button" variant={mode === "simplificado" ? "destructive" : "outline"} onClick={() => setMode("simplificado")}>Cadastro simplificado (emergência / sem documento)</Button>
          <span className="self-center text-xs text-muted-foreground">Campos em azul com * são obrigatórios.</span>
        </div>
        {cpfStatus && <p role="status" className="text-sm text-muted-foreground md:col-span-3">{cpfStatus}</p>}
        <div className="min-w-0 md:col-span-3"><PatientRegistrationFields birthError={birthError} mode={mode} value={registration} onChange={changeRegistration} recordNumber={patients.find(p => p.id === existing)?.prontuario} /></div>
        {existing && <div className="md:col-span-3"><Button type="button" variant="outline" onClick={() => { try { savePatientRegistration(existing, registration); toast.success("Cadastro atualizado sem abrir novo atendimento"); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar"); } }}>Salvar alterações do cadastro</Button></div>}
        <h2 className="mt-3 border-t pt-4 font-semibold md:col-span-3">Abertura de atendimento</h2>
        {unit === "Ambulatório" && <>
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs md:col-span-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Atalhos de atendimento SADT / Ambulatório:</span>
              {AMBULATORY_PRESETS.map((pr) => <Button key={pr.id} type="button" size="sm" variant={preset?.id === pr.id ? "default" : "outline"} onClick={() => {
                setPreset(pr);
                setInfoSusCodes([]);
                setF((c) => ({ ...c, specialty: pr.specialty, ambMotive: pr.motive, patientType: pr.patientType, nursingPreConsult: false, complaint: `${pr.sector} · ${pr.room} · ${pr.professional}` }));
              }}>{pr.label}</Button>)}
              {preset && <Button type="button" size="sm" variant="ghost" onClick={() => { setPreset(null); setInfoSusCodes([]); }}>Limpar atalho</Button>}
            </div>
            {preset && <div className="space-y-2 border-t pt-2">
              <div><b>Procedimento principal SUS:</b> {preset.mainSigtap.shortCode} — {preset.mainSigtap.name} · <b>Profissional:</b> {preset.professional}</div>
              <div className="font-medium">INFO SUS · Códigos adicionais de faturamento:</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {preset.infoSus.map((opt) => <label key={opt.code} className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={infoSusCodes.includes(opt.code)} onCheckedChange={(checked) => setInfoSusCodes((cur) => checked ? [...cur, opt.code] : cur.filter((x) => x !== opt.code))} />
                  <span><b>{opt.shortCode}</b> — {opt.name}</span>
                </label>)}
              </div>
            </div>}
          </div>
          <div className="grid gap-1 text-xs md:col-span-3">
            <span className="font-medium">Setor de atendimento</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Setor de atendimento">
              <Button type="button" size="sm" variant={!(f.nursingPreConsult || isObstetricSpecialty(f.specialty)) ? "default" : "outline"} disabled={isObstetricSpecialty(f.specialty)} onClick={() => setF((c) => ({ ...c, nursingPreConsult: false }))}>Consultório Ambulatório</Button>
              <Button type="button" size="sm" variant={(f.nursingPreConsult || isObstetricSpecialty(f.specialty)) ? "default" : "outline"} onClick={() => setF((c) => ({ ...c, nursingPreConsult: true }))}>Triagem / Enfermagem{isObstetricSpecialty(f.specialty) ? " (obrigatória: obstétrico)" : ""}</Button>
            </div>
          </div>
          <label className="grid gap-1 text-xs">Motivo de atendimento<select aria-label="Motivo de atendimento" value={f.ambMotive} onChange={(event) => setF((c) => ({ ...c, ambMotive: event.target.value as AmbulatoryMotive }))} className="h-9 rounded-md border bg-background px-2">{AMBULATORY_MOTIVES.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
          <label className="grid gap-1 text-xs">Tipo de atendimento (Especialidade)<select aria-label="Especialidade" value={f.specialty} onChange={(event) => set("specialty", event.target.value)} required className="h-9 rounded-md border bg-background px-2"><option value="">Selecione…</option>{(["medica", "nao_medica", "sadt"] as const).map((g) => <optgroup key={g} label={GROUP_LABELS[g]}>{ambSpecialties.filter((x) => x.group === g && x.active).map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</optgroup>)}</select></label>
        </>}
        {textFields.map(([key, label]) => <label key={key} className="grid gap-1 text-xs">{label}<Input value={f[key]} onChange={(event) => set(key, event.target.value)} required={unit === "Ambulatório" ? false : ["name", "specialty", "complaint"].includes(key)} /></label>)}
        <label className="grid gap-1 text-xs">Tipo de paciente<select aria-label="Tipo de paciente" value={f.patientType} onChange={(event) => set("patientType", event.target.value)} className="h-9 rounded-md border bg-background px-2">{[["gestante", "Gestante"], ["puerpera", "Puérpera"], ["pediatria", "Criança"], ["neonato", "Recém-nascido"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        {overPedAge && <div role="alert" className={`grid gap-2 rounded-lg border-2 p-3 text-xs md:col-span-3 ${pedError ? "border-destructive bg-destructive/10" : "border-clinical bg-clinical-soft"}`}>
          <div className="font-semibold text-destructive">Paciente com {pedAge} anos excede o limite padrão da Pediatria (14 anos).</div>
          <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={pedEx.on} onChange={(e) => setPedEx((c) => ({ ...c, on: e.target.checked }))} />Admissão pediátrica excepcional (acima de 14 anos)</label>
          {pedEx.on && <><label className="grid gap-1">Motivo da exceção<select aria-label="Motivo da exceção pediátrica" value={pedEx.reason} onChange={(e) => setPedEx((c) => ({ ...c, reason: e.target.value }))} className="h-9 rounded-md border bg-background px-2"><option value="">Selecione…</option>{PEDIATRIC_EXCEPTION_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="grid gap-1">Justificativa {pedEx.reason === "Outro motivo clínico" ? "(obrigatória)" : "(opcional)"}<Input value={pedEx.note} onChange={(e) => setPedEx((c) => ({ ...c, note: e.target.value }))} /></label></>}
        </div>}
        {!unit && <label className="grid gap-1 text-xs">Tipo de atendimento<select value={f.type} onChange={(event) => set("type", event.target.value)} className="h-9 rounded-md border bg-background px-2">{ATTENDANCE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>}

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
        <div className="flex flex-wrap items-end gap-2 md:col-span-3"><Button type="submit" disabled={!!birthError}>Gerar Atendimento (BAA)</Button><Button type="button" variant="outline" disabled={!!birthError} onClick={saveOnly}>Cadastrar Paciente</Button>{birthError && <Button type="button" variant="outline" onClick={() => setF((x) => ({ ...x, patientType: "pediatria" }))}>Mudar para Pediátrico</Button>}</div>
      </form>
    </>}

    <h2 className="font-semibold">Atendimentos abertos ({shown.filter((encounter) => encounter.status_fluxo !== "ALTA_HOSPITALAR").length})</h2>
    {shown.slice().reverse().map((encounter) => {
      const patient = patients.find((item) => item.id === encounter.patientId);
      const unattended = canEditOrCancelEncounter(encounter);
      const canRec = canAct(profile, "recepcao", accessAreas);
      const canForwardAdm = canRec && encounter.status_fluxo !== "ALTA_HOSPITALAR" && !encounter.fia;
      return <div key={encounter.id} className="border-b py-2"><div className="flex flex-wrap items-center gap-2"><Button variant="link" asChild><Link to="/pacientes/$id" params={{ id: encounter.patientId }}>{patient?.name}</Link></Button><SpecialConditionBadges patient={patient} /><span className="text-xs text-muted-foreground">{encounter.number}</span>{patient && <InpatientDocsButtons p={patient} e={encounter} />}{canForwardAdm && (encounter.admission?.status === "pendente" ? <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Aguardando leito no NIR</span> : <Button size="sm" variant="outline" onClick={() => { setAdmEnc(encounter); setAdmForm({ ward: "", character: "Urgência", cid: encounter.medical?.cid ?? "", justification: encounter.complaint || "", isolation: false, oxygen: false }); }}>Encaminhar p/ internação</Button>)}{encounter.type === "Ambulatório" && unattended && canRec && <Button size="sm" variant="outline" onClick={() => { const toNursing = encounter.status_fluxo !== "AGUARDANDO_TRIAGEM"; try { switchAmbulatorySector(encounter.id, toNursing); toast.success(toNursing ? "Alterado para Triagem / Enfermagem" : "Alterado para Consultório Ambulatório"); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar o setor"); } }}><ArrowLeftRight className="h-3.5 w-3.5" />{encounter.status_fluxo === "AGUARDANDO_TRIAGEM" ? "Mudar para Consultório" : "Mudar para Triagem"}</Button>}{unattended && canRec && <Button size="sm" variant="outline" onClick={() => { setRectifyEnc(encounter); setRectifyForm({ specialty: encounter.specialty, complaint: encounter.complaint }); }}>Retificar abertura</Button>}{unattended && canRec && <Button size="icon" variant="ghost" aria-label={`Excluir atendimento ${encounter.number}`} title="Excluir atendimento não iniciado" className="ml-auto h-7 w-7 text-destructive" onClick={() => { if (!window.confirm(`Excluir o atendimento ${encounter.number} de ${patient?.name ?? "paciente"}? Só é possível enquanto não houver atendimento iniciado.`)) return; try { cancelUnattendedEncounter(encounter.id); toast.success("Atendimento excluído"); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir"); } }}><X className="h-4 w-4" /></Button>}{!unattended && profile === "Administrador" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (!window.confirm(`Apagar o atendimento ${encounter.number} de ${patient?.name ?? "paciente"}? Esta ação não pode ser desfeita.`)) return; try { deleteEncounter(encounter.id); toast.success("Atendimento apagado"); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível apagar"); } }}>Apagar</Button>}</div><EncounterTimeline patientId={encounter.patientId} /></div>;
    })}
    {!shown.length && <p className="py-6 text-sm text-muted-foreground">Nenhum atendimento aberto.</p>}

    <Dialog open={!!admEnc} onOpenChange={(open) => !open && setAdmEnc(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Encaminhar para internação · {admEnc?.number}</DialogTitle></DialogHeader>
        <form className="grid gap-3 text-sm" onSubmit={(ev) => {
          ev.preventDefault();
          if (!admEnc) return;
          try {
            requestAdmission(admEnc.id, { ...admForm, source: "recepcao" });
            toast.success("Encaminhamento enviado ao NIR (aguardando escolha de leito)");
            setAdmEnc(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível encaminhar");
          }
        }}>
          <p className="text-xs text-muted-foreground">A escolha do leito será feita pelo regulador no NIR.</p>
          <label className="grid gap-1">Caráter<select aria-label="Caráter" value={admForm.character} onChange={(e) => setAdmForm((c) => ({ ...c, character: e.target.value as "Urgência" | "Eletiva" }))} className="h-9 rounded-md border bg-background px-2"><option>Urgência</option><option>Eletiva</option></select></label>
          <label className="grid gap-1">Setor sugerido (opcional)<select aria-label="Setor sugerido" value={admForm.ward} onChange={(e) => setAdmForm((c) => ({ ...c, ward: e.target.value }))} className="h-9 rounded-md border bg-background px-2"><option value="">Definir pelo NIR</option>{WARDS.filter((w) => ["AC", "UTIN", "ENFP", "UTIP", "UCI"].includes(w.id)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="grid gap-1">CID-10 (opcional)<Input value={admForm.cid} onChange={(e) => setAdmForm((c) => ({ ...c, cid: e.target.value }))} placeholder="Ex.: J18.9" /></label>
          <label className="grid gap-1">Justificativa / Motivo<textarea value={admForm.justification} onChange={(e) => setAdmForm((c) => ({ ...c, justification: e.target.value }))} className="min-h-20 rounded-md border bg-background p-2" required /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={admForm.isolation} onChange={(e) => setAdmForm((c) => ({ ...c, isolation: e.target.checked }))} />Precisa de isolamento</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={admForm.oxygen} onChange={(e) => setAdmForm((c) => ({ ...c, oxygen: e.target.checked }))} />Precisa de oxigênio</label>
          <Button type="submit">Confirmar encaminhamento ao NIR</Button>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={!!rectifyEnc} onOpenChange={(open) => !open && setRectifyEnc(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Retificar abertura · {rectifyEnc?.number}</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={(ev) => {
          ev.preventDefault();
          if (!rectifyEnc) return;
          try {
            rectifyOpenEncounter(rectifyEnc.id, rectifyForm);
            toast.success("Abertura do atendimento retificada");
            setRectifyEnc(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível retificar");
          }
        }}>
          <label className="grid gap-1 text-xs">Especialidade / Tipo de atendimento<Input value={rectifyForm.specialty} onChange={(e) => setRectifyForm((c) => ({ ...c, specialty: e.target.value }))} required /></label>
          <label className="grid gap-1 text-xs">Motivo / Observação<Input value={rectifyForm.complaint} onChange={(e) => setRectifyForm((c) => ({ ...c, complaint: e.target.value }))} /></label>
          <Button type="submit">Salvar retificação</Button>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={!!created} onOpenChange={(open) => !open && setCreated(null)}>
      <DialogContent><DialogHeader><DialogTitle>Etiqueta / Pulseira · {created?.number}</DialogTitle></DialogHeader>
        <div className="border-2 border-primary p-4"><b>{patients.find((patient) => patient.id === created?.patientId)?.name}</b><div>{created?.number} · {patients.find((patient) => patient.id === created?.patientId)?.prontuario}</div><div>Mãe: {patients.find((patient) => patient.id === created?.patientId)?.motherName}</div><div>Responsável: {patients.find((patient) => patient.id === created?.patientId)?.guardian}</div></div>
        <Button onClick={() => printSheet("BAA")}><Printer className="h-4 w-4" />Imprimir BAA novamente</Button><Button variant="outline" onClick={() => window.print()}>Imprimir etiqueta / pulseira</Button><Button variant="outline" asChild><Link to="/acolhimento">Abrir triagem</Link></Button>
      </DialogContent>
    </Dialog>
    {created && (() => { const cp = patients.find((patient) => patient.id === created.patientId); return cp ? <PatientSheetPrint p={cp} e={created} user={professionalName(profile)} /> : null; })()}
  </div>;
}
