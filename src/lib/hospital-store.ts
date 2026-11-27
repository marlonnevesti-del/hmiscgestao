import { EMPTY_MILK_BANK, LHP_VALIDITY_DAYS, batchApproved, kcalFromCrematocrit, type MilkBank } from './milk-bank';
import { milkCareText, validateMilkCare, type MilkCareRecord } from './milk-care';
import { canDispenseNow, isImmediatePrescription, remainingDoses } from './pharmacy-schedule';
import { physioRequestIssues } from './physio';
import { DEFAULT_TRIAGE_SIGTAP, detectTriageProcedures, medicalSigtapCode, requireMedicalSigtap } from './medical-sigtap';
import { serviceRequestIssues } from './service-orders';
import { maternityResult, type MaternityKind, type MaternityRecord } from './maternity';
import { canAccessUnitTab } from './hospital-data';
import { bedAgeIssue } from './nir-rules';
import { AMEND_FIELDS, amendIssue, readField, type AmendField } from './document-amend';
import { DEFAULT_KITS, checkKitUse, findKit, setBio, startCycle, type BioResult, type CmeCycle, type CmeKit, type KitStatus } from './cme';
import { useSyncExternalStore } from "react";
import { linkCode } from "./barcode";
import { PATIENTS, QUEUE, SURGERIES, type Admin, type Newborn, type Patient, type Profile, type QueueItem, type SimplePrescription, type Surgery } from "./hospital-data";

import { transition, validateTriage, type Encounter, type ExtraProcedure, type Triage, type FlowStatus } from "./care-flow";
import { BASE_BEDS, can, canAct, canAccessPage, canApproveInventory } from "./hospital-data";
import { buildInventoryAdjustments, type InventorySession } from "./inventory";
import { DEFAULT_CID_AREAS, DEFAULT_CID_GROUPS, addArea, addGroup, type CidArea, type CidGroup } from "./cid-access";
import { DEFAULT_ROOMS, addRoomName, pushCall, removeRoomName, type PanelCall } from "./panel-calls";
import { catalogToStock, findStockMedication, medicationKey, type StockMedication } from "./pharmacy-stock";
import CATALOG from "./stock-catalog.json";
import CONTROLLED from "./controlled-catalog.json";
import WAREHOUSE from "./warehouse-catalog.json";
import { expiryStatus } from "./controlled";
import { atbBlocksPharmacy, emptySciras, BUNDLES, type BundleType, type Isolate, type ScirasRecord } from "./sciras";
import { changeQty, checkQty, loanReturnedQty, transferItem, type Depot, type Movement, type SupplyRequest } from "./supply-flow";
export const PHARMACY_CATALOG = catalogToStock([...CATALOG.farm, ...CONTROLLED], 'farm');
export const WAREHOUSE_CATALOG = catalogToStock(WAREHOUSE, 'almox');
import { registrationPatch } from "./patient-registration-mapping";
import { ageYears, emptyRegistration, type PatientRegistration } from "./patient-registration";
import { doctorKey, validDoctorCns, documentCns, learnDoctor, mergeDoctors, mergeImportedDoctors, resolveDoctor, type Doctor } from "./doctors";
import { addSpecialty, canEditOrCancelEncounter, DEFAULT_SPECIALTIES, isObstetricSpecialty, type AmbSpecialty, type Appointment, type SadtReport, type SpecialtyGroup } from "./ambulatorio";
import { normText, type AgendaImportItem } from "./agenda-import";
import { DEFAULT_INSTITUTION, normalizeInstitution, type InstitutionConfig } from "./institution";

interface State { encounters: Encounter[]; beSequence: number; fiaSequence: number; stock: StockMedication[]; warehouse: StockMedication[]; profile: Profile; employeeName: string; patients: Patient[]; queue: QueueItem[]; surgeries: Surgery[]; admins: Record<string, Admin>; rooms: string[]; calls: PanelCall[]; cidGroups: CidGroup[]; cidAreas: CidArea[]; employeeArea: string; accessAreas: string[] | null; removedStock: string[]; movements: Movement[]; requests: SupplyRequest[]; ambSpecialties: AmbSpecialty[]; appointments: Appointment[]; cmeKits: CmeKit[]; cmeCycles: CmeCycle[]; doctors: Doctor[]; milkBank: import('./milk-bank').MilkBank; inventories: InventorySession[]; institution: InstitutionConfig }
let state: State = { profile: "Outro", employeeName: "", patients: [], queue: [], surgeries: [], admins: {}, encounters: [], beSequence: 0, fiaSequence: 0, stock: PHARMACY_CATALOG, warehouse: WAREHOUSE_CATALOG, rooms: DEFAULT_ROOMS, calls: [], cidGroups: DEFAULT_CID_GROUPS, cidAreas: DEFAULT_CID_AREAS, employeeArea: "", accessAreas: null, removedStock: [], movements: [], requests: [], ambSpecialties: DEFAULT_SPECIALTIES, appointments: [], cmeKits: DEFAULT_KITS, cmeCycles: [], doctors: [], milkBank: EMPTY_MILK_BANK, inventories: [], institution: DEFAULT_INSTITUTION };
let employeeCrm = '';
export function setEmployeeCrm(crm: string) { employeeCrm = crm; }
export function currentDoctor() { return resolveDoctor(mergeDoctors(state.doctors), state.employeeName, employeeCrm); }
export function doctorForDocument(name: string) { return resolveDoctor(mergeDoctors(state.doctors), name); }
export function currentDoctorFields() { const d = currentDoctor(); return { name: d?.name || state.employeeName, crm: d?.crm || employeeCrm, cns: documentCns(d) }; }
const ls = new Set<() => void>();
export const getState = () => state;
export function setState(fn: (s: State) => Partial<State>) { state = { ...state, ...fn(state) }; ls.forEach((l) => l()); }
const sub = (l: () => void) => { ls.add(l); return () => { ls.delete(l); }; };
export const subscribeState = sub;
export function useStore<T>(sel: (s: State) => T): T { return useSyncExternalStore(sub, () => sel(state), () => sel(state)); }

export const updatePatient = (id: string, fn: (p: Patient) => Partial<Patient>) =>
  setState((s) => ({ patients: s.patients.map((p) => (p.id === id ? { ...p, ...fn(p) } : p)) }));
export const professionalName = (_p: Profile) => state.employeeName || "Colaborador";
export const nowHM = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

import { takeSequence } from './sequence-pool';
import { defaultProviderForKind, examRequestIssues as examRequestIssuesFn, moveExam as moveExamFn, nextExamOrderNumber, type ExamAuditStatus } from './exam-requests';
import type { PsDestination, PsEncounter, PsInfo, ScaleRecord, SepsisKind } from './ps-infantil';
import { PS_BEDS } from './ps-infantil';
function requireAction(action: Parameters<typeof can>[1]) {
  if (!canAct(state.profile, action, state.accessAreas)) throw new Error('Seu perfil não permite esta ação.');
}
export const encounterFor = (patientId: string) => state.encounters.slice().reverse().find((e) => e.patientId === patientId);
function getEncounter(id: string) {
  const e = state.encounters.find((x) => x.id === id);
  if (!e) throw new Error('Atendimento não encontrado.');
  const p = state.patients.find((x) => x.id === e.patientId);
  if (!p) throw new Error('Paciente não encontrado.');
  return { e, p };
}
function commitEncounter(e: Encounter, patch: Partial<State> = {}) {
  setState((s) => ({ ...patch, encounters: s.encounters.map((x) => x.id === e.id ? e : x), queue: s.queue.filter((q) => q.id !== e.id) }));
}
export function openEncounter(
  patient: Patient,
  type: string,
  specialty: string,
  complaint: string,
  nursingPreConsult = false,
  opts?: { sigtapCode?: string; extraProcedures?: ExtraProcedure[] },
) {
  requireAction('recepcao');
  if (state.encounters.some((e) => e.patientId === patient.id && e.status_fluxo !== 'ALTA_HOSPITALAR')) throw new Error('Paciente já possui um BAA ativo.');
  const at = new Date().toISOString();
  const beq = takeSequence('baa', state.beSequence + 1);
  const number = `BAA-${new Date().getFullYear()}-${String(beq).padStart(6, '0')}`;
  const ambToNursing = type === 'Ambulatório' && (nursingPreConsult || isObstetricSpecialty(specialty));
  const e: Encounter = {
    id: crypto.randomUUID(), patientId: patient.id, number, type, specialty, complaint,
    ...(ambToNursing ? { nursingPreConsult: true } : {}),
    ...(opts?.sigtapCode ? { sigtapCode: opts.sigtapCode } : {}),
    ...(opts?.extraProcedures?.length ? { extraProcedures: opts.extraProcedures } : {}),
    status_fluxo: 'AGUARDANDO_TRIAGEM', openedAt: at,
    history: [{ status: 'AGUARDANDO_TRIAGEM', at, by: professionalName(state.profile), note: ambToNursing ? 'Recepção: encaminhado para Triagem / Enfermagem' : 'Recepção: abertura de BAA' }],
  };
  const direct = type === 'Ambulatório' && !ambToNursing;
  const opened = direct ? transition(e, 'AGUARDANDO_MEDICO', professionalName(state.profile), 'Ambulatório: encaminhado direto ao Consultório', at) : e;
  setState((s) => ({ beSequence: Math.max(s.beSequence, beq), patients: [...s.patients.filter((p) => p.id !== patient.id), patient], encounters: [...s.encounters, opened], queue: direct ? s.queue : [...s.queue, { id: e.id, name: patient.name, group: patient.type === 'gestante' || patient.type === 'puerpera' ? 'obstetrica' : 'pediatria', complaint, arrivedMinAgo: 0, detail: patient.age }] }));
  return opened;
}
export function rectifyOpenEncounter(
  id: string,
  patch: { specialty?: string; complaint?: string; sigtapCode?: string; extraProcedures?: ExtraProcedure[] },
) {
  requireAction('recepcao');
  const { e } = getEncounter(id);
  if (!canEditOrCancelEncounter(e)) throw new Error('Não é possível retificar: o atendimento já foi iniciado.');
  const at = new Date().toISOString();
  const by = professionalName(state.profile);
  const next: Encounter = {
    ...e,
    ...(patch.specialty !== undefined && patch.specialty.trim() ? { specialty: patch.specialty.trim() } : {}),
    ...(patch.complaint !== undefined ? { complaint: patch.complaint.trim() } : {}),
    ...(patch.sigtapCode !== undefined ? { sigtapCode: patch.sigtapCode.trim() } : {}),
    ...(patch.extraProcedures !== undefined ? { extraProcedures: patch.extraProcedures } : {}),
    history: [...e.history, { status: e.status_fluxo, at, by, note: 'Recepção: abertura do atendimento retificada' }],
  };
  setState((s) => ({ encounters: s.encounters.map((x) => x.id === id ? next : x) }));
  return next;
}
export function createReceptionSadtRequest(
  patientId: string,
  input: { examCode: string; examName: string; specialty: string; requester: string; insurance?: string },
) {
  requireAction('recepcao');
  const p = state.patients.find((x) => x.id === patientId);
  if (!p) throw new Error('Paciente não encontrado.');
  if (!input.examCode.trim() || !input.examName.trim()) throw new Error('Selecione o exame.');
  if (!input.requester.trim()) throw new Error('Informe o médico solicitante.');
  const at = new Date().toISOString();
  const by = professionalName(state.profile);
  const complaint = `Solicitação SADT · ${input.examCode} - ${input.examName} · Solicitante: ${input.requester.trim()} · Convênio: ${input.insurance || 'SUS'}`;
  return openEncounter(p, 'Ambulatório', input.specialty, complaint, false, {
    sigtapCode: input.examCode,
    extraProcedures: [{ id: crypto.randomUUID(), code: input.examCode, name: input.examName, at, by }],
  });
}
export function switchAmbulatorySector(id: string, toNursing: boolean) {
  requireAction('recepcao');
  const { e } = getEncounter(id);
  if (e.type !== 'Ambulatório') throw new Error('Troca de setor disponível apenas para o Ambulatório.');
  if (!canEditOrCancelEncounter(e)) throw new Error('Não é possível alterar o setor: o paciente já iniciou atendimento.');
  const at = new Date().toISOString();
  const by = professionalName(state.profile);
  const { nursingPreConsult: _n, ...base } = e;
  const nextStatus = toNursing ? 'AGUARDANDO_TRIAGEM' : 'AGUARDANDO_MEDICO';
  const note = toNursing ? 'Recepção: alterado para Triagem / Enfermagem' : 'Recepção: alterado para Consultório Ambulatório';
  const next: Encounter = { ...base, ...(toNursing ? { nursingPreConsult: true } : {}), status_fluxo: nextStatus, history: [...e.history, { status: nextStatus, at, by, note }] };
  setState((s) => ({ encounters: s.encounters.map((x) => x.id === id ? next : x) }));
  return next;
}
export function cancelUnattendedEncounter(id: string) {
  requireAction('recepcao');
  const { e } = getEncounter(id);
  if (!canEditOrCancelEncounter(e)) throw new Error('Não é possível excluir: o paciente já iniciou atendimento.');
  setState((s) => ({ encounters: s.encounters.filter((x) => x.id !== id), queue: s.queue.filter((q) => q.id !== id) }));
}
export function completeAmbulatoryNursing(
  id: string,
  input: { vitals?: { pas: number; pad: number; fc: number; fr: number; tax: number; sat: number }; weight?: number; height?: number; summary?: string; text: string },
) {
  if (!canAct(state.profile, 'checar', state.accessAreas) && !canAct(state.profile, 'triagem', state.accessAreas)) {
    throw new Error('Sem permissão para finalizar pré-consulta de enfermagem.');
  }
  if (!input.text.trim()) throw new Error('Digite a evolução de enfermagem.');
  const { e, p } = getEncounter(id);
  const at = new Date().toISOString();
  const by = professionalName(state.profile);
  const next = e.status_fluxo === 'AGUARDANDO_TRIAGEM'
    ? transition(e, 'AGUARDANDO_MEDICO', by, 'Enfermagem: pré-consulta finalizada e encaminhada ao consultório', at)
    : { ...e, history: [...e.history, { status: e.status_fluxo, at, by, note: 'Enfermagem: pré-consulta atualizada' }] };
  const evoText = `Pré-consulta ${e.number}${input.summary ? `\nSinais vitais: ${input.summary}` : ''}\n${input.text.trim()}`;
  commitEncounter(next, {
    patients: state.patients.map((x) => x.id === p.id ? {
      ...x,
      ...(input.weight && input.weight > 0 ? { weight: input.weight } : {}),
      ...(input.height && input.height > 0 ? { height: input.height } : {}),
      vitals: input.vitals ? [...x.vitals, { time: nowHM(), ...input.vitals, dor: 0, ingesta: 0, diurese: 0, vomitos: 0 }] : x.vitals,
      evolutions: [{ time: new Date().toLocaleString('pt-BR'), cat: 'Enfermagem' as const, author: by, text: evoText }, ...x.evolutions],
    } : x),
  });
  return next;
}
export function savePatientRegistration(id: string, input: PatientRegistration) {
  requireAction('recepcao');
  const patient = state.patients.find(p => p.id === id);
  if (!patient) throw new Error('Paciente não encontrado.');
  const patch = registrationPatch(input, professionalName(state.profile), patient);
  setState(s => ({ patients: s.patients.map(p => p.id === id ? { ...p, ...patch } : p), queue: s.queue.map(q => s.encounters.some(e => e.id === q.id && e.patientId === id) ? { ...q, name: patch.name ?? q.name, detail: patch.age ?? q.detail } : q) }));
}
export function registerPatientOnly(patient: Patient) {
  requireAction('recepcao');
  setState((s) => ({
    patients: [...s.patients.filter((p) => p.id !== patient.id), patient],
  }));
  return patient;
}
export function completeTriage(id: string, t: Triage) {
  requireAction('triagem');
  const { e, p } = getEncounter(id);
  validateTriage(p.type === 'pediatria' || p.type === 'neonato', t);
  const triage: Triage = { ...t, sigtapCode: t.sigtapCode || DEFAULT_TRIAGE_SIGTAP };
  const detected = detectTriageProcedures({ pas: t.vital.pas, pad: t.vital.pad, tax: t.vital.tax, weight: t.weight, height: t.height, head: t.head });
  const at = new Date().toISOString();
  const by = professionalName(state.profile);
  const extraProcedures = [...(e.extraProcedures ?? [])];
  for (const item of detected) {
    if (!extraProcedures.some((x) => x.code.replace(/\D/g, '') === item.code)) {
      extraProcedures.push({ id: `proc-${crypto.randomUUID()}`, name: item.name, code: item.code, sector: 'Triagem', at, by });
    }
  }
  const next = e.status_fluxo === 'AGUARDANDO_MEDICO'
    ? { ...e, history: [...e.history, { status: e.status_fluxo, at, by, note: 'Reclassificação de risco pelo PCACR' }] }
    : transition(e, 'AGUARDANDO_MEDICO', by, 'Triagem concluída');
  commitEncounter({ ...next, triage, complaint: t.complaint, extraProcedures }, { patients: state.patients.map((x) => x.id === p.id ? { ...x, weight: t.weight, ...(Number(t.height) > 0 ? { height: Number(t.height) } : {}), guardian: t.guardian, ig: t.ig, dum: t.dum, allergies: t.allergies, risks: t.allergies.length ? [...new Set([...x.risks, 'Alergia' as const])] : x.risks.filter((r) => r !== 'Alergia'), vitals: [...x.vitals, t.vital] } : x) });
}
/** Profissional que está com o paciente em consulta agora (semáforo entre computadores). */
export function inCareBy(e: Encounter): string | null {
  if (e.status_fluxo !== 'EM_ATENDIMENTO_MEDICO') return null;
  return [...e.history].reverse().find((h) => h.status === 'EM_ATENDIMENTO_MEDICO')?.by ?? null;
}
export function callPatient(id: string) {
  requireAction('prescrever');
  const { e } = getEncounter(id);
  const owner = inCareBy(e);
  if (owner && owner !== professionalName(state.profile)) throw new Error(`Paciente já está em atendimento médico com ${owner}.`);
  commitEncounter({ ...transition(e, 'EM_ATENDIMENTO_MEDICO', professionalName(state.profile), 'Consulta / reavaliação iniciada'), sigtapCode: medicalSigtapCode(e.sigtapCode) });
}
export function saveMedical(id: string, medical: NonNullable<Encounter['medical']>) {
  requireAction('prescrever'); const { e, p } = getEncounter(id);
  if (e.status_fluxo !== 'EM_ATENDIMENTO_MEDICO') throw new Error('Inicie o atendimento médico primeiro.');
  requireMedicalSigtap(e.sigtapCode ?? '');
  commitEncounter({ ...e, medical }, { patients: state.patients.map((x) => x.id === p.id ? { ...x, diagnosis: medical.diagnosis, evolutions: [{ time: new Date().toLocaleString('pt-BR'), cat: 'Médica' as const, author: professionalName(state.profile), text: `Anamnese: ${medical.anamnesis}\nExame: ${medical.exam}\nCID-10: ${medical.cid}\nHipótese: ${medical.diagnosis}` }, ...x.evolutions] } : x) });
}
export function signPrescription(id: string) {
  requireAction('prescrever'); const { e, p } = getEncounter(id);
  if (!e.medical?.diagnosis.trim() && !p.diagnosis.trim()) throw new Error('Registre a avaliação e hipótese diagnóstica.');
  const fresh = p.prescriptions.filter((r) => !r.batchId && r.pharmacy !== 'Dispensada');
  if (!fresh.length) throw new Error('Adicione novos itens à prescrição antes de liberar.');
  const freshIds = new Set(fresh.map((r) => r.id));
  const needsPharmacy = fresh.some((r) => r.cat === 'Medicamento' || r.cat === 'Hidratação');
  const at = new Date().toISOString();
  const batchId = crypto.randomUUID();
  const by = professionalName(state.profile);
  const target = needsPharmacy ? 'AGUARDANDO_FARMACIA' : (e.status_fluxo === 'EM_ATENDIMENTO_MEDICO' ? 'EM_OBSERVACAO_REAVALIACAO' : e.status_fluxo);
  const next = target === e.status_fluxo
    ? { ...e, history: [...e.history, { status: e.status_fluxo, at, by, note: 'Prescrição atualizada' }] }
    : transition(e, target, by, 'Prescrição liberada', at);
  commitEncounter({ ...next, signedAt: at, signedBy: professionalName(state.profile), prescriptionBatchId: batchId }, { patients: state.patients.map((x) => x.id === p.id ? { ...x, prescriptions: x.prescriptions.map((r) => !freshIds.has(r.id) ? r : r.cat === 'Medicamento' || r.cat === 'Hidratação' ? { ...r, batchId, pharmacy: 'Pendente', times: r.times?.length ? r.times : [nowHM()] } : r.cat === 'Cuidados' ? { ...r, batchId, times: r.times?.length ? r.times : [nowHM()] } : { ...r, batchId }) } : x) });
}
export function validatePrescription(id: string, rxId: string) {
  requireAction('farmacia'); const { e, p } = getEncounter(id);
  if (e.status_fluxo !== 'AGUARDANDO_FARMACIA') throw new Error('Prescrição não está na farmácia.');
  const rx = p.prescriptions.find((r) => r.id === rxId);
  if (rx && atbBlocksPharmacy(rx)) throw new Error(rx.atb?.status === 'Negado' ? 'Antimicrobiano negado pela SCIRAS.' : 'Antimicrobiano restrito aguardando autorização da SCIRAS.');
  updatePatient(p.id, (x) => ({ prescriptions: x.prescriptions.map((r) => r.id === rxId ? { ...r, pharmacy: 'Validada' } : r) }));
}
/** Farmacêutico ajusta dose/apresentação de um item ainda na farmácia; registra o ajuste no próprio item. */
export function adjustPrescription(id: string, rxId: string, item: string, posologia: string) {
  requireAction('farmacia'); const { e, p } = getEncounter(id);
  if (e.status_fluxo !== 'AGUARDANDO_FARMACIA') throw new Error('Prescrição não está na farmácia.');
  if (!item.trim()) throw new Error('Informe a dose do item.');
  updatePatient(p.id, (x) => ({ prescriptions: x.prescriptions.map((r) => r.id === rxId ? { ...r, item: item.trim().replace(/ · ajuste farmácia$/, '') + ' · ajuste farmácia', posologia: posologia.trim() || r.posologia } : r) }));
}
/** Farmácia informa falta de um item: os demais seguem dispensados e o item volta ao médico para reavaliação. */
export function reportShortage(id: string, rxId: string, reason: string, suggestion = '') {
  requireAction('farmacia'); const { e, p } = getEncounter(id);
  const rx = p.prescriptions.find((r) => r.id === rxId);
  if (!rx || rx.batchId !== e.prescriptionBatchId || !rx.pharmacy) throw new Error('Item não está na farmácia.');
  if (rx.pharmacy === 'Em falta') throw new Error('Falta já informada para este item.');
  if (!reason.trim()) throw new Error('Informe o motivo da falta.');
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const shortage = { reason: reason.trim(), ...(suggestion.trim() ? { suggestion: suggestion.trim() } : {}), at, by };
  const prescriptions = p.prescriptions.map((r) => r.id === rxId ? { ...r, pharmacy: 'Em falta' as const, shortage } : r);
  const stillPending = prescriptions.some((r) => r.batchId === e.prescriptionBatchId && r.pharmacy && r.pharmacy !== 'Em falta' && remainingDoses(r).length > 0 && r.pharmacy !== 'Dispensada');
  const note = `Intervenção farmacêutica: ${rx.item} em falta (${shortage.reason})${shortage.suggestion ? ` · sugestão: ${shortage.suggestion}` : ''} - reavaliar prescrição`;
  const base = { ...e, history: [...e.history, { status: e.status_fluxo, at, by, note }] };
  const nothingDispensed = !prescriptions.some((r) => r.batchId === e.prescriptionBatchId && (r.pharmacy === 'Dispensada' || r.pharmacy === 'Parcial'));
  const next = e.status_fluxo === 'AGUARDANDO_FARMACIA' && !stillPending
    ? transition(e, nothingDispensed ? 'EM_OBSERVACAO_REAVALIACAO' : 'AGUARDANDO_MEDICACAO', by, note, at)
    : base;
  commitEncounter(next, { patients: state.patients.map((x) => x.id === p.id ? { ...x, prescriptions } : x) });
}
export function dispenseKit(
  id: string,
  intervention: string,
  lots: Record<string, string> = {},
  opts?: { now?: Date; specialCaseReason?: string; retainRemaining?: boolean; targetTime?: string },
) {
  requireAction('farmacia'); const { e, p } = getEncounter(id);
  const targetTime = opts?.targetTime?.trim() || undefined;
  const allBatchMeds = p.prescriptions.filter((r) => r.batchId === e.prescriptionBatchId && r.pharmacy && r.pharmacy !== 'Em falta');
  const meds = targetTime
    ? allBatchMeds.filter((r) => {
        const pending = remainingDoses(r);
        if (r.times?.length) return pending.includes(targetTime);
        return targetTime === 'Agora' && r.pharmacy !== 'Dispensada';
      })
    : allBatchMeds;
  if (!meds.length || meds.some((r) => r.pharmacy !== 'Validada' && !(targetTime && r.pharmacy === 'Parcial'))) {
    throw new Error('Valide todos os itens do kit antes de dispensar.');
  }
  const gate = canDispenseNow(meds, opts);
  if (!gate.ok) throw new Error(gate.reason);
  const missingLot = meds.find((r) => !(lots[r.id] ?? (targetTime ? r.lot : '') ?? '').trim());
  if (missingLot) throw new Error(`Informe o lote de ${missingLot.item}.`);
  const specialReason = (opts?.specialCaseReason ?? '').trim();
  const dosePlan = new Map<string, string[]>();
  meds.forEach((r) => {
    if (targetTime) {
      dosePlan.set(r.id, r.times?.length ? [targetTime] : ['']);
      return;
    }
    const pending = remainingDoses(r);
    const onlyFirst = Boolean(opts?.retainRemaining) && pending.length >= 2;
    const onlyImmediateBefore16 = gate.isBeforeStart && !specialReason;
    if (onlyImmediateBefore16 && !isImmediatePrescription(r)) {
      dosePlan.set(r.id, []);
    } else if (onlyFirst || (onlyImmediateBefore16 && pending.length >= 2)) {
      dosePlan.set(r.id, pending.slice(0, 1));
    } else {
      dosePlan.set(r.id, pending.length ? pending : ['']);
    }
  });
  const required = new Map<string, number>();
  meds.forEach((r) => {
    const count = (dosePlan.get(r.id) ?? []).length;
    if (!count) return;
    const medication = findStockMedication(state.stock, r.item);
    if (!medication) throw new Error(`Estoque insuficiente: ${medicationKey(r.item)}. Cadastre o medicamento e registre a entrada.`);
    required.set(medication.id, (required.get(medication.id) ?? 0) + count);
  });
  for (const [medicationId, qty] of required) {
    const medication = state.stock.find((item) => item.id === medicationId);
    if (!medication || medication.quantity < qty) throw new Error(`Estoque insuficiente: ${medication?.name ?? medicationId}. Disponível: ${medication?.quantity ?? 0}; necessário: ${qty}.`);
  }
  let stock = state.stock;
  meds.forEach((r) => {
    const count = (dosePlan.get(r.id) ?? []).length;
    if (!count) return;
    const m = findStockMedication(stock, r.item)!;
    stock = changeQty(stock, m.id, -count, (lots[r.id] ?? (targetTime ? r.lot : '') ?? '').trim());
  });
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const prescriber = e.signedBy?.trim() || e.fia?.doctor?.trim() || undefined;
  const consumo = meds
    .filter((r) => (dosePlan.get(r.id) ?? []).length > 0)
    .map((r) => {
      const m = findStockMedication(state.stock, r.item)!;
      const dosesNow = dosePlan.get(r.id) ?? [];
      const baseReason = targetTime ? `Dispensação horário ${targetTime}` : 'Dispensação';
      const reason = specialReason ? `${baseReason} (caso especial: ${specialReason})` : baseReason;
      return { id: crypto.randomUUID(), at, by, ...(prescriber ? { prescriber } : {}), kind: 'consumo' as const, from: m.location ?? 'Farmácia', to: p.name, item: m.name, code: m.code, qty: dosesNow.length, lot: (lots[r.id] ?? (targetTime ? r.lot : '') ?? '').trim(), reason, patient: p.name, patientId: p.id, baa: e.number, ...(e.fia ? { fia: e.fia.number } : {}) };
    });
  const requisition = `${String(state.movements.length + state.encounters.indexOf(e) * 7 + 230000).slice(-6)}/${new Date().getFullYear()}`;
  const dispensed = e.status_fluxo === 'AGUARDANDO_FARMACIA'
    ? transition(e, 'AGUARDANDO_MEDICACAO', by, targetTime ? `Horário ${targetTime} dispensado` : 'Medicamentos prescritos dispensados', at)
    : e;
  const next = allBatchDosesDone(dispensed, p, state.admins) ? transition(dispensed, 'EM_OBSERVACAO_REAVALIACAO', by, 'Doses já concluídas - pronto para reavaliação', at) : dispensed;
  commitEncounter(
    { ...next, intervention, dispensedAt: at, dispensedBy: by, requisition },
    {
      stock,
      movements: [...consumo, ...state.movements],
      patients: state.patients.map((x) =>
        x.id === p.id
          ? {
              ...x,
              prescriptions: x.prescriptions.map((r) => {
                if (r.batchId !== e.prescriptionBatchId || !r.pharmacy || r.pharmacy === 'Em falta') return r;
                if (targetTime && !dosePlan.has(r.id)) return r;
                const dosesNow = (dosePlan.get(r.id) ?? []).filter(Boolean);
                const nextDispensed = Array.from(new Set([...(r.dispensedTimes ?? []), ...dosesNow]));
                const allTimes = r.times ?? [];
                const allDone = !allTimes.length || allTimes.every((t) => nextDispensed.includes(t));
                return {
                  ...r,
                  pharmacy: allDone ? 'Dispensada' : 'Parcial',
                  lot: (lots[r.id] ?? r.lot ?? '').trim(),
                  ...(allTimes.length ? { dispensedTimes: nextDispensed } : {}),
                  ...(specialReason ? { specialCaseReason: specialReason } : {}),
                };
              }),
            }
          : x,
      ),
    },
  );
}
/** Entrega uma dose programada que ficou retida na farmácia no respectivo horário. */
export function dispenseScheduledDose(
  encounterId: string,
  rxId: string,
  time: string,
  lot: string,
  opts?: { now?: Date; specialCaseReason?: string },
) {
  requireAction('farmacia'); const { e, p } = getEncounter(encounterId);
  const rx = p.prescriptions.find((r) => r.id === rxId);
  if (!rx || !rx.times?.includes(time)) throw new Error('Horário de dose não encontrado.');
  if (rx.dispensedTimes?.includes(time)) throw new Error('Esta dose já foi entregue.');
  const gate = canDispenseNow([rx], opts);
  if (!gate.ok) throw new Error(gate.reason);
  const cleanLot = (lot || rx.lot || '').trim();
  if (!cleanLot) throw new Error(`Informe o lote de ${rx.item}.`);
  const medication = findStockMedication(state.stock, rx.item);
  if (!medication || medication.quantity < 1) throw new Error(`Estoque insuficiente: ${medication?.name ?? medicationKey(rx.item)}.`);
  const stock = changeQty(state.stock, medication.id, -1, cleanLot);
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const prescriber = e.signedBy?.trim() || e.fia?.doctor?.trim() || undefined;
  const specialReason = (opts?.specialCaseReason ?? '').trim();
  const reason = specialReason ? `Dispensação programada ${time} (caso especial: ${specialReason})` : `Dispensação programada ${time}`;
  const movement = { id: crypto.randomUUID(), at, by, ...(prescriber ? { prescriber } : {}), kind: 'consumo' as const, from: medication.location ?? 'Farmácia', to: p.name, item: medication.name, code: medication.code, qty: 1, lot: cleanLot, reason, patient: p.name, patientId: p.id, baa: e.number, ...(e.fia ? { fia: e.fia.number } : {}) };
  const nextDispensed = Array.from(new Set([...(rx.dispensedTimes ?? []), time]));
  const allDone = rx.times.every((t) => nextDispensed.includes(t));
  setState((s) => ({
    stock,
    movements: [movement, ...s.movements],
    patients: s.patients.map((x) =>
      x.id === p.id
        ? {
            ...x,
            prescriptions: x.prescriptions.map((r) =>
              r.id === rxId ? { ...r, lot: cleanLot, dispensedTimes: nextDispensed, pharmacy: allDone ? 'Dispensada' : 'Parcial' } : r,
            ),
          }
        : x,
    ),
  }));
}
const depotKey = (d: Depot) => (d === 'farmacia' ? 'stock' : 'warehouse') as 'stock' | 'warehouse';
const depotAction = (d: Depot): 'farmacia' | 'almoxarifado' => (d === 'farmacia' ? 'farmacia' : 'almoxarifado');
const DEPOT_NAME: Record<Depot, string> = { farmacia: 'Farmácia', almoxarifado: 'Almoxarifado' };
function logMovement(m: Omit<Movement, 'id' | 'at' | 'by'>) { return [{ ...m, id: crypto.randomUUID(), at: new Date().toISOString(), by: professionalName(state.profile) }, ...state.movements]; }
/** Transfere produto entre almoxarifado e farmácia, com lote. */
export function transferStock(from: Depot, itemId: string, qty: number, lot: string) {
  requireAction(depotAction(from));
  const to: Depot = from === 'farmacia' ? 'almoxarifado' : 'farmacia';
  const r = transferItem(state[depotKey(from)], state[depotKey(to)], itemId, qty, lot, to === 'farmacia' ? 'farm' : 'almox');
  setState(() => ({ [depotKey(from)]: r.src, [depotKey(to)]: r.dst, movements: logMovement({ kind: 'transferencia', from: DEPOT_NAME[from], to: DEPOT_NAME[to], item: r.item.name, code: r.item.code, qty, lot: lot.trim(), reason: '' }) }) as Partial<State>);
}
/** Devolução de produto não utilizado: volta ao saldo do lote. */
export function returnStock(depot: Depot, itemId: string, qty: number, lot: string, origin: string, reason: string) {
  requireAction(depotAction(depot)); checkQty(qty);
  if (!lot.trim()) throw new Error('Informe o lote devolvido.');
  if (!origin.trim() || !reason.trim()) throw new Error('Informe a origem e o motivo da devolução.');
  const items = changeQty(state[depotKey(depot)], itemId, qty, lot);
  const item = items.find((i) => i.id === itemId)!;
  setState(() => ({ [depotKey(depot)]: items, movements: logMovement({ kind: 'devolucao', from: origin.trim(), to: DEPOT_NAME[depot], item: item.name, code: item.code, qty, lot: lot.trim(), reason: reason.trim() }) }) as Partial<State>);
}
/** Saída via requisição: baixa itens para paciente (FIA/BAA) ou centro de custo, com nº de documento. */
export function requisitionOut(depot: Depot, dest: { encounterId?: string; costCenter?: string; urgent?: boolean; loss?: boolean; note?: string }, lines: { id: string; lot: string; qty: number }[]) {
  requireAction(depotAction(depot));
  if (!lines.length) throw new Error('Inclua ao menos um item.');
  const e = dest.encounterId ? state.encounters.find((x) => x.id === dest.encounterId) : undefined;
  const p = e ? state.patients.find((x) => x.id === e.patientId) : undefined;
  if (!p && !dest.costCenter?.trim()) throw new Error('Informe o paciente/atendimento ou o centro de custo.');
  let items = state[depotKey(depot)];
  for (const l of lines) { checkQty(l.qty); items = changeQty(items, l.id, -l.qty, l.lot); }
  const doc = `REQ ${String(state.movements.filter((m) => m.kind === 'requisicao').length + 1).padStart(6, '0')}/${new Date().getFullYear()}`;
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const logs: Movement[] = lines.map((l) => { const it = items.find((i) => i.id === l.id)!; return { id: crypto.randomUUID(), at, by, kind: 'requisicao', from: DEPOT_NAME[depot], to: p ? p.name : dest.costCenter!.trim(), item: it.name, code: it.code, qty: l.qty, lot: l.lot.trim(), doc, reason: [dest.loss ? 'Perda' : '', dest.note?.trim() ?? ''].filter(Boolean).join(' · '), ...(p ? { patient: p.name, patientId: p.id, baa: e!.number, ...(e!.fia ? { fia: e!.fia.number } : {}) } : {}), ...(dest.costCenter?.trim() ? { costCenter: dest.costCenter.trim() } : {}), ...(dest.urgent ? { urgent: true } : {}) }; });
  setState(() => ({ [depotKey(depot)]: items, movements: [...logs, ...state.movements] }) as Partial<State>);
  return doc;
}
/** Registro de quebra ou extravio na farmácia: baixa o saldo. */
export function registerBreakage(itemId: string, qty: number, lot: string, reason: string, depot: Depot = 'farmacia') {
  requireAction(depotAction(depot)); checkQty(qty);
  if (!lot.trim()) throw new Error('Informe o lote do produto quebrado ou extraviado.');
  if (!reason.trim()) throw new Error('Descreva como ocorreu a quebra ou extravio.');
  const items = changeQty(state[depotKey(depot)], itemId, -qty, lot);
  const item = items.find((i) => i.id === itemId)!;
  setState(() => ({ [depotKey(depot)]: items, movements: logMovement({ kind: 'quebra', from: DEPOT_NAME[depot], to: 'Perda', item: item.name, code: item.code, qty, lot: lot.trim(), reason: reason.trim() }) }));
}
export interface EntryLine { id: string; lot: string; expiry: string; qty: number }
function applyLines(items: StockMedication[], lines: EntryLine[], sign: 1 | -1, needExpiry: boolean) {
  if (!lines.length) throw new Error('Adicione ao menos um produto.');
  let next = items;
  for (const l of lines) {
    checkQty(l.qty);
    if (!l.lot.trim()) throw new Error('Informe o lote de cada produto.');
    if (needExpiry && sign > 0 && !l.expiry && !items.find((i) => i.id === l.id)?.lots?.some((x) => x.lot === l.lot.trim())) throw new Error(`Informe a validade do novo lote ${l.lot}.`);
    next = changeQty(next, l.id, sign * l.qty, l.lot, l.expiry);
  }
  return next;
}
/** Entrada por nota fiscal: soma em lote existente ou cria lote novo com validade. */
export function receiveStock(depot: Depot, nf: { number: string; supplier: string }, lines: EntryLine[]) {
  requireAction(depotAction(depot));
  if (!nf.number.trim() || !nf.supplier.trim()) throw new Error('Informe número da NF e fornecedor.');
  const items = applyLines(state[depotKey(depot)], lines, 1, true);
  let movements = state.movements;
  for (const l of lines) { const it = items.find((i) => i.id === l.id)!; movements = [{ id: crypto.randomUUID(), at: new Date().toISOString(), by: professionalName(state.profile), kind: 'entrada', from: nf.supplier.trim(), to: DEPOT_NAME[depot], item: it.name, code: it.code, qty: l.qty, lot: l.lot.trim(), expiry: l.expiry, doc: `NF ${nf.number.trim()}`, reason: '' }, ...movements]; }
  setState(() => ({ [depotKey(depot)]: items, movements }) as Partial<State>);
}
/** Empréstimo: saída baixa o estoque, entrada soma; ambos ficam pendentes até a devolução. */
export function registerLoan(depot: Depot, direction: 'saida' | 'entrada', partner: string, due: string, lines: EntryLine[]) {
  requireAction(depotAction(depot));
  if (!partner.trim()) throw new Error(direction === 'saida' ? 'Informe para quem foi emprestado.' : 'Informe quem emprestou.');
  const items = applyLines(state[depotKey(depot)], lines, direction === 'saida' ? -1 : 1, direction === 'entrada');
  const doc = `EMP ${String(state.movements.filter((m) => m.kind.startsWith('emprestimo')).length + 1).padStart(4, '0')}/${new Date().getFullYear()}`;
  let movements = state.movements;
  for (const l of lines) { const it = items.find((i) => i.id === l.id)!; movements = [{ id: crypto.randomUUID(), at: new Date().toISOString(), by: professionalName(state.profile), kind: direction === 'saida' ? 'emprestimo_saida' : 'emprestimo_entrada', from: direction === 'saida' ? DEPOT_NAME[depot] : partner.trim(), to: direction === 'saida' ? partner.trim() : DEPOT_NAME[depot], item: it.name, code: it.code, qty: l.qty, lot: l.lot.trim(), expiry: l.expiry, doc, due, reason: '' }, ...movements]; }
  setState(() => ({ [depotKey(depot)]: items, movements }) as Partial<State>);
}
/** Devolução parcial ou total: ajusta apenas a quantidade informada e mantém histórico por lote. */
export function settleLoan(depot: Depot, movementId: string, qty: number) {
  requireAction(depotAction(depot));
  const m = state.movements.find((x) => x.id === movementId);
  if (!m || !m.kind.startsWith('emprestimo') || m.settledAt) throw new Error('Empréstimo não encontrado ou já devolvido.');
  const out = m.kind === 'emprestimo_saida';
  if ((out ? m.from : m.to) !== DEPOT_NAME[depot]) throw new Error('Empréstimo não pertence a este estoque.');
  checkQty(qty);
  const returnedQty = loanReturnedQty(m) + qty;
  if (returnedQty > m.qty) throw new Error(`Quantidade maior que o saldo pendente (${m.qty - loanReturnedQty(m)}).`);
  const list = state[depotKey(depot)];
  const it = list.find((i) => (m.code && i.code === m.code) || i.name === m.item);
  if (!it) throw new Error('Produto não está mais no estoque.');
  const items = changeQty(list, it.id, out ? qty : -qty, m.lot, m.expiry ?? '');
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  setState(() => ({ [depotKey(depot)]: items, movements: state.movements.map((x) => x.id === movementId ? { ...x, returnedQty, returns: [...(x.returns ?? []), { qty, at, by }], ...(returnedQty === m.qty ? { settledAt: at, settledBy: by } : {}) } : x) }) as Partial<State>);
}
/** Pedido do posto de enfermagem para farmácia ou almoxarifado. */
/** Pedido de qualquer setor ao almoxarifado (colaborador aprovado). */
export function createSectorRequest(sector: string, items: string, note: string, target: Depot = 'almoxarifado') {
  if (!items.trim()) throw new Error('Adicione ao menos um produto.');
  if (!sector.trim()) throw new Error('Selecione o setor solicitante.');
  const r: SupplyRequest = { id: crypto.randomUUID(), target, items: items.trim(), sector, patient: '', note: note.trim(), status: 'Pendente', at: new Date().toISOString(), by: professionalName(state.profile) };
  setState((s) => ({ requests: [r, ...s.requests] }));
}
export function createSupplyRequest(input: { target: Depot; items: string; sector: string; patient: string; note: string }) {
  requireAction('checar');
  if (!input.items.trim()) throw new Error('Descreva os produtos e quantidades do pedido.');
  if (!input.sector.trim()) throw new Error('Informe o setor solicitante.');
  const r: SupplyRequest = { id: crypto.randomUUID(), target: input.target, items: input.items.trim(), sector: input.sector.trim(), patient: input.patient.trim(), note: input.note.trim(), status: 'Pendente', at: new Date().toISOString(), by: professionalName(state.profile) };
  setState((s) => ({ requests: [r, ...s.requests] }));
}
export function answerSupplyRequest(id: string, status: 'Atendido' | 'Recusado', answer = '') {
  const r = state.requests.find((x) => x.id === id);
  if (!r) throw new Error('Pedido não encontrado.');
  requireAction(depotAction(r.target));
  if (status === 'Recusado' && !answer.trim()) throw new Error('Informe o motivo da recusa.');
  setState((s) => ({ requests: s.requests.map((x) => x.id === id ? { ...x, status, answer: answer.trim(), handledBy: professionalName(state.profile), handledAt: new Date().toISOString() } : x) }));
}
export function createStockMedication(input: Omit<StockMedication, 'id'>) {
  requireAction('farmacia');
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome e a concentração do medicamento.');
  if (![input.quantity, input.minimum].every((n) => Number.isInteger(n) && n >= 0)) throw new Error('Estoque e mínimo devem ser números inteiros não negativos.');
  if (state.stock.some((item) => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) throw new Error('Este medicamento já está cadastrado.');
  const medication: StockMedication = { id: crypto.randomUUID(), name, presentation: input.presentation.trim(), unit: input.unit.trim() || 'un', quantity: input.quantity, minimum: input.minimum };
  setState((s) => ({ stock: [...s.stock, medication].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }));
}
/** Cadastra um novo produto (sem saldo) no depósito indicado, usado na entrada de NF. */
export function createDepotProduct(depot: Depot, input: { name: string; code?: string; unit?: string; presentation?: string; minimum?: number }): string {
  requireAction(depotAction(depot));
  const name = input.name.trim().toLocaleUpperCase('pt-BR');
  if (!name) throw new Error('Informe o nome do produto.');
  const list = state[depotKey(depot)];
  if (list.some((i) => i.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) throw new Error('Este produto já está cadastrado.');
  const code = input.code?.trim();
  if (code && list.some((i) => i.code === code)) throw new Error('Já existe produto com este código.');
  const minimum = input.minimum ?? 0;
  if (!Number.isInteger(minimum) || minimum < 0) throw new Error('Estoque mínimo inválido.');
  const item: StockMedication = { id: crypto.randomUUID(), name, presentation: input.presentation?.trim() ?? '', unit: input.unit?.trim() || 'UN', quantity: 0, minimum, ...(code ? { code } : {}), lots: [] };
  setState(() => ({ [depotKey(depot)]: [...list, item].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }) as Partial<State>);
  return item.id;
}
export function adjustStock(id: string, delta: number, lot = '') {
  requireAction('farmacia');
  if (!Number.isInteger(delta) || delta === 0) throw new Error('Informe uma entrada ou saída inteira diferente de zero.');
  const medication = state.stock.find((item) => item.id === id);
  if (!medication) throw new Error('Medicamento não encontrado.');
  if (medication.quantity + delta < 0) throw new Error('O ajuste não pode deixar o estoque negativo.');
  if (lot) { const next = changeQty(state.stock, id, delta, lot); setState(() => ({ stock: next })); return; }
  setState((s) => ({ stock: s.stock.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item) }));
}
export function adjustWarehouse(id: string, delta: number, lot = '') {
  requireAction('almoxarifado');
  if (!Number.isInteger(delta) || delta === 0) throw new Error('Informe uma entrada ou saída inteira diferente de zero.');
  const item = state.warehouse.find((x) => x.id === id);
  if (!item) throw new Error('Item não encontrado.');
  if (item.quantity + delta < 0) throw new Error('O ajuste não pode deixar o estoque negativo.');
  if (lot) { const next = changeQty(state.warehouse, id, delta, lot); setState(() => ({ warehouse: next })); return; }
  setState((s) => ({ warehouse: s.warehouse.map((x) => x.id === id ? { ...x, quantity: x.quantity + delta } : x) }));
}
export function saveInventoryCount(depot: Depot, itemId: string, countedQty: number, lotInfo?: { lot?: string; expiry?: string }) {
  requireAction(depot);
  if (!Number.isInteger(countedQty) || countedQty < 0) throw new Error('Informe uma contagem inteira maior ou igual a zero.');
  const items = depot === 'farmacia' ? state.stock : state.warehouse;
  const item = items.find((x) => x.id === itemId);
  if (!item) throw new Error('Item não encontrado no estoque.');
  const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const by = professionalName(state.profile);
  const cleanLot = lotInfo?.lot?.trim() || '';
  const cleanExpiry = lotInfo?.expiry?.trim() || '';
  setState((s) => {
    const list = Array.isArray(s.inventories) ? s.inventories : [];
    const existing = list.find((inv) => inv.depot === depot && inv.status === 'rascunho');
    const line = {
      itemId: item.id,
      ...(item.code ? { code: item.code } : {}),
      name: item.name,
      unit: item.unit,
      ...(item.category ? { category: item.category } : {}),
      ...(item.unitCost !== undefined ? { unitCost: item.unitCost } : {}),
      systemQty: item.quantity,
      countedQty,
      ...(cleanLot ? { lot: cleanLot } : {}),
      ...(cleanExpiry ? { expiry: cleanExpiry } : {}),
      countedBy: by,
      countedAt: now,
    };
    if (existing) {
      return { inventories: list.map((inv) => inv.id === existing.id ? { ...inv, updatedAt: now, updatedBy: by, lines: { ...inv.lines, [item.id]: line } } : inv) };
    }
    const created: InventorySession = { id: `inv-${crypto.randomUUID()}`, depot, status: 'rascunho', startedAt: now, startedBy: by, updatedAt: now, updatedBy: by, lines: { [item.id]: line } };
    return { inventories: [created, ...list] };
  });
}
export function clearInventoryCount(depot: Depot, itemId: string) {
  requireAction(depot);
  const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const by = professionalName(state.profile);
  setState((s) => ({
    inventories: (Array.isArray(s.inventories) ? s.inventories : []).map((inv) => {
      if (inv.depot !== depot || inv.status !== 'rascunho') return inv;
      const { [itemId]: _removed, ...rest } = inv.lines;
      return { ...inv, updatedAt: now, updatedBy: by, lines: rest };
    }),
  }));
}
export function approveInventoryCorrection(depot: Depot, justification: string) {
  if (!canApproveInventory(state.profile, depot, state.accessAreas)) throw new Error('Apenas o coordenador de inventário ou administrador pode efetivar correções de estoque.');
  const note = justification.trim();
  if (!note) throw new Error('Informe uma justificativa formal para efetivar a correção de inventário.');
  const list = Array.isArray(state.inventories) ? state.inventories : [];
  const draft = list.find((inv) => inv.depot === depot && inv.status === 'rascunho');
  if (!draft || Object.keys(draft.lines).length === 0) throw new Error('Nenhuma contagem registrada para homologação.');
  const items = depot === 'farmacia' ? state.stock : state.warehouse;
  const adjustments = buildInventoryAdjustments(items, draft.lines);
  if (adjustments.length === 0) throw new Error('Não há divergências para corrigir neste levantamento.');
  const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const approver = professionalName(state.profile);
  const depotName = depot === 'farmacia' ? 'Farmácia' : 'Almoxarifado';
  const byId = new Map(adjustments.map((a) => [a.itemId, a]));
  const updatedItems = items.map((item) => {
    const adj = byId.get(item.id);
    if (!adj) return item;
    if (!adj.lot) return { ...item, quantity: adj.countedQty };
    const currentLots = item.lots ? [...item.lots] : [];
    const idx = currentLots.findIndex((l) => l.lot === adj.lot);
    if (idx >= 0) {
      const targetLot = currentLots[idx]!;
      const nextLotQty = Math.max(0, targetLot.quantity + adj.delta);
      currentLots[idx] = { ...targetLot, quantity: nextLotQty, ...(adj.expiry ? { expiry: adj.expiry } : {}) };
    } else if (adj.delta > 0) {
      currentLots.push({ lot: adj.lot, expiry: adj.expiry || '', quantity: adj.delta });
    }
    return { ...item, quantity: adj.countedQty, lots: currentLots };
  });
  const newMovements: Movement[] = adjustments.map((adj) => ({
    id: `mv-${crypto.randomUUID()}`,
    kind: 'inventario',
    from: adj.delta < 0 ? depotName : 'Inventário',
    to: adj.delta > 0 ? depotName : 'Inventário',
    item: adj.name,
    ...(adj.code ? { code: adj.code } : {}),
    qty: Math.abs(adj.delta),
    lot: adj.lot || (adj.delta > 0 ? 'SOBRA' : 'FALTA'),
    ...(adj.expiry ? { expiry: adj.expiry } : {}),
    reason: `Inventário (${adj.delta > 0 ? '+' : ''}${adj.delta}) · Contado por ${adj.countedBy} · Homologado por ${approver}: ${note}`,
    at: now,
    by: approver,
  }));
  setState((s) => ({
    ...(depot === 'farmacia' ? { stock: updatedItems } : { warehouse: updatedItems }),
    movements: [...newMovements, ...s.movements],
    inventories: (Array.isArray(s.inventories) ? s.inventories : []).map((inv) => inv.id === draft.id ? { ...inv, status: 'homologado', updatedAt: now, updatedBy: approver, approvedAt: now, approvedBy: approver, justification: note, appliedAdjustments: adjustments.length } : inv),
  }));
  return adjustments.length;
}
/** Atalho usado pela integração da prescrição para acrescentar unidades a um item. */
export function addStock(item: string, qty: number) {
  const existing = findStockMedication(state.stock, item);
  if (existing) { adjustStock(existing.id, qty); return; }
  createStockMedication({ name: medicationKey(item), presentation: '', unit: 'un', quantity: qty, minimum: 0 });
}
const TERMINAL_ADMIN: Admin['status'][] = ['checado', 'cancelado', 'nao', 'adiado'];
export function allBatchDosesDone(e: Encounter, p: Patient, admins: Record<string, Admin>) {
  const items = p.prescriptions.filter((r) => r.batchId === e.prescriptionBatchId && r.times?.length && r.pharmacy !== 'Em falta');
  return items.every((r) => r.times?.every((t) => TERMINAL_ADMIN.includes(admins[`${p.id}|${r.id}|${t}`]?.status as Admin['status'])));
}
export function advanceCompletedMedication(id: string) {
  requireAction('checar'); const { e, p } = getEncounter(id);
  if (e.status_fluxo !== 'AGUARDANDO_MEDICACAO' || !allBatchDosesDone(e, p, state.admins)) return false;
  commitEncounter(transition(e, 'EM_OBSERVACAO_REAVALIACAO', professionalName(state.profile), 'Medicação já concluída - enviado para reavaliação'));
  return true;
}
export function recordMedication(id: string, rxId: string, time: string, status: Admin['status'], reason = '') {
  requireAction(status === 'cancelado' ? 'prescrever' : 'checar'); const { e, p } = getEncounter(id);
  const rx = p.prescriptions.find((r) => r.id === rxId);
  const doseReleased = rx?.pharmacy === 'Dispensada' || (rx?.pharmacy === 'Parcial' && Boolean(rx.dispensedTimes?.includes(time)));
  if (!rx || !rx.times?.includes(time) || (rx.pharmacy && !doseReleased) || !['AGUARDANDO_MEDICACAO', 'EM_OBSERVACAO_REAVALIACAO'].includes(e.status_fluxo)) {
    throw new Error(rx?.pharmacy === 'Parcial' ? 'Dose ainda retida na farmácia para o horário programado.' : 'Medicação ainda não liberada para administração.');
  }
  const key = `${p.id}|${rxId}|${time}`;
  if (state.admins[key]?.status === 'checado' || state.admins[key]?.status === 'cancelado') throw new Error('Dose já checada ou cancelada.');
  if (status !== 'checado' && !reason.trim()) throw new Error('Informe a justificativa.');
  const at = new Date().toISOString();
  const admins = { ...state.admins, [key]: { status, by: professionalName(state.profile), at, reason } };
  const allDone = allBatchDosesDone(e, p, admins);
  commitEncounter(allDone && e.status_fluxo === 'AGUARDANDO_MEDICACAO' ? transition(e, 'EM_OBSERVACAO_REAVALIACAO', professionalName(state.profile), 'Medicação concluída - pronto para reavaliação', at) : e, { admins });
}
export function requestAdmission(id: string, req: { ward: string; character: 'Urgência' | 'Eletiva'; cid: string; justification: string; isolation: boolean; oxygen: boolean; source?: 'medico' | 'recepcao' }) {
  const fromReception = req.source === 'recepcao' || (!canAct(state.profile, 'prescrever', state.accessAreas) && canAct(state.profile, 'recepcao', state.accessAreas));
  if (fromReception) requireAction('recepcao'); else requireAction('prescrever');
  const { e, p } = getEncounter(id);
  if (e.status_fluxo === 'ALTA_HOSPITALAR' || e.fia) throw new Error('Atendimento já encerrado ou com internação ativa.');
  if (!fromReception) {
    if (!['EM_ATENDIMENTO_MEDICO', 'EM_OBSERVACAO_REAVALIACAO'].includes(e.status_fluxo)) throw new Error('Solicitação disponível durante a avaliação médica.');
    requireMedicalSigtap(e.sigtapCode ?? '');
  }
  if (e.admission?.status === 'pendente') throw new Error('Já existe uma solicitação aguardando o NIR.');
  if (!req.justification.trim()) throw new Error('Informe a justificativa clínica.');
  if (req.ward) { const ageErr = bedAgeIssue({ birthDate: p.registration?.birthDate, age: p.age, type: p.type }, req.ward, req.ward); if (ageErr) throw new Error(ageErr); }
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const { source: _source, ...admReq } = req;
  const note = fromReception ? 'Encaminhamento de internação realizado pela recepção (aguardando leito no NIR)' : 'Internação solicitada ao NIR';
  commitEncounter({ ...e, admission: { ...admReq, cid: req.cid || e.medical?.cid || '', status: 'pendente', requestedAt: at, requestedBy: by }, history: [...e.history, { status: e.status_fluxo, at, by, note }] });
}
// Admission converts the BAA into a FIA keeping the exact same BAA number.
function openFia(e: Encounter, ward: string, bed: string, at: string, by: string): { e: Encounter; seq: number } {
  if (e.fia) return { e: { ...e, fia: { ...e.fia, ward, bed } }, seq: state.fiaSequence ?? 0 };
  const fromBaa = /^BAA-/i.test(e.number);
  const seq = fromBaa
    ? Number(e.number.split('-').pop() ?? 0) || (state.fiaSequence ?? 0)
    : takeSequence('fia', (state.fiaSequence ?? 0) + 1);
  const number = fromBaa
    ? e.number.replace(/^BAA-/i, 'FIA-')
    : `FIA-${new Date(at).getFullYear()}-${String(seq).padStart(6, '0')}`;
  const doctor = e.admission?.requestedBy ?? e.signedBy ?? by;
  const fia = { number, openedAt: at, ward, bed, doctor, authorizedBy: by, cid: e.admission?.cid || e.medical?.cid || '', justification: e.admission?.justification ?? '', character: e.admission?.character ?? 'Urgência' };
  return { e: { ...e, number, fia, baaClosedAt: at, history: [...e.history, { status: e.status_fluxo, at, by, note: `${e.number} convertida em ${number} (internação)` }] }, seq: Math.max(state.fiaSequence ?? 0, seq) };
}
export function authorizeAdmission(id: string, bedId: string) {
  requireAction('nir'); const { e, p } = getEncounter(id);
  if (e.admission?.status !== 'pendente') throw new Error('Solicitação não está pendente.');
  const bed = BASE_BEDS.find((b) => b.id === bedId && ['AC', 'UTIN', 'ENFP', 'UTIP', 'UCI'].includes(b.ward));
  if (!bed || bed.status !== 'livre' || state.patients.some((x) => x.bed === bed.id)) throw new Error('Selecione um leito livre.');
  const ageErr = bedAgeIssue({ birthDate: p.registration?.birthDate, age: p.age, type: p.type }, bed.id, bed.ward);
  if (ageErr) throw new Error(ageErr);
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const moved = transition(e, 'ENCAMINHADO_INTERNACAO', by, `NIR: leito ${bed.id}`, at);
  const f = openFia({ ...moved, admission: { ...e.admission, status: 'autorizada', bed: bed.id, decidedAt: at, decidedBy: by } }, bed.ward, bed.id, at, by);
  commitEncounter(f.e, { fiaSequence: f.seq, patients: state.patients.map((x) => x.id === p.id ? { ...x, ward: bed.ward, bed: bed.id } : x) });
}
// Bed already reserved atomically in Hotelaria; record it here without the local bed list.
export function authorizeAdmissionExternal(id: string, bedCode: string, sector: string) {
  requireAction('nir'); const { e, p } = getEncounter(id);
  if (e.admission?.status !== 'pendente') throw new Error('Solicitação não está pendente.');
  if (!bedCode.trim()) throw new Error('Selecione um leito.');
  const ageErr = bedAgeIssue({ birthDate: p.registration?.birthDate, age: p.age, type: p.type }, bedCode, sector);
  if (ageErr) throw new Error(ageErr);
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const moved = transition(e, 'ENCAMINHADO_INTERNACAO', by, `NIR: leito ${bedCode} (${sector}) reservado na Hotelaria`, at);
  const f = openFia({ ...moved, admission: { ...e.admission, status: 'autorizada', bed: bedCode, decidedAt: at, decidedBy: by } }, sector || e.admission.ward, bedCode, at, by);
  commitEncounter(f.e, { fiaSequence: f.seq, patients: state.patients.map((x) => x.id === p.id ? { ...x, ward: (e.admission!.ward || p.ward) as Patient["ward"], bed: bedCode } : x) });
}
/** Troca o leito de um paciente já internado no NIR, atualizando a FIA e o histórico. Retorna o leito anterior. */
export function transferBed(id: string, bedCode: string, sector: string, reason: string): string {
  requireAction('nir'); const { e, p } = getEncounter(id);
  if (!e.fia || e.status_fluxo !== 'ENCAMINHADO_INTERNACAO') throw new Error('Atendimento não está internado com FIA aberta.');
  const nextBed = bedCode.trim();
  if (!nextBed) throw new Error('Selecione o novo leito.');
  if (!reason.trim()) throw new Error('Informe o motivo da troca de leito.');
  const oldBed = p.bed || e.fia.bed;
  if (nextBed === oldBed) throw new Error('Selecione um leito diferente do atual.');
  if (state.patients.some((x) => x.id !== p.id && x.bed === nextBed)) throw new Error('O leito selecionado já está ocupado.');
  const ageErr = bedAgeIssue({ birthDate: p.registration?.birthDate, age: p.age, type: p.type }, nextBed, sector);
  if (ageErr) throw new Error(ageErr);
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const nextWard = sector.trim() || e.fia.ward;
  const localWard = BASE_BEDS.find((b) => b.id === nextBed)?.ward;
  const updated: Encounter = {
    ...e,
    fia: { ...e.fia, bed: nextBed, ward: nextWard },
    ...(e.admission ? { admission: { ...e.admission, bed: nextBed } } : {}),
    history: [...e.history, { status: e.status_fluxo, at, by, note: `NIR: troca de leito ${oldBed} → ${nextBed}${sector ? ` (${sector})` : ''}: ${reason.trim()}` }],
  };
  commitEncounter(updated, { patients: state.patients.map((x) => x.id === p.id ? { ...x, bed: nextBed, ...(localWard ? { ward: localWard } : {}) } : x) });
  return oldBed;
}
export function rejectAdmission(id: string, note: string) {
  requireAction('nir'); const { e } = getEncounter(id);
  if (e.admission?.status !== 'pendente') throw new Error('Solicitação não está pendente.');
  if (!note.trim()) throw new Error('Informe o motivo da devolução.');
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  commitEncounter({ ...e, admission: { ...e.admission, status: 'recusada', note, decidedAt: at, decidedBy: by }, history: [...e.history, { status: e.status_fluxo, at, by, note: `NIR devolveu: ${note}` }] });
}
export function finishEncounter(id: string, outcome: 'internacao' | 'co' | 'exames' | 'alta' | 'evasao' | 'transferencia', details: { bed?: string; summary: string; recipe: string; exam: string; destination?: string }) {
  requireAction('prescrever'); const { e, p } = getEncounter(id);
  if (!['EM_ATENDIMENTO_MEDICO', 'EM_OBSERVACAO_REAVALIACAO', 'ENCAMINHADO_INTERNACAO', 'ENCAMINHADO_CO'].includes(e.status_fluxo)) throw new Error('Desfecho disponível após avaliação médica.');
  requireMedicalSigtap(e.sigtapCode ?? '');
  const by = professionalName(state.profile); const at = new Date().toISOString();
  if (outcome === 'exames') { if (!details.exam.trim()) throw new Error('Informe o exame.'); commitEncounter({ ...(e.status_fluxo === 'EM_ATENDIMENTO_MEDICO' ? transition(e, 'EM_OBSERVACAO_REAVALIACAO', by, `Exames: ${details.exam}`, at) : e), examPending: details.exam }); return; }
  if (outcome === 'co') {
    if (p.type !== 'gestante') throw new Error('Centro Obstétrico disponível para gestantes.');
    commitEncounter(transition(e, 'ENCAMINHADO_CO', by, 'Urgência Obstétrica', at), { patients: state.patients.map((x) => x.id === p.id ? { ...x, ward: 'CO', bed: '' } : x), surgeries: [...state.surgeries, { id: crypto.randomUUID(), patientId: p.id, patient: p.name, room: 'Sala de Parto 1', start: new Date().getHours() + new Date().getMinutes() / 60, duration: 1, type: 'Parto Normal', tuss: '', surgeon: by, status: 'Em Preparo', checks: {}, gastos: [] }] }); return;
  }
  if (outcome === 'internacao') {
    const bed = BASE_BEDS.find((b) => b.id === details.bed && ['AC', 'UTIN', 'ENFP', 'UTIP', 'UCI'].includes(b.ward));
    if (!bed || bed.status !== 'livre' || state.patients.some((x) => x.bed === bed.id)) throw new Error('Selecione um leito livre.');
    const ageErr = bedAgeIssue({ birthDate: p.registration?.birthDate, age: p.age, type: p.type }, bed.id, bed.ward);
    if (ageErr) throw new Error(ageErr);
    const f = openFia(transition(e, 'ENCAMINHADO_INTERNACAO', by, `Leito ${bed.id}`, at), bed.ward, bed.id, at, by);
    commitEncounter(f.e, { fiaSequence: f.seq, patients: state.patients.map((x) => x.id === p.id ? { ...x, ward: bed.ward, bed: bed.id } : x) }); return;
  }
  const releasePatient: Partial<State> = { patients: state.patients.map((x) => x.id === p.id ? { ...x, bed: '', dischargeForecast: '' } : x), surgeries: state.surgeries.map((s) => s.patientId === p.id ? { ...s, status: 'Finalizado' as const } : s) };
  if (outcome === 'evasao') {
    const note = details.summary.trim();
    if (!note) throw new Error('Descreva o ocorrido na evasão.');
    const prevPs = (e as Encounter & { ps?: Record<string, unknown> }).ps;
    const nextPs = e.type === 'Pronto socorro' ? { ...(prevPs ?? {}), evasion: { at, by, note } } : prevPs;
    commitEncounter({ ...transition(e, 'ALTA_HOSPITALAR', by, `Alta por evasão: ${note}`, at), ...(nextPs ? { ps: nextPs } : {}), discharge: { kind: 'evasao', summary: note, recipe: '', by, at } } as Encounter, releasePatient);
    return;
  }
  if (outcome === 'transferencia') {
    const dest = (details.destination ?? '').trim();
    const note = details.summary.trim();
    if (!dest) throw new Error('Informe o serviço / hospital de destino.');
    if (!note) throw new Error('Informe o resumo clínico da transferência.');
    commitEncounter({ ...transition(e, 'ALTA_HOSPITALAR', by, `Alta para transferência (${dest}): ${note}`, at), discharge: { kind: 'transferencia', destination: dest, summary: note, recipe: details.recipe, by, at } }, releasePatient);
    return;
  }
  if (!details.summary.trim()) throw new Error('Informe o resumo de alta.');
  commitEncounter({ ...transition(e, 'ALTA_HOSPITALAR', by, e.fia ? `${e.fia.number} encerrada (alta)` : 'BAA encerrada', at), discharge: { kind: 'alta', summary: details.summary, recipe: details.recipe, by, at } }, releasePatient);
}

/** Salva uma receita simples no prontuário do paciente (disponível antes ou depois da alta). */
export function saveSimplePrescription(patientId: string, rx: Omit<SimplePrescription, 'id' | 'at'>): SimplePrescription {
  requireAction('prescrever');
  const items = rx.items.filter((i) => i.drug.trim()).map((i) => ({ drug: i.drug.trim(), qty: i.qty.trim(), dose: i.dose.trim() }));
  if (!items.length) throw new Error('Informe ao menos um medicamento na receita simples.');
  const record: SimplePrescription = {
    id: crypto.randomUUID(),
    items,
    ...(rx.notes?.trim() ? { notes: rx.notes.trim() } : {}),
    doctor: rx.doctor.trim() || professionalName(state.profile),
    council: rx.council.trim(),
    at: new Date().toISOString(),
    ...(rx.encounterNumber ? { encounterNumber: rx.encounterNumber } : {}),
  };
  setState((s) => ({
    patients: s.patients.map((x) => x.id === patientId ? { ...x, simplePrescriptions: [record, ...(x.simplePrescriptions ?? [])] } : x),
  }));
  return record;
}

/** Administrador desfaz uma alta lançada por engano, reabrindo o mesmo BAA/FIA. */
export function reopenEncounter(id: string, reason: string) {
  if (state.profile !== 'Administrador') throw new Error('Apenas administradores podem desfazer altas.');
  if (!reason.trim()) throw new Error('Informe a justificativa.');
  const { e } = getEncounter(id);
  if (e.status_fluxo !== 'ALTA_HOSPITALAR') throw new Error('Atendimento não está em alta.');
  const prev = [...e.history].reverse().find((h) => h.status !== 'ALTA_HOSPITALAR')?.status ?? 'EM_OBSERVACAO_REAVALIACAO';
  const at = new Date().toISOString();
  const { discharge: _d, ...rest } = e;
  commitEncounter({ ...rest, status_fluxo: prev, history: [...e.history, { status: prev, at, by: professionalName(state.profile), note: `Alta desfeita pelo administrador: ${reason.trim()}${prev === 'ENCAMINHADO_INTERNACAO' ? ' (redefinir leito)' : ''}` }] });
}
/** Reabre uma BAA já encerrada por alta quando o paciente precisa retornar (Recepção, Enfermagem, Médico ou Administrador). */
export function reopenBaaForReturn(
  id: string,
  reason: string,
  targetStatus: 'AGUARDANDO_TRIAGEM' | 'EM_OBSERVACAO_REAVALIACAO' = 'AGUARDANDO_TRIAGEM',
): Encounter {
  const canReopen = state.profile === 'Administrador'
    || canAct(state.profile, 'recepcao', state.accessAreas)
    || canAct(state.profile, 'triagem', state.accessAreas)
    || canAct(state.profile, 'prescrever', state.accessAreas);
  if (!canReopen) throw new Error('Sem permissão para reabrir BAA por retorno.');
  if (!reason.trim()) throw new Error('Informe o motivo do retorno do paciente.');
  const { e } = getEncounter(id);
  if (e.status_fluxo !== 'ALTA_HOSPITALAR') throw new Error('Apenas BAAs com alta podem ser reabertas por retorno.');
  if (e.fia) throw new Error('Atendimentos com internação (FIA) só podem ser reabertos pelo administrador.');
  const at = new Date().toISOString();
  const { discharge: _d, ...rest } = e;
  const updated: Encounter = {
    ...rest,
    status_fluxo: targetStatus,
    history: [
      ...e.history,
      { status: targetStatus, at, by: professionalName(state.profile), note: `BAA reaberta por retorno do paciente: ${reason.trim()}` },
    ],
  };
  commitEncounter(updated);
  return updated;
}
/** Administrador ou NIR desfaz uma internação: cancela a FIA, reabre a BAA e libera o leito. Retorna o leito liberado. */
export function revertAdmission(id: string, reason: string): string {
  if (state.profile !== 'Administrador' && !canAct(state.profile, 'nir', state.accessAreas)) throw new Error('Apenas administradores ou equipe do NIR podem cancelar internações.');
  if (!reason.trim()) throw new Error('Informe a justificativa.');
  const { e, p } = getEncounter(id);
  if (!e.fia || e.status_fluxo !== 'ENCAMINHADO_INTERNACAO') throw new Error('Atendimento não está internado com FIA aberta.');
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const { fia, baaClosedAt: _b, admission, ...rest } = e;
  const bed = p.bed;
  const actor = state.profile === 'Administrador' ? 'administrador' : 'NIR';
  const restoredNumber = /^FIA-/i.test(e.number) ? e.number.replace(/^FIA-/i, 'BAA-') : e.number;
  commitEncounter({ ...rest, number: restoredNumber, ...(admission ? { admission: { ...admission, status: 'recusada' as const, note: `Internação cancelada pelo ${actor}: ${reason.trim()}` } } : {}), status_fluxo: 'EM_OBSERVACAO_REAVALIACAO', history: [...e.history, { status: 'EM_OBSERVACAO_REAVALIACAO', at, by, note: `${fia.number} cancelada · ${restoredNumber} reaberta pelo ${actor}: ${reason.trim()}` }] }, { patients: state.patients.map((x) => x.id === p.id ? { ...x, bed: '' } : x) });
  return bed;
}
/** Registra o parto: cria prontuário "RN de <mãe>" vinculado e converte a mãe em puérpera. */
export function registerBirth(motherId: string, nb: Omit<Newborn, "motherId">, mode: "Parto Normal" | "Cesárea", sex: "F" | "M"): string {
  const m = state.patients.find((p) => p.id === motherId);
  if (!m) throw new Error("Mãe não encontrada");
  const id = `rn-${crypto.randomUUID()}`;
  const uti = nb.apgar5 < 7 || nb.pesoNascer < 2000;
  const rn: Patient = {
    id, prontuario: `${new Date().getFullYear()}-${String(4900 + state.patients.length)}`, name: `RN de ${m.name}`, cpf: "—", motherName: m.name, type: "neonato", age: "0 dia",
    ig: `${m.ig ?? ""} (ao nascer)`, weight: nb.pesoNascer / 1000, height: nb.comprimento, allergies: [], risks: [], ward: uti ? "UTIN" : "AC",
    bed: uti ? "UTIN-07" : `${m.bed}-RN`, insurance: m.insurance, ...(m.guia ? { guia: m.guia } : {}), authorized: m.authorized,
    diagnosis: `RN ${sex === "F" ? "feminino" : "masculino"} – ${mode}`, admission: new Date().toLocaleString("pt-BR"), days: 1,
    evolutions: [{ time: new Date().toLocaleString("pt-BR"), cat: "Médica", author: professionalName(state.profile), text: `Nascimento por ${mode.toLowerCase()}. Apgar ${nb.apgar1}/${nb.apgar5}, peso ${nb.pesoNascer} g.` }],
    vitals: [], prescriptions: [], newborn: { ...nb, motherId },
  };
  setState((s) => ({
    patients: [...s.patients.map((p) => p.id === motherId ? { ...p, type: "puerpera" as const, ward: "AC" as const, bed: m.bed.startsWith("CO") ? "AC-05" : p.bed, diagnosis: `Puerpério imediato – ${mode}`, babyIds: [...(p.babyIds ?? []), id], evolutions: [{ time: new Date().toLocaleString("pt-BR"), cat: "Médica" as const, author: professionalName(s.profile), text: `Parto ${mode.toLowerCase()} realizado. RN vinculado (${rn.prontuario}).` }, ...p.evolutions] } : p), rn],
  }));
  if (rn.bed.endsWith("-RN")) updatePatient(id, () => ({ bed: "AC-05B" }));
  return id;
}

export function announcePatient(patientId: string, room: string) {
  if (room !== 'Triagem' && room !== 'Enfermagem' && !state.rooms.includes(room)) throw new Error('Selecione o consultório.');
  const p = state.patients.find((x) => x.id === patientId); if (!p) throw new Error('Paciente não encontrado.');
  const e = encounterFor(patientId);
  const call = { id: crypto.randomUUID(), patientName: p.name, room, risk: e?.triage?.risk, sector: (e as { type?: string } | undefined)?.type, at: new Date().toISOString() };
  setState((s) => ({ calls: pushCall(s.calls, call) }));
  return call;
}
export function addRoom(name: string) { if (state.profile !== 'Administrador') throw new Error('Apenas administradores gerenciam consultórios.'); setState((s) => ({ rooms: addRoomName(s.rooms, name) })); }
export function removeRoom(name: string) { if (state.profile !== 'Administrador') throw new Error('Apenas administradores gerenciam consultórios.'); setState((s) => ({ rooms: removeRoomName(s.rooms, name) })); }

/** Salva o Laudo de AIH preenchido pelo médico no atendimento (fica no histórico). */
/** Medical selection permits an explicit blank so completion cannot silently restore the default. */
export function setMedicalSigtapCode(id: string, code: string) {
  requireAction('prescrever');
  const { e } = getEncounter(id);
  if (!['EM_ATENDIMENTO_MEDICO', 'EM_OBSERVACAO_REAVALIACAO', 'ENCAMINHADO_INTERNACAO', 'ENCAMINHADO_CO'].includes(e.status_fluxo)) throw new Error('Inicie ou retome o atendimento médico para alterar o SIGTAP.');
  if (code !== '') requireMedicalSigtap(code);
  setState((s) => ({ encounters: s.encounters.map((x) => x.id === id ? { ...x, sigtapCode: code } : x) }));
}
/** Registra no atendimento o código SIGTAP do procedimento realizado (usado no faturamento BPA). */
export function saveSigtapCode(id: string, code: string) {
  const c = code.replace(/\D/g, '');
  if (c.length !== 10) return;
  setState((s) => ({ encounters: s.encounters.map((e) => e.id === id ? { ...e, sigtapCode: c } : e) }));
}
/** Registra procedimentos adicionais (ex.: aferição de PA, temperatura) com seus códigos SIGTAP no atendimento. */
export function addEncounterProcedures(
  id: string,
  items: { name: string; code: string; sector?: string }[],
  clinicalNote?: { professional?: string; register?: string; sector?: string; indication?: string; description?: string; materials?: string; complications?: string; notes?: string },
) {
  const clean = items.map((x) => ({ name: x.name.trim(), code: x.code.trim(), sector: x.sector?.trim() })).filter((x) => x.name);
  if (!clean.length) return;
  const at = new Date().toISOString();
  const by = state.employeeName;
  setState((s) => {
    const target = s.encounters.find((e) => e.id === id);
    const encounters = s.encounters.map((e) => {
      if (e.id !== id) return e;
      const prev = e.extraProcedures ?? [];
      const next = [...prev];
      for (const item of clean) {
        const digitsCode = item.code.replace(/\D/g, '');
        const exists = next.some((p) => (digitsCode && p.code.replace(/\D/g, '') === digitsCode) || (!digitsCode && p.name.toLowerCase() === item.name.toLowerCase()));
        if (!exists) next.push({ id: `proc-${crypto.randomUUID()}`, name: item.name, code: digitsCode.length === 10 ? digitsCode : item.code, ...(item.sector ? { sector: item.sector } : {}), at, by });
      }
      return { ...e, extraProcedures: next };
    });
    if (!target || !clinicalNote) return { encounters };
    const lines = [
      `Procedimento(s): ${clean.map((x) => `${x.name}${x.code ? ` (${x.code})` : ''}`).join('; ')}`,
      clinicalNote.sector?.trim() ? `Setor: ${clinicalNote.sector.trim()}` : '',
      clinicalNote.indication?.trim() ? `Indicação: ${clinicalNote.indication.trim()}` : '',
      clinicalNote.description?.trim() ? `Descrição técnica: ${clinicalNote.description.trim()}` : '',
      clinicalNote.materials?.trim() ? `Materiais/med.: ${clinicalNote.materials.trim()}` : '',
      clinicalNote.complications?.trim() ? `Intercorrências: ${clinicalNote.complications.trim()}` : '',
      clinicalNote.notes?.trim() ? `Observações: ${clinicalNote.notes.trim()}` : '',
    ].filter(Boolean);
    const author = [clinicalNote.professional?.trim() || by, clinicalNote.register?.trim()].filter(Boolean).join(' · ');
    const evo = { time: new Date(at).toLocaleString('pt-BR'), cat: 'Procedimento' as const, author, text: lines.join('\n') };
    return {
      encounters,
      patients: s.patients.map((p) => (p.id === target.patientId ? { ...p, evolutions: [evo, ...p.evolutions] } : p)),
    };
  });
}

export function saveAihLaudo(id: string, data: Record<string, string>) {
  setState((s) => ({ encounters: s.encounters.map((e) => e.id === id ? { ...e, aihLaudo: { ...data, savedBy: s.employeeName, savedAt: new Date().toISOString() } } : e) }));
}

/** Faturamento registra nº/data da AIH autorizada, motivo de saída SUS e DNVs, sem apagar o laudo. */
export function saveAihAuthorization(id: string, data: Record<string, string>) {
  if (!canAct(state.profile, 'faturar', state.accessAreas)) throw new Error('Apenas Faturamento ou Administrador podem registrar a AIH.');
  setState((s) => ({ encounters: s.encounters.map((e) => e.id === id ? { ...e, aihLaudo: { ...(e.aihLaudo ?? {}), ...data, aihSavedBy: s.employeeName, aihSavedAt: new Date().toISOString() } } : e) }));
}

/** Administrador retifica números de documento após finalização, com justificativa no histórico. */
export function amendDocuments(id: string, values: Partial<Record<AmendField, string>>, reason: string) {
  if (!canAct(state.profile, 'faturar', state.accessAreas)) throw new Error('Apenas Faturamento ou Administrador podem retificar documentos.');
  if (!reason.trim()) throw new Error('Informe a justificativa.');
  const { e, p } = getEncounter(id);
  const changed = (Object.keys(values) as AmendField[]).filter((f) => (values[f] ?? '').trim() !== readField(p, e, f));
  if (!changed.length) throw new Error('Nenhum campo foi alterado.');
  for (const f of changed) { const err = amendIssue(f, values[f] ?? ''); if (err) throw new Error(err); }
  const v = (f: AmendField) => (values[f] ?? '').trim();
  const regKeys = changed.filter((f) => ['cns', 'cpf', 'identityDocument', 'birthCertificate', 'birthplaceCode'].includes(f));
  if (regKeys.length || changed.includes('cityCode') || changed.includes('cpf')) {
    updatePatient(p.id, (pp) => {
      const r = pp.registration;
      const patch: Partial<Patient> = {};
      if (changed.includes('cpf')) patch.cpf = v('cpf');
      if (r) {
        const nr = { ...r } as typeof r;
        for (const f of regKeys) (nr as Record<string, unknown>)[f] = v(f);
        if (changed.includes('cityCode')) { const i = Math.max(0, nr.addresses.findIndex((a) => a.primary)); nr.addresses = nr.addresses.length ? nr.addresses.map((a, k) => k === i ? { ...a, cityCode: v('cityCode') } : a) : nr.addresses; }
        patch.registration = nr;
      }
      return patch;
    });
  }
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const labels = changed.map((f) => AMEND_FIELDS.find((x) => x.id === f)!.label).join(', ');
  const cur = state.encounters.find((x) => x.id === id)!;
  const next: Encounter = { ...cur,
    ...(changed.includes('cid') ? { medical: { anamnesis: '', exam: '', diagnosis: '', ...cur.medical, cid: v('cid') } } : {}),
    ...(changed.includes('sigtapCode') ? { sigtapCode: v('sigtapCode').replace(/\D/g, '') } : {}),
    ...(changed.includes('aihNumber') || (changed.includes('sigtapCode') && cur.aihLaudo) ? { aihLaudo: { ...cur.aihLaudo, ...(changed.includes('aihNumber') ? { aihNumber: v('aihNumber') } : {}), ...(changed.includes('sigtapCode') && cur.aihLaudo ? { codigo: v('sigtapCode').replace(/\D/g, '') } : {}) } } : {}),
    history: [...cur.history, { status: cur.status_fluxo, at, by, note: `Documento retificado pelo administrador (${labels}): ${reason.trim()}` }] };
  setState((s) => ({ encounters: s.encounters.map((x) => x.id === id ? next : x) }));
}

/** Administrador corrige dados de abertura do BAA (unidade, especialidade, queixa, pré-consulta) com justificativa no histórico. */
export function correctEncounter(id: string, patch: { type: string; specialty: string; complaint: string; nursingPreConsult: boolean }, reason: string) {
  if (state.profile !== 'Administrador') throw new Error('Apenas administradores podem corrigir atendimentos.');
  if (!reason.trim()) throw new Error('Informe a justificativa.');
  if (!patch.specialty.trim() || !patch.complaint.trim()) throw new Error('Especialidade e queixa são obrigatórias.');
  const { e } = getEncounter(id);
  const at = new Date().toISOString();
  const { nursingPreConsult: _n, ...base } = e;
  const next: Encounter = { ...base, type: patch.type, specialty: patch.specialty.trim(), complaint: patch.complaint.trim(), ...(patch.type === 'Ambulatório' && patch.nursingPreConsult ? { nursingPreConsult: true } : {}),
    history: [...e.history, { status: e.status_fluxo, at, by: professionalName(state.profile), note: `Atendimento corrigido pelo administrador: ${reason.trim()}` }] };
  setState((s) => ({ encounters: s.encounters.map((x) => x.id === id ? next : x) }));
}

export function deleteEncounter(id: string) {
  if (state.profile !== 'Administrador') throw new Error('Apenas administradores podem apagar atendimentos.');
  setState((s) => ({ encounters: s.encounters.filter((e) => e.id !== id), queue: s.queue.filter((q) => q.id !== id), calls: s.calls }));
}

const adminOnly = () => { if (state.profile !== 'Administrador') throw new Error('Apenas administradores configuram o CID.'); };
export function addCidGroup(label: string, ranges: string[]) { adminOnly(); setState((s) => ({ cidGroups: addGroup(s.cidGroups, label, ranges) })); }
export function removeCidGroup(id: string) { adminOnly(); setState((s) => ({ cidGroups: s.cidGroups.filter((g) => g.id !== id), cidAreas: s.cidAreas.map((a) => ({ ...a, groups: a.groups.filter((x) => x !== id) })) })); }
export function addCidArea(name: string) { adminOnly(); setState((s) => ({ cidAreas: addArea(s.cidAreas, name) })); }
export function removeCidArea(name: string) { adminOnly(); setState((s) => ({ cidAreas: s.cidAreas.filter((a) => a.name !== name) })); }
export function updateCidArea(name: string, patch: Partial<Omit<CidArea, 'name'>>) { adminOnly(); setState((s) => ({ cidAreas: s.cidAreas.map((a) => a.name === name ? { ...a, ...patch } : a) })); }

export function deleteStockItem(kind: 'stock' | 'warehouse', id: string) {
  if (state.profile !== 'Administrador') throw new Error('Apenas administradores podem apagar itens.');
  setState((s) => ({ [kind]: s[kind].filter((i) => i.id !== id), removedStock: [...new Set([...s.removedStock, id])] }) as never);
}

/** Vincula um código de barras já impresso (ou gerado) a um produto/lote da farmácia ou do almoxarifado. */
export function linkBarcode(kind: 'stock' | 'warehouse', id: string, code: string, lot?: string) {
  requireAction(kind === 'stock' ? 'farmacia' : 'almoxarifado');
  setState((s) => ({ [kind]: linkCode(s[kind], id, code, lot) }) as never);
}

// ---------- Ambulatório ----------
export function createAmbSpecialty(name: string, group: SpecialtyGroup) { requireAction('recepcao'); setState((s) => ({ ambSpecialties: addSpecialty(s.ambSpecialties, name, group) })); }
export function toggleAmbSpecialty(id: string) { requireAction('recepcao'); setState((s) => ({ ambSpecialties: s.ambSpecialties.map((x) => x.id === id ? { ...x, active: !x.active } : x) })); }
export function scheduleAppointment(input: Omit<Appointment, 'id' | 'status' | 'createdBy'>) {
  requireAction('recepcao');
  if (!input.patientId) throw new Error('Selecione o paciente (cadastre na recepção se for novo).');
  if (!input.date || !input.time) throw new Error('Informe data e horário.');
  if (!state.ambSpecialties.some((x) => x.id === input.specialtyId)) throw new Error('Selecione a especialidade.');
  if (state.appointments.some((a) => a.status === 'agendado' && a.date === input.date && a.time === input.time && a.specialtyId === input.specialtyId && a.professional.trim().toLowerCase() === input.professional.trim().toLowerCase())) throw new Error('Horário já ocupado para este profissional.');
  setState((s) => ({ appointments: [...s.appointments, { ...input, id: crypto.randomUUID(), status: 'agendado', createdBy: professionalName(s.profile) }] }));
}
export interface QuickPatientInput {
  name: string;
  birthDate?: string;
  ageText?: string;
  motherOrGuardian?: string;
  phone?: string;
  cpf?: string;
  cns?: string;
}
export function quickScheduleAppointment(
  patientInput: QuickPatientInput,
  appointmentInput: Omit<Appointment, 'id' | 'status' | 'createdBy' | 'patientId'>,
) {
  requireAction('recepcao');
  const name = patientInput.name.trim();
  if (!name) throw new Error('Informe o nome completo do paciente.');
  if (!appointmentInput.date || !appointmentInput.time) throw new Error('Informe data e horário.');
  const spec = state.ambSpecialties.find((x) => x.id === appointmentInput.specialtyId);
  if (!spec) throw new Error('Selecione a especialidade.');
  if (state.appointments.some((a) => a.status === 'agendado' && a.date === appointmentInput.date && a.time === appointmentInput.time && a.specialtyId === appointmentInput.specialtyId && a.professional.trim().toLowerCase() === appointmentInput.professional.trim().toLowerCase())) {
    throw new Error('Horário já ocupado para este profissional.');
  }
  const cleanCpf = (patientInput.cpf ?? '').replace(/\D/g, '');
  const cleanCns = (patientInput.cns ?? '').replace(/\D/g, '');
  const cleanPhone = (patientInput.phone ?? '').replace(/\D/g, '');
  const motherOrGuardian = (patientInput.motherOrGuardian ?? '').trim();
  const birthDate = (patientInput.birthDate ?? '').trim();
  const existing = state.patients.find((p) =>
    (cleanCpf && p.cpf.replace(/\D/g, '') === cleanCpf) ||
    (cleanCns && (p.registration?.cns ?? '').replace(/\D/g, '') === cleanCns)
  );
  let resolvedPatient: Patient;
  let reused = false;
  if (existing) {
    resolvedPatient = existing;
    reused = true;
  } else {
    const years = birthDate ? ageYears(birthDate) : null;
    const ageLabel = years !== null ? `${years} ${years === 1 ? 'ano' : 'anos'}` : ((patientInput.ageText ?? '').trim() || '—');
    const areaCode = cleanPhone.length >= 10 ? cleanPhone.slice(0, 2) : '';
    const phoneNumber = cleanPhone.length >= 10 ? cleanPhone.slice(2) : cleanPhone;
    const baseReg = emptyRegistration();
    const registration: PatientRegistration = {
      ...baseReg,
      civilName: name.toUpperCase(),
      birthDate,
      cpf: cleanCpf,
      cns: cleanCns,
      parent1: motherOrGuardian,
      guardian: motherOrGuardian,
      phones: [{ primary: true, type: 'Celular', areaCode, number: phoneNumber, complement: '' }],
      createdBy: professionalName(state.profile),
      createdAt: new Date().toISOString(),
    };
    resolvedPatient = {
      id: `pat-amb-${crypto.randomUUID().slice(0, 8)}`,
      prontuario: `AMB-${String(state.patients.length + 1).padStart(5, '0')}`,
      name: name.toUpperCase(),
      cpf: cleanCpf,
      ...(motherOrGuardian ? { motherName: motherOrGuardian, guardian: motherOrGuardian } : {}),
      type: isObstetricSpecialty(spec.name) ? 'gestante' : 'pediatria',
      age: ageLabel,
      weight: 0,
      allergies: [],
      risks: [],
      ward: 'ENFP',
      bed: '',
      insurance: 'SUS',
      authorized: false,
      diagnosis: '',
      admission: appointmentInput.date,
      days: 0,
      evolutions: [],
      vitals: [],
      prescriptions: [],
      registration,
    };
  }
  const appointment: Appointment = {
    ...appointmentInput,
    patientId: resolvedPatient.id,
    id: crypto.randomUUID(),
    status: 'agendado',
    createdBy: professionalName(state.profile),
  };
  setState((s) => ({
    patients: reused ? s.patients : [...s.patients, resolvedPatient],
    appointments: [...s.appointments, appointment],
  }));
  return { patient: resolvedPatient, appointment, reused };
}
export function importAppointments(items: AgendaImportItem[]) {
  requireAction('recepcao');
  if (!items.length) throw new Error('Nenhum agendamento válido para importar.');
  let patients = [...state.patients];
  let ambSpecialties = [...state.ambSpecialties];
  const appointments = [...state.appointments];
  const by = professionalName(state.profile);
  let imported = 0; let skippedDuplicates = 0; let createdPatients = 0; let createdSpecialties = 0;

  for (const item of items) {
    if (!item.date || !item.time || !item.patientName.trim() || !item.specialty.trim()) continue;
    let spec = ambSpecialties.find((s) => normText(s.name) === normText(item.specialty));
    if (!spec) {
      ambSpecialties = addSpecialty(ambSpecialties, item.specialty.trim(), 'medica');
      spec = ambSpecialties[ambSpecialties.length - 1]!;
      createdSpecialties++;
    }
    const cleanCpf = item.cpf.replace(/\D/g, '');
    const cleanCns = item.cns.replace(/\D/g, '');
    const nameKey = normText(item.patientName);
    let pat: Patient | undefined = patients.find((p) =>
      (cleanCpf && p.cpf.replace(/\D/g, '') === cleanCpf) ||
      (cleanCns && (p.registration?.cns ?? '').replace(/\D/g, '') === cleanCns) ||
      (item.prontuario && p.prontuario === item.prontuario) ||
      normText(p.name) === nameKey
    );
    const resolvedPat: Patient = pat ?? (() => {
      const id = `pat-amb-${crypto.randomUUID().slice(0, 8)}`;
      const created: Patient = {
        id,
        prontuario: item.prontuario || `AMB-${String(patients.length + 1).padStart(5, '0')}`,
        name: item.patientName.trim().toUpperCase(),
        cpf: cleanCpf,
        type: 'pediatria',
        age: '—',
        weight: 0,
        allergies: [],
        risks: [],
        ward: 'ENFP',
        bed: '',
        insurance: 'SUS',
        authorized: false,
        diagnosis: '',
        admission: item.date,
        days: 0,
        evolutions: [],
        vitals: [],
        prescriptions: [],
        ...(cleanCns ? { registration: { cns: cleanCns } as NonNullable<Patient['registration']> } : {}),
      };
      patients.push(created);
      createdPatients++;
      return created;
    })();
    const dup = appointments.some((a) =>
      a.status !== 'cancelado' && a.date === item.date && a.time === item.time && a.patientId === resolvedPat.id && a.specialtyId === spec!.id
    );
    if (dup) { skippedDuplicates++; continue; }
    appointments.push({
      id: crypto.randomUUID(),
      date: item.date,
      time: item.time,
      specialtyId: spec.id,
      professional: item.professional.trim(),
      patientId: resolvedPat.id,
      note: item.note.trim(),
      nursingPreConsult: isObstetricSpecialty(spec.name),
      status: 'agendado',
      createdBy: by,
    });
    imported++;
  }
  setState(() => ({ patients, ambSpecialties, appointments }));
  return { imported, skippedDuplicates, createdPatients, createdSpecialties };
}
export function setAppointmentStatus(id: string, status: 'faltou' | 'cancelado') { requireAction('recepcao'); setState((s) => ({ appointments: s.appointments.map((a) => a.id === id && a.status === 'agendado' ? { ...a, status } : a) })); }
export function checkInAppointment(id: string) {
  requireAction('recepcao');
  const a = state.appointments.find((x) => x.id === id); if (!a || a.status !== 'agendado') throw new Error('Agendamento não disponível.');
  const p = state.patients.find((x) => x.id === a.patientId); if (!p) throw new Error('Paciente não encontrado.');
  const sp = state.ambSpecialties.find((x) => x.id === a.specialtyId);
  const e = openEncounter(p, 'Ambulatório', sp?.name ?? '', `Consulta agendada · ${sp?.name ?? ''}${a.note ? ` · ${a.note}` : ''}`, !!a.nursingPreConsult);
  setState((s) => ({ appointments: s.appointments.map((x) => x.id === id ? { ...x, status: 'chegou', encounterId: e.id } : x) }));
  return e;
}
export function saveSadtReport(id: string, r: Omit<SadtReport, 'at'>) {
  if (!canAct(state.profile, 'prescrever', state.accessAreas) && !(state.accessAreas ?? []).includes('ambulatorio:sadt') && !canAct(state.profile, 'recepcao', state.accessAreas)) {
    throw new Error('Seu perfil não permite liberar laudos SADT.');
  }
  const { e } = getEncounter(id);
  if (!r.findings.trim() || !r.conclusion.trim()) throw new Error('Preencha achados e conclusão do laudo.');
  if (!r.professional.trim()) throw new Error('Informe o médico laudista responsável.');
  const by = professionalName(state.profile); const at = new Date().toISOString();
  let next = e.status_fluxo === 'AGUARDANDO_MEDICO' ? transition(e, 'EM_ATENDIMENTO_MEDICO', by, 'Exame SADT iniciado', at) : e;
  next = transition(next, 'ALTA_HOSPITALAR', by, `Laudo SADT liberado (${r.professional}): ${r.exam}`, at);
  commitEncounter({ ...next, sadtReport: { ...r, at, releasedBy: by, releasedAt: at } });
}
export function rectifySadtReport(id: string, r: Omit<SadtReport, 'at' | 'rectifications'>, reason: string) {
  if (!canAct(state.profile, 'prescrever', state.accessAreas) && !(state.accessAreas ?? []).includes('ambulatorio:sadt')) {
    throw new Error('Seu perfil não permite retificar laudos SADT.');
  }
  const { e } = getEncounter(id);
  if (!e.sadtReport) throw new Error('Este exame ainda não possui laudo liberado.');
  if (!reason.trim()) throw new Error('Informe a justificativa da retificação do laudo.');
  if (!r.findings.trim() || !r.conclusion.trim()) throw new Error('Preencha achados e conclusão do laudo.');
  const by = professionalName(state.profile); const at = new Date().toISOString();
  const rectifications = [
    ...(e.sadtReport.rectifications ?? []),
    { at, by, reason: reason.trim(), previousConclusion: e.sadtReport.conclusion },
  ];
  const next: Encounter = {
    ...e,
    sadtReport: { ...e.sadtReport, ...r, at: e.sadtReport.at, releasedBy: by, releasedAt: at, rectifications },
    history: [...e.history, { status: e.status_fluxo, at, by, note: `Laudo SADT retificado: ${reason.trim()}` }],
  };
  commitEncounter(next);
  return next;
}

// ---- CME ----
function requireCme() { if (!can(state.profile, 'cirurgia') && !(state.accessAreas ?? []).includes('cme')) throw new Error('Sem permissão para o CME.'); }
const cmeBy = () => professionalName(state.profile);
export function createCmeKit(code: string, name: string, items: string, validityDays: number) {
  requireCme(); const c = code.trim().toUpperCase(); if (!c || !name.trim()) throw new Error('Informe código e nome.');
  if (state.cmeKits.some((k) => k.code === c)) throw new Error('Código já cadastrado.');
  setState((s) => ({ cmeKits: [...s.cmeKits, { id: c, code: c, name: name.trim(), items, validityDays: validityDays || 30, status: 'Sujo', location: 'Expurgo CME', history: [] }] }));
}
export function moveCmeKit(id: string, status: KitStatus, location: string) {
  requireCme(); const at = new Date().toISOString();
  setState((s) => ({ cmeKits: s.cmeKits.map((k) => k.id === id ? { ...k, status, location, ...(status === 'Sujo' ? { cycleId: undefined, sterilizedAt: undefined, expiresAt: undefined, patientId: undefined } : {}), history: [...k.history, { at, by: cmeBy(), note: `${status} · ${location}` }] } : k) }));
}
export function runCmeCycle(input: Parameters<typeof startCycle>[2]) {
  requireCme(); const r = startCycle(state.cmeKits, state.cmeCycles, input, cmeBy(), new Date().toISOString());
  setState((s) => ({ cmeKits: r.kits, cmeCycles: [...s.cmeCycles, r.cycle] })); return r.cycle;
}
export function setCmeBio(cycleId: string, bio: BioResult) {
  requireCme(); const c = state.cmeCycles.find((x) => x.id === cycleId); if (!c) throw new Error('Ciclo não encontrado.');
  setState((s) => ({ cmeCycles: s.cmeCycles.map((x) => x.id === cycleId ? { ...x, bio } : x), cmeKits: setBio(s.cmeKits, c, bio, cmeBy(), new Date().toISOString()) }));
}
/** Bipa a caixa no procedimento: valida validade/ciclo e grava no paciente. */
export function registerCmeKitUse(code: string, surgeryId: string) {
  const kit = findKit(state.cmeKits, state.cmeCycles, code); const cycle = state.cmeCycles.find((c) => c.id === kit?.cycleId);
  const err = checkKitUse(kit, cycle, new Date().toISOString()); if (err) throw new Error(err);
  const surg = state.surgeries.find((s) => s.id === surgeryId); if (!surg) throw new Error('Procedimento não encontrado.');
  const at = new Date().toISOString(); const use = { kitId: kit!.id, name: kit!.name, cycle: cycle!.number, autoclave: cycle!.autoclave, at, by: cmeBy() };
  setState((s) => ({ surgeries: s.surgeries.map((x) => x.id === surgeryId ? { ...x, kits: [...(x.kits ?? []), use] } : x), cmeKits: s.cmeKits.map((k) => k.id === kit!.id ? { ...k, status: 'Em uso', location: surg.room, patientId: surg.patientId, history: [...k.history, { at, by: cmeBy(), note: `Uso: ${surg.patient} · ${surg.type}` }] } : k) }));
  return kit!;
}

/** Estorno/baixa por validade: retira do saldo o lote vencido e registra o termo de inutilização. */
export function writeOffExpired(itemId: string, lot: string, qty: number, reason: string, depot: Depot = 'farmacia') {
  requireAction(depotAction(depot)); checkQty(qty);
  const item = state[depotKey(depot)].find((i) => i.id === itemId);
  if (!item) throw new Error('Medicamento não encontrado.');
  const l = item.lots?.find((x) => x.lot === lot.trim());
  if (!l) throw new Error('Selecione o lote.');
  if (reason === 'Vencimento do prazo de validade' && expiryStatus(l.expiry, new Date()) !== 'vencido') throw new Error(`O lote ${l.lot} ainda está dentro da validade.`);
  if (!reason.trim()) throw new Error('Informe o motivo do estorno.');
  const items = changeQty(state[depotKey(depot)], itemId, -qty, lot);
  setState(() => ({ [depotKey(depot)]: items, movements: logMovement({ kind: 'vencimento', from: DEPOT_NAME[depot], to: 'Inutilização', item: item.name, code: item.code, qty, lot: l.lot, expiry: l.expiry, reason: reason.trim() }) }));
}

/** Saves a doctor's name + CRM so it autofills next time (shared clinical snapshot). */
export function rememberDoctor(name: string, crm: string) { const next = learnDoctor(state.doctors, name, crm); if (next !== state.doctors) setState(() => ({ doctors: next })); }
export function importDoctors(doctors: Doctor[]) {
  if (!canAccessPage(state.profile, '/colaboradores', state.accessAreas)) throw new Error('Área exclusiva para administradores.');
  const next = mergeImportedDoctors(state.doctors, doctors);
  setState(() => ({ doctors: next }));
  return doctors.length;
}
/** Admin correction of one doctor; the edited entry overrides the catalog and is kept in the shared snapshot. */
export function updateDoctor(original: Doctor, next: Doctor) {
  if (!canAccessPage(state.profile, '/colaboradores', state.accessAreas)) throw new Error('Área exclusiva para administradores.');
  if (!next.name.trim()) throw new Error('Informe o nome do médico.');
  const cns = (next.cns ?? '').replace(/\D/g, '');
  if (cns && !validDoctorCns(cns)) throw new Error('CNS inválido: confira os 15 dígitos.');
  const clean: Doctor = { ...original, ...next, name: next.name.trim().toUpperCase(), cns, cnsStatus: cns ? 'Corrigido pelo administrador' : 'CNS ausente' };
  const rest = state.doctors.filter((d) => doctorKey(d) !== doctorKey(original) && d.name !== original.name);
  if (cns && mergeDoctors(rest).some((d) => d.cns === cns && doctorKey(d) !== doctorKey(clean))) throw new Error('Este CNS já pertence a outro médico.');
  setState(() => ({ doctors: [...rest, clean] }));
}

// ---- SCIRAS / CCIH ----
function updateSciras(patientId: string, fn: (r: ScirasRecord) => ScirasRecord) {
  requireAction('sciras');
  updatePatient(patientId, (x) => ({ sciras: fn(x.sciras ?? emptySciras()) }));
}
export function decideAntimicrobial(patientId: string, rxId: string, approve: boolean, days: number, note: string) {
  requireAction('sciras');
  if (!note.trim()) throw new Error('Registre o parecer da SCIRAS.');
  if (approve && !(days > 0)) throw new Error('Informe os dias autorizados.');
  const at = new Date().toLocaleString('pt-BR'); const by = professionalName(state.profile);
  updatePatient(patientId, (x) => ({ prescriptions: x.prescriptions.map((r) => r.id === rxId && r.atb ? { ...r, atb: { ...r.atb, status: approve ? 'Autorizado' : 'Negado', decidedAt: at, decidedBy: by, decisionNote: note.trim(), ...(approve ? { authorizedDays: days } : {}) } } : r) }));
}
export function addIsolate(patientId: string, i: Omit<Isolate, 'id' | 'at' | 'by'>) {
  if (!i.organism.trim() || !i.material.trim()) throw new Error('Informe microrganismo e material.');
  const iso: Isolate = { ...i, id: crypto.randomUUID(), at: new Date().toLocaleString('pt-BR'), by: professionalName(state.profile) };
  updateSciras(patientId, (r) => ({ ...r, isolates: [iso, ...r.isolates] }));
}
export function openInfectionCase(patientId: string, site: string, notes: string) {
  if (!site.trim()) throw new Error('Informe o sítio da infecção.');
  updateSciras(patientId, (r) => ({ ...r, cases: [{ id: crypto.randomUUID(), site: site.trim(), notes: notes.trim(), openedAt: new Date().toLocaleString('pt-BR'), openedBy: professionalName(state.profile), status: 'Aberto' }, ...r.cases] }));
}
export function closeInfectionCase(patientId: string, caseId: string, classification: string) {
  if (!classification) throw new Error('Classifique o caso antes de encerrar.');
  updateSciras(patientId, (r) => ({ ...r, cases: r.cases.map((c) => c.id === caseId ? { ...c, status: 'Encerrado', classification, closedAt: new Date().toLocaleString('pt-BR'), closedBy: professionalName(state.profile) } : c) }));
}
export function saveBundle(patientId: string, type: BundleType, items: Record<string, boolean>) {
  const full = Object.fromEntries(BUNDLES[type].map((k) => [k, !!items[k]]));
  updateSciras(patientId, (r) => ({ ...r, bundles: [{ id: crypto.randomUUID(), type, at: new Date().toLocaleString('pt-BR'), by: professionalName(state.profile), items: full }, ...r.bundles] }));
}
export function addScirasEvolution(patientId: string, text: string) {
  requireAction('sciras');
  if (!text.trim()) throw new Error('Escreva a evolução.');
  updatePatient(patientId, (x) => ({ evolutions: [{ time: new Date().toLocaleString('pt-BR'), cat: 'SCIRAS' as const, author: professionalName(state.profile), text: text.trim() }, ...x.evolutions] }));
}

// Pedidos de exames: qualquer médico solicita; o SADT (prescrever ou área ambulatorio:sadt) agenda, confirma e lauda.
export function requestExam(encounterId: string, r: Omit<import('./exam-requests').ExamRequest, 'id' | 'orderNumber' | 'requestedAt' | 'requestedBy' | 'status'>) {
  requireAction('prescrever');
  const { e } = getEncounter(encounterId);
  const issues = examRequestIssuesFn(r); if (issues.length) throw new Error(issues.join(' '));
  const existingOrders = state.encounters.flatMap((x) => (x.examRequests ?? []).map((q) => q.orderNumber));
  const orderNumber = nextExamOrderNumber(existingOrders);
  const req = {
    ...r,
    id: crypto.randomUUID(),
    orderNumber,
    provider: r.provider ?? defaultProviderForKind(r.kind),
    requestedAt: new Date().toISOString(),
    requestedBy: professionalName(state.profile),
    status: 'Solicitado' as const,
    auditStatus: 'Pendente' as const,
  };
  commitEncounter({ ...e, examRequests: [...(e.examRequests ?? []), req] });
  return req;
}
export function updateExamStatus(encounterId: string, reqId: string, to: import('./exam-requests').ExamStatus, extra: Partial<import('./exam-requests').ExamRequest> = {}) {
  if (!canAct(state.profile, 'prescrever', state.accessAreas) && !(state.accessAreas ?? []).includes('ambulatorio:sadt')) throw new Error('Seu perfil não permite esta ação.');
  const { e } = getEncounter(encounterId);
  const list = e.examRequests ?? []; const r = list.find((x) => x.id === reqId); if (!r) throw new Error('Pedido não encontrado.');
  const next = moveExamFn(r, to, professionalName(state.profile), new Date().toISOString(), extra);
  commitEncounter({ ...e, examRequests: list.map((x) => (x.id === reqId ? next : x)) });
}
export function auditExamRequest(encounterId: string, reqId: string, auditStatus: ExamAuditStatus, auditNote = '') {
  if (!canAct(state.profile, 'faturar', state.accessAreas)) throw new Error('Apenas a equipe de Faturamento pode auditar exames.');
  if (auditStatus === 'Glosado' && !auditNote.trim()) throw new Error('Informe o motivo da glosa.');
  const { e } = getEncounter(encounterId);
  const list = e.examRequests ?? []; const r = list.find((x) => x.id === reqId); if (!r) throw new Error('Pedido não encontrado.');
  const next = { ...r, auditStatus, auditNote: auditNote.trim(), auditedAt: new Date().toISOString(), auditedBy: professionalName(state.profile) };
  commitEncounter({ ...e, examRequests: list.map((x) => (x.id === reqId ? next : x)) });
}

// ---- Pronto-Socorro Infantil ----
function psCommit(id: string, patch: (ps: PsInfo, e: PsEncounter) => PsInfo, note: string, status?: Encounter['status_fluxo']) {
  const { e } = getEncounter(id); const cur = e as PsEncounter; const at = new Date().toISOString();
  const st = status ?? e.status_fluxo;
  commitEncounter({ ...cur, ps: patch(cur.ps ?? {}, cur), status_fluxo: st, history: [...e.history, { status: st, at, by: professionalName(state.profile), note }] } as Encounter);
}
export function psSetDestination(id: string, destination: PsDestination) { psCommit(id, (ps) => ({ ...ps, destination }), `Encaminhado para ${destination}`); }
export function psSetBed(id: string, bed: string) {
  if (!PS_BEDS.includes(bed)) throw new Error('Leito inválido.');
  if (state.encounters.some((x) => x.id !== id && x.status_fluxo !== 'ALTA_HOSPITALAR' && (x as PsEncounter).ps?.bed === bed)) throw new Error('Leito ocupado.');
  psCommit(id, (ps) => ({ ...ps, bed, obsAt: ps.obsAt ?? new Date().toISOString() }), `Observação · leito ${bed}`);
}
export function psReleaseBed(id: string) { psCommit(id, (ps) => { const { bed: _b, ...rest } = ps; return rest; }, 'Leito de observação liberado'); }
/** Enfermagem encaminha para retorno/reavaliação médica. */
export function psRequestReturn(id: string, note = 'Retorno médico solicitado pela enfermagem') {
  const { e } = getEncounter(id);
  const status = e.status_fluxo === 'AGUARDANDO_MEDICACAO' ? 'EM_OBSERVACAO_REAVALIACAO' : undefined;
  psCommit(id, (ps) => ({ ...ps, returnRequestedAt: new Date().toISOString() }), note, status);
}
export function psAwaitDischarge(id: string) { psCommit(id, (ps) => ({ ...ps, awaitingDischargeAt: new Date().toISOString() }), 'Alta assistencial · aguardando alta médica'); }
/** Alta por evasão: somente médico, encerra o atendimento e libera o leito. */
export function psEvasion(id: string, note: string) {
  requireAction('prescrever');
  if (note.trim().length < 5) throw new Error('Descreva a evasão.');
  const { e } = getEncounter(id); if (e.status_fluxo === 'ALTA_HOSPITALAR') throw new Error('Atendimento já encerrado.');
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  psCommit(id, (ps) => { const { bed: _b, ...rest } = ps; return { ...rest, evasion: { at, by, note: note.trim() } }; }, `Alta por evasão: ${note.trim()}`, 'ALTA_HOSPITALAR');
}
export function psAddScale(id: string, rec: Omit<ScaleRecord, 'id' | 'at' | 'by'>) {
  const r: ScaleRecord = { ...rec, id: crypto.randomUUID(), at: new Date().toISOString(), by: professionalName(state.profile) };
  psCommit(id, (ps) => ({ ...ps, scales: [...(ps.scales ?? []), r] }), `Escala ${rec.scale.toUpperCase()}: ${rec.result}`);
}
export function psOpenSepsis(id: string, kind: SepsisKind) {
  const s = { id: crypto.randomUUID(), kind, openedAt: new Date().toISOString(), openedBy: professionalName(state.profile), checks: {} };
  psCommit(id, (ps) => ({ ...ps, sepsis: [...(ps.sepsis ?? []), s] }), `Protocolo de sepse ${kind} aberto`);
}
export function psUpdateSepsis(id: string, sepsisId: string, checks: Record<string, string>, outcome?: string) {
  psCommit(id, (ps) => ({ ...ps, sepsis: (ps.sepsis ?? []).map((s) => s.id === sepsisId ? { ...s, checks, ...(outcome ? { outcome, closedAt: new Date().toISOString() } : {}) } : s) }), outcome ? `Protocolo de sepse encerrado: ${outcome}` : 'Protocolo de sepse atualizado');
}

/** Salva um documento clínico da internação (UTI, descrição cirúrgica, evolução, serviço social, encaminhamento) no atendimento. */
export function saveClinicalDoc(encounterId: string, kind: import('./inpatient-docs').ClinicalDocKind, values: Record<string, string>) {
  requireAction('evoluir');
  const { e } = getEncounter(encounterId);
  const doc = { id: crypto.randomUUID(), at: new Date().toISOString(), by: professionalName(state.profile), values };
  const docs = { ...(e.clinicalDocs ?? {}), [kind]: [...(e.clinicalDocs?.[kind] ?? []), doc] };
  commitEncounter({ ...e, clinicalDocs: docs });
  return doc;
}

/** Append-only maternal/perinatal assessments, shared by the sector and PEP. */
export function saveMaternityRecord(encounterId: string, patientId: string, kind: MaternityKind, values: Record<string, string>, notes: string) {
  if (!canAccessUnitTab(state.profile, 'maternidade', 'assistencia', state.accessAreas) ||
      (!canAct(state.profile, 'triagem', state.accessAreas) && !canAct(state.profile, 'prescrever', state.accessAreas))) throw new Error('Seu perfil permite apenas visualizar estas avaliações.');
  const { e, p } = getEncounter(encounterId);
  if (e.type !== 'Maternidade' || e.status_fluxo === 'ALTA_HOSPITALAR') throw new Error('Selecione um atendimento ativo da Maternidade.');
  const target = state.patients.find((x) => x.id === patientId);
  if (!target) throw new Error('Paciente não encontrado.');
  if (kind === 'silverman') {
    if (target.type !== 'neonato' || !(target.id === p.id || p.babyIds?.includes(target.id) || target.newborn?.motherId === p.id)) throw new Error('Selecione um RN vinculado a este atendimento.');
  } else if (target.id !== p.id || !['gestante', 'puerpera'].includes(target.type)) throw new Error('Esta avaliação é exclusiva da gestante ou puérpera deste atendimento.');
  const result = maternityResult(kind, values);
  if (kind === 'checklist' && Object.values(values).includes('na') && !notes.trim()) throw new Error('Justifique os itens não aplicáveis.');
  const rec: MaternityRecord = { id: crypto.randomUUID(), patientId, kind, values: { ...values }, result, notes: notes.trim(), at: new Date().toISOString(), by: professionalName(state.profile) };
  const updated = { ...e, maternity: [...(e.maternity ?? []), rec], history: [...e.history, { status: e.status_fluxo, at: rec.at, by: rec.by, note: `${kind}: ${target.name} — ${result}${rec.notes ? ` — ${rec.notes}` : ''}` }] };
  setState((s) => ({ encounters: s.encounters.map((x) => x.id === e.id ? updated : x) }));
  return rec;
}

/** Registro intensivo (UTI Pediátrica / UCI): escalas, balanço hídrico, bundles, SBAR, SAE e evoluções padronizadas no paciente. */
type IcuItem<K extends 'scales' | 'balances' | 'bundles' | 'notes' | 'neo' | 'vitals'> = NonNullable<import('./uti-uci').IntensiveRecord[K]> extends (infer T)[] ? T : never;
export function addIntensive<K extends 'scales' | 'balances' | 'bundles' | 'notes' | 'neo' | 'vitals'>(patientId: string, kind: K, entry: Omit<IcuItem<K>, 'id' | 'at' | 'by'>) {
  if (!canAct(state.profile, 'evoluir', state.accessAreas) && !canAct(state.profile, 'checar', state.accessAreas)) throw new Error('Seu perfil não permite esta ação.');
  const rec = { ...entry, id: crypto.randomUUID(), at: new Date().toISOString(), by: professionalName(state.profile) };
  updatePatient(patientId, (p) => ({ intensive: { ...(p.intensive ?? {}), [kind]: [...((p.intensive?.[kind] as unknown[]) ?? []), rec] } }));
  return rec;
}
export function setIntensiveSafety(patientId: string, safety: import('./uti-uci').SafetyInfo) {
  if (!canAct(state.profile, 'evoluir', state.accessAreas) && !canAct(state.profile, 'checar', state.accessAreas)) throw new Error('Seu perfil não permite esta ação.');
  updatePatient(patientId, (p) => ({ intensive: { ...(p.intensive ?? {}), safety } }));
}

/** Médico solicita atendimento fisioterápico; aparece na área Fisioterapia. */
export function requestPhysio(patientId: string, data: Pick<import('./physio').PhysioRequest, 'modality' | 'priority' | 'support' | 'justification'> & { frequency?: import('./physio').PhysioFrequency }) {
  requireAction('prescrever');
    const issues = physioRequestIssues(data); if (issues.length) throw new Error(issues.join(' '));
  const req: import('./physio').PhysioRequest = { ...data, justification: data.justification.trim(), id: crypto.randomUUID(), requestedAt: new Date().toISOString(), requestedBy: professionalName(state.profile), status: 'Aguardando', sessions: [] };
  updatePatient(patientId, (p) => ({ physio: [...(p.physio ?? []), req] }));
  return req;
}
/** Fisioterapia registra a sessão; também entra na evolução do PEP. */
export function recordPhysioSession(patientId: string, reqId: string, s: { conduct: string; pre: string; post: string }, finish = false) {
  requireAction('evoluir');
  if (!s.conduct.trim()) throw new Error('Descreva a conduta realizada.');
  const by = professionalName(state.profile); const at = new Date().toISOString();
  updatePatient(patientId, (p) => { const cur = (p.physio ?? []).find((r) => r.id === reqId); const stamp = cur?.frequency ? (cur.frequency === 'Agora' ? 'Sessão única (Agora) · ' : `${cur.sessions.filter((x) => Date.now() - Date.parse(x.at) < 86400000).length + 1}ª sessão do dia (Prescrição: ${cur.frequency}/dia) · `) : ''; return {
    physio: (p.physio ?? []).map((r) => r.id === reqId ? { ...r, status: finish ? 'Concluída' : 'Em acompanhamento', sessions: [...r.sessions, { id: crypto.randomUUID(), at, by, ...s }] } : r),
    evolutions: [...p.evolutions, { time: new Date(at).toLocaleString('pt-BR'), cat: 'Fisioterapia', author: by, text: `${stamp}${s.conduct.trim()}${s.pre ? ` | Pré: ${s.pre}` : ''}${s.post ? ` | Pós: ${s.post}` : ''}${finish ? ' | Alta da fisioterapia' : ''}` }],
  }; });
}
export function requestService(patientId: string, data: Pick<import('./service-orders').ServiceRequest, 'kind' | 'region' | 'detail' | 'priority' | 'justification'>) {
  if (!can(state.profile, 'prescrever')) throw new Error('Somente o médico pode solicitar.');
  const issues = serviceRequestIssues(data); if (issues.length) throw new Error(issues.join(' '));
  const req: import('./service-orders').ServiceRequest = { ...data, region: data.region.trim(), justification: data.justification.trim(), id: crypto.randomUUID(), requestedAt: new Date().toISOString(), requestedBy: professionalName(state.profile), status: 'Aguardando' };
  updatePatient(patientId, (p) => ({ services: [...(p.services ?? []), req] }));
}
export function completeService(patientId: string, reqId: string, report: string) {
  if (!report.trim()) throw new Error('Descreva o atendimento realizado.');
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  updatePatient(patientId, (p) => { const cur = (p.services ?? []).find((r) => r.id === reqId); if (!cur || cur.status !== 'Aguardando') throw new Error('Pedido não está aguardando.'); const label = cur.kind === 'raio-x' ? 'Raio-X' : 'Gesso'; return {
    services: (p.services ?? []).map((r) => r.id === reqId ? { ...r, status: 'Concluído', report: report.trim(), doneAt: at, doneBy: by } : r),
    evolutions: [{ time: new Date(at).toLocaleString('pt-BR'), cat: label, author: by, text: `${label} · ${cur.region}${cur.detail ? ` (${cur.detail})` : ''} · ${report.trim()}` }, ...p.evolutions],
  }; });
}
export function cancelService(patientId: string, reqId: string, note: string) {
  if (!note.trim()) throw new Error('Informe o motivo do cancelamento.');
  updatePatient(patientId, (p) => ({ services: (p.services ?? []).map((r) => r.id === reqId ? { ...r, status: 'Cancelado', closedNote: note.trim() } : r) }));
}
export function cancelPhysio(patientId: string, reqId: string, note: string) {
  requireAction('prescrever');
  if (!note.trim()) throw new Error('Informe o motivo do cancelamento.');
  updatePatient(patientId, (p) => ({ physio: (p.physio ?? []).map((r) => r.id === reqId ? { ...r, status: 'Cancelada', closedNote: note.trim() } : r) }));
}

// ---- Banco de Leite Humano ----
export function saveMilkCare(encounterId: string, input: Omit<MilkCareRecord, 'id' | 'at' | 'by'>, finish = false) {
  requireAction('evoluir');
  if (!canAccessPage(state.profile, '/banco-de-leite', state.accessAreas)) throw new Error('Sem acesso ao Banco de Leite.');
  const { e, p } = getEncounter(encounterId);
  validateMilkCare(input, e, finish);
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const r: MilkCareRecord = { ...input, id: crypto.randomUUID(), at, by, procedures: input.procedures.map((x) => ({ ...x, at, by, sector: 'Banco de Leite' })) };
  const ambulatory = e.type === 'Ambulatório' && e.specialty === 'Banco de Leite' && !e.fia;
  const next: Encounter = {
    ...e, milkCare: [...(e.milkCare ?? []), r],
    ...(ambulatory ? { sigtapCode: input.consultationCode || e.sigtapCode || '', medical: { ...e.medical, anamnesis: input.assessment, exam: input.assessment, diagnosis: e.medical?.diagnosis ?? '', cid: input.cid } } : {}),
    extraProcedures: [...(e.extraProcedures ?? []), ...r.procedures],
    ...(finish ? { status_fluxo: 'ALTA_HOSPITALAR' as const, baaClosedAt: at, discharge: { summary: milkCareText(r), recipe: input.plan, at, by } } : {}),
    history: [...e.history, { status: finish ? 'ALTA_HOSPITALAR' : e.status_fluxo, at, by, note: `Banco de Leite: ${finish ? 'atendimento finalizado' : 'evolução registrada'} · ${input.council}` }],
  };
  commitEncounter(next, { patients: state.patients.map((x) => x.id === p.id ? { ...x, evolutions: [...x.evolutions, { time: new Date(at).toLocaleString('pt-BR'), cat: 'Procedimento' as const, author: `${by} · ${input.council}`, text: milkCareText(r) }] } : x) });
  return r;
}
const milk = (fn: (m: MilkBank) => Partial<MilkBank>) => setState((s) => ({ milkBank: { ...EMPTY_MILK_BANK, ...s.milkBank, ...fn({ ...EMPTY_MILK_BANK, ...s.milkBank }) } }));
export function addMilkDonor(d: { name: string; phone?: string; origin: 'Interna' | 'Domiciliar'; serologyOk: boolean }) {
  if (!d.name.trim()) throw new Error('Informe o nome da doadora.');
  milk((m) => ({ donors: [...m.donors, { ...d, name: d.name.trim(), id: crypto.randomUUID(), createdAt: new Date().toISOString(), active: true }] }));
}
export function toggleMilkDonor(id: string) { milk((m) => ({ donors: m.donors.map((d) => d.id === id ? { ...d, active: !d.active } : d) })); }
export function addRawBottle(b: { donorId: string; collectedAt: string; volume: number; homeVisit?: boolean }) {
  const donor = state.milkBank?.donors.find((d) => d.id === b.donorId);
  if (!donor) throw new Error('Selecione a doadora.');
  if (!donor.serologyOk) throw new Error('Doadora sem triagem sorológica liberada.');
  if (!(b.volume > 0)) throw new Error('Informe o volume em mL.');
  milk((m) => ({
    raw: [...m.raw, { id: crypto.randomUUID(), code: `C-${String(m.raw.length + 1).padStart(4, '0')}`, donorId: b.donorId, collectedAt: new Date(b.collectedAt).toISOString(), volume: b.volume, status: 'Estoque' }],
    visits: b.homeVisit ? [...m.visits, { id: crypto.randomUUID(), donorId: b.donorId, at: new Date(b.collectedAt).toISOString(), volume: b.volume }] : m.visits,
  }));
}
export function discardRawBottle(id: string, note: string) { milk((m) => ({ raw: m.raw.map((b) => b.id === id ? { ...b, status: 'Descartado', note } : b) })); }
export function scheduleMilkBatch(scheduledAt: string, bottleIds: string[]) {
  if (!bottleIds.length) throw new Error('Selecione ao menos um frasco de leite cru.');
  milk((m) => {
    const id = crypto.randomUUID(); const vol = m.raw.filter((b) => bottleIds.includes(b.id)).reduce((t, b) => t + b.volume, 0);
    return { batches: [...m.batches, { id, code: `P-${new Date().getFullYear()}/${String(m.batches.length + 1).padStart(3, '0')}`, scheduledAt: new Date(scheduledAt).toISOString(), bottleIds, volume: vol, remaining: 0, status: 'Agendado' }],
      raw: m.raw.map((b) => bottleIds.includes(b.id) ? { ...b, status: 'Em lote', batchId: id } : b) };
  });
}
export function finishMilkBatch(id: string, r: { dornic: number; crematocrit: number; microOk: boolean }) {
  const ok = batchApproved(r.dornic, r.microOk); const at = new Date();
  milk((m) => ({
    batches: m.batches.map((b) => b.id === id ? { ...b, ...r, kcal: kcalFromCrematocrit(r.crematocrit), status: ok ? 'Aprovado' : 'Reprovado', doneAt: at.toISOString(), doneBy: professionalName(state.profile), remaining: ok ? b.volume : 0, expiresAt: new Date(at.getTime() + LHP_VALIDITY_DAYS * 86_400_000).toISOString() } : b),
    raw: m.raw.map((b) => b.batchId === id ? { ...b, status: ok ? 'Pasteurizado' : 'Descartado' } : b),
  }));
  return ok;
}
export function setMilkRecipient(patientId: string, mlPerFeed: number, feedsPerDay: number) {
  milk((m) => ({ recipients: [...m.recipients.filter((r) => r.patientId !== patientId), { patientId, mlPerFeed, feedsPerDay, since: m.recipients.find((r) => r.patientId === patientId)?.since ?? new Date().toISOString(), active: mlPerFeed > 0 }] }));
}
export function dispenseMilk(batchId: string, patientId: string, volume: number) {
  const b = state.milkBank?.batches.find((x) => x.id === batchId);
  if (!b || b.status !== 'Aprovado') throw new Error('Lote não liberado.');
  if (!(volume > 0) || volume > b.remaining) throw new Error(`Volume indisponível no lote (restam ${b.remaining} mL).`);
  milk((m) => ({ batches: m.batches.map((x) => x.id === batchId ? { ...x, remaining: x.remaining - volume } : x), dispenses: [...m.dispenses, { id: crypto.randomUUID(), batchId, patientId, volume, at: new Date().toISOString(), by: professionalName(state.profile) }] }));
}

export function saveInstitution(next: Partial<InstitutionConfig>) {
  if (!canAct(state.profile, "faturar", state.accessAreas) && state.profile !== "Administrador") {
    throw new Error("Apenas Faturamento ou Administração podem alterar os dados do hospital.");
  }
  setState((s) => ({ institution: normalizeInstitution({ ...s.institution, ...next }) }));
}
