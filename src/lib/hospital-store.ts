import { useSyncExternalStore } from "react";
import { PATIENTS, QUEUE, SURGERIES, type Admin, type Newborn, type Patient, type Profile, type QueueItem, type Surgery } from "./hospital-data";

import { transition, validateTriage, type Encounter, type Triage, type FlowStatus } from "./care-flow";
import { BASE_BEDS, can } from "./hospital-data";
import { DEFAULT_CID_AREAS, DEFAULT_CID_GROUPS, addArea, addGroup, type CidArea, type CidGroup } from "./cid-access";
import { DEFAULT_ROOMS, addRoomName, pushCall, removeRoomName, type PanelCall } from "./panel-calls";
import { catalogToStock, findStockMedication, medicationKey, type StockMedication } from "./pharmacy-stock";
import CATALOG from "./stock-catalog.json";
export const PHARMACY_CATALOG = catalogToStock(CATALOG.farm, 'farm');
export const WAREHOUSE_CATALOG = catalogToStock(CATALOG.almox, 'almox');
import { registrationPatch } from "./patient-registration-mapping";
import type { PatientRegistration } from "./patient-registration";

interface State { encounters: Encounter[]; beSequence: number; stock: StockMedication[]; warehouse: StockMedication[]; profile: Profile; employeeName: string; patients: Patient[]; queue: QueueItem[]; surgeries: Surgery[]; admins: Record<string, Admin>; rooms: string[]; calls: PanelCall[]; cidGroups: CidGroup[]; cidAreas: CidArea[]; employeeArea: string; accessAreas: string[] | null; removedStock: string[] }
let state: State = { profile: "Outro", employeeName: "", patients: [], queue: [], surgeries: [], admins: {}, encounters: [], beSequence: 0, stock: PHARMACY_CATALOG, warehouse: WAREHOUSE_CATALOG, rooms: DEFAULT_ROOMS, calls: [], cidGroups: DEFAULT_CID_GROUPS, cidAreas: DEFAULT_CID_AREAS, employeeArea: "", accessAreas: null, removedStock: [] };
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

function requireAction(action: Parameters<typeof can>[1]) {
  if (!can(state.profile, action)) throw new Error('Seu perfil não permite esta ação.');
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
export function openEncounter(patient: Patient, type: string, specialty: string, complaint: string) {
  requireAction('recepcao');
  if (state.encounters.some((e) => e.patientId === patient.id && e.status_fluxo !== 'ALTA_HOSPITALAR')) throw new Error('Paciente já possui um BE ativo.');
  const at = new Date().toISOString();
  const number = `BE-${new Date().getFullYear()}-${String(state.beSequence + 1).padStart(6, '0')}`;
  const e: Encounter = { id: crypto.randomUUID(), patientId: patient.id, number, type, specialty, complaint, status_fluxo: 'AGUARDANDO_TRIAGEM', openedAt: at, history: [{ status: 'AGUARDANDO_TRIAGEM', at, by: professionalName(state.profile), note: 'Recepção: abertura de BE' }] };
  setState((s) => ({ beSequence: s.beSequence + 1, patients: [...s.patients.filter((p) => p.id !== patient.id), patient], encounters: [...s.encounters, e], queue: [...s.queue, { id: e.id, name: patient.name, group: patient.type === 'gestante' || patient.type === 'puerpera' ? 'obstetrica' : 'pediatria', complaint, arrivedMinAgo: 0, detail: patient.age }] }));
  return e;
}
export function savePatientRegistration(id: string, input: PatientRegistration) {
  requireAction('recepcao');
  const patient = state.patients.find(p => p.id === id);
  if (!patient) throw new Error('Paciente não encontrado.');
  const patch = registrationPatch(input, professionalName(state.profile), patient);
  setState(s => ({ patients: s.patients.map(p => p.id === id ? { ...p, ...patch } : p), queue: s.queue.map(q => s.encounters.some(e => e.id === q.id && e.patientId === id) ? { ...q, name: patch.name ?? q.name, detail: patch.age ?? q.detail } : q) }));
}
export function completeTriage(id: string, t: Triage) {
  requireAction('triagem');
  const { e, p } = getEncounter(id);
  validateTriage(p.type === 'pediatria' || p.type === 'neonato', t);
  const next = e.status_fluxo === 'AGUARDANDO_MEDICO'
    ? { ...e, history: [...e.history, { status: e.status_fluxo, at: new Date().toISOString(), by: professionalName(state.profile), note: 'Reclassificação de risco pelo PCACR' }] }
    : transition(e, 'AGUARDANDO_MEDICO', professionalName(state.profile), 'Triagem concluída');
  commitEncounter({ ...next, triage: t, complaint: t.complaint }, { patients: state.patients.map((x) => x.id === p.id ? { ...x, weight: t.weight, ...(Number(t.height) > 0 ? { height: Number(t.height) } : {}), guardian: t.guardian, ig: t.ig, dum: t.dum, allergies: t.allergies, risks: t.allergies.length ? [...new Set([...x.risks, 'Alergia' as const])] : x.risks.filter((r) => r !== 'Alergia'), vitals: [...x.vitals, t.vital] } : x) });
}
export function callPatient(id: string) {
  requireAction('prescrever');
  const { e } = getEncounter(id);
  commitEncounter(transition(e, 'EM_ATENDIMENTO_MEDICO', professionalName(state.profile), 'Consulta / reavaliação iniciada'));
}
export function saveMedical(id: string, medical: NonNullable<Encounter['medical']>) {
  requireAction('prescrever'); const { e, p } = getEncounter(id);
  if (e.status_fluxo !== 'EM_ATENDIMENTO_MEDICO') throw new Error('Inicie o atendimento médico primeiro.');
  commitEncounter({ ...e, medical }, { patients: state.patients.map((x) => x.id === p.id ? { ...x, diagnosis: medical.diagnosis, evolutions: [{ time: new Date().toLocaleString('pt-BR'), cat: 'Médica' as const, author: professionalName(state.profile), text: `Anamnese: ${medical.anamnesis}\nExame: ${medical.exam}\nCID-10: ${medical.cid}\nHipótese: ${medical.diagnosis}` }, ...x.evolutions] } : x) });
}
export function signPrescription(id: string) {
  requireAction('prescrever'); const { e, p } = getEncounter(id);
  if (!e.medical?.diagnosis.trim()) throw new Error('Registre a avaliação e hipótese diagnóstica.');
  if (!p.prescriptions.length) throw new Error('Adicione itens à prescrição.');
  const needsPharmacy = p.prescriptions.some((r) => r.cat === 'Medicamento' || r.cat === 'Hidratação');
  const at = new Date().toISOString();
  const next = transition(e, needsPharmacy ? 'AGUARDANDO_FARMACIA' : 'EM_OBSERVACAO_REAVALIACAO', professionalName(state.profile), 'Prescrição assinada', at);
  commitEncounter({ ...next, signedAt: at, signedBy: professionalName(state.profile) }, { patients: state.patients.map((x) => x.id === p.id ? { ...x, prescriptions: x.prescriptions.map((r) => r.cat === 'Medicamento' || r.cat === 'Hidratação' ? { ...r, pharmacy: 'Pendente', times: r.times?.length ? r.times : [nowHM()] } : r.cat === 'Cuidados' ? { ...r, times: r.times?.length ? r.times : [nowHM()] } : r) } : x) });
}
export function validatePrescription(id: string, rxId: string) {
  requireAction('farmacia'); const { e, p } = getEncounter(id);
  if (e.status_fluxo !== 'AGUARDANDO_FARMACIA') throw new Error('Prescrição não está na farmácia.');
  updatePatient(p.id, (x) => ({ prescriptions: x.prescriptions.map((r) => r.id === rxId ? { ...r, pharmacy: 'Validada' } : r) }));
}
export function dispenseKit(id: string, intervention: string) {
  requireAction('farmacia'); const { e, p } = getEncounter(id);
  const meds = p.prescriptions.filter((r) => r.pharmacy);
  if (!meds.length || meds.some((r) => r.pharmacy !== 'Validada')) throw new Error('Valide todos os itens do kit antes de dispensar.');
  const required = new Map<string, number>();
  meds.forEach((r) => {
    const medication = findStockMedication(state.stock, r.item);
    if (!medication) throw new Error(`Estoque insuficiente: ${medicationKey(r.item)}. Cadastre o medicamento e registre a entrada.`);
    required.set(medication.id, (required.get(medication.id) ?? 0) + (r.times?.length ?? 1));
  });
  for (const [medicationId, qty] of required) {
    const medication = state.stock.find((item) => item.id === medicationId);
    if (!medication || medication.quantity < qty) throw new Error(`Estoque insuficiente: ${medication?.name ?? medicationId}. Disponível: ${medication?.quantity ?? 0}; necessário: ${qty}.`);
  }
  const stock = state.stock.map((item) => ({ ...item, quantity: item.quantity - (required.get(item.id) ?? 0) }));
  commitEncounter({ ...transition(e, 'AGUARDANDO_MEDICACAO', professionalName(state.profile), 'Kit dispensado'), intervention }, { stock, patients: state.patients.map((x) => x.id === p.id ? { ...x, prescriptions: x.prescriptions.map((r) => r.pharmacy ? { ...r, pharmacy: 'Dispensada' } : r) } : x) });
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
export function adjustStock(id: string, delta: number) {
  requireAction('farmacia');
  if (!Number.isInteger(delta) || delta === 0) throw new Error('Informe uma entrada ou saída inteira diferente de zero.');
  const medication = state.stock.find((item) => item.id === id);
  if (!medication) throw new Error('Medicamento não encontrado.');
  if (medication.quantity + delta < 0) throw new Error('O ajuste não pode deixar o estoque negativo.');
  setState((s) => ({ stock: s.stock.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item) }));
}
export function adjustWarehouse(id: string, delta: number) {
  requireAction('almoxarifado');
  if (!Number.isInteger(delta) || delta === 0) throw new Error('Informe uma entrada ou saída inteira diferente de zero.');
  const item = state.warehouse.find((x) => x.id === id);
  if (!item) throw new Error('Item não encontrado.');
  if (item.quantity + delta < 0) throw new Error('O ajuste não pode deixar o estoque negativo.');
  setState((s) => ({ warehouse: s.warehouse.map((x) => x.id === id ? { ...x, quantity: x.quantity + delta } : x) }));
}
/** Atalho usado pela integração da prescrição para acrescentar unidades a um item. */
export function addStock(item: string, qty: number) {
  const existing = findStockMedication(state.stock, item);
  if (existing) { adjustStock(existing.id, qty); return; }
  createStockMedication({ name: medicationKey(item), presentation: '', unit: 'un', quantity: qty, minimum: 0 });
}
export function recordMedication(id: string, rxId: string, time: string, status: Admin['status'], reason = '') {
  requireAction('checar'); const { e, p } = getEncounter(id);
  const rx = p.prescriptions.find((r) => r.id === rxId);
  if (!rx || !rx.times?.includes(time) || (rx.pharmacy && rx.pharmacy !== 'Dispensada') || !['AGUARDANDO_MEDICACAO', 'EM_OBSERVACAO_REAVALIACAO'].includes(e.status_fluxo)) throw new Error('Medicação ainda não liberada para administração.');
  const key = `${p.id}|${rxId}|${time}`;
  if (state.admins[key]?.status === 'checado') throw new Error('Dose já checada.');
  if (status !== 'checado' && !reason.trim()) throw new Error('Informe a justificativa.');
  const at = new Date().toISOString();
  const admins = { ...state.admins, [key]: { status, by: professionalName(state.profile), at, reason } };
  const allDone = p.prescriptions.filter((r) => r.times?.length).every((r) => r.times?.every((t) => admins[`${p.id}|${r.id}|${t}`]?.status === 'checado'));
  commitEncounter(allDone && e.status_fluxo === 'AGUARDANDO_MEDICACAO' ? transition(e, 'EM_OBSERVACAO_REAVALIACAO', professionalName(state.profile), 'Medicação concluída - pronto para reavaliação', at) : e, { admins });
}
export function finishEncounter(id: string, outcome: 'internacao' | 'co' | 'exames' | 'alta', details: { bed?: string; summary: string; recipe: string; exam: string }) {
  requireAction('prescrever'); const { e, p } = getEncounter(id);
  if (!['EM_ATENDIMENTO_MEDICO', 'EM_OBSERVACAO_REAVALIACAO', 'ENCAMINHADO_INTERNACAO', 'ENCAMINHADO_CO'].includes(e.status_fluxo)) throw new Error('Desfecho disponível após avaliação médica.');
  const by = professionalName(state.profile); const at = new Date().toISOString();
  if (outcome === 'exames') { if (!details.exam.trim()) throw new Error('Informe o exame.'); commitEncounter({ ...(e.status_fluxo === 'EM_ATENDIMENTO_MEDICO' ? transition(e, 'EM_OBSERVACAO_REAVALIACAO', by, `Exames: ${details.exam}`, at) : e), examPending: details.exam }); return; }
  if (outcome === 'co') {
    if (p.type !== 'gestante') throw new Error('Centro Obstétrico disponível para gestantes.');
    commitEncounter(transition(e, 'ENCAMINHADO_CO', by, 'Urgência Obstétrica', at), { patients: state.patients.map((x) => x.id === p.id ? { ...x, ward: 'CO', bed: '' } : x), surgeries: [...state.surgeries, { id: crypto.randomUUID(), patientId: p.id, patient: p.name, room: 'Sala de Parto 1', start: new Date().getHours() + new Date().getMinutes() / 60, duration: 1, type: 'Parto Normal', tuss: '', surgeon: by, status: 'Em Preparo', checks: {}, gastos: [] }] }); return;
  }
  if (outcome === 'internacao') {
    const bed = BASE_BEDS.find((b) => b.id === details.bed && ['AC', 'UTIN', 'ENFP'].includes(b.ward));
    if (!bed || bed.status !== 'livre' || state.patients.some((x) => x.bed === bed.id)) throw new Error('Selecione um leito livre.');
    commitEncounter(transition(e, 'ENCAMINHADO_INTERNACAO', by, `Leito ${bed.id}`, at), { patients: state.patients.map((x) => x.id === p.id ? { ...x, ward: bed.ward, bed: bed.id } : x) }); return;
  }
  if (!details.summary.trim()) throw new Error('Informe o resumo de alta.');
  commitEncounter({ ...transition(e, 'ALTA_HOSPITALAR', by, 'BE encerrado', at), discharge: { summary: details.summary, recipe: details.recipe, by, at } }, { patients: state.patients.map((x) => x.id === p.id ? { ...x, bed: '', dischargeForecast: '' } : x), surgeries: state.surgeries.map((s) => s.patientId === p.id ? { ...s, status: 'Finalizado' } : s) });
}

/** Registra o parto: cria prontuário "RN de <mãe>" vinculado e converte a mãe em puérpera. */
export function registerBirth(motherId: string, nb: Omit<Newborn, "motherId">, mode: "Parto Normal" | "Cesárea", sex: "F" | "M"): string {
  const m = state.patients.find((p) => p.id === motherId);
  if (!m) throw new Error("Mãe não encontrada");
  const id = `rn-${state.patients.length + 1}`;
  const uti = nb.apgar5 < 7 || nb.pesoNascer < 2000;
  const rn: Patient = {
    id, prontuario: `2026-${String(4900 + state.patients.length)}`, name: `RN de ${m.name}`, cpf: "—", motherName: m.name, type: "neonato", age: "0 dia",
    ig: `${m.ig ?? ""} (ao nascer)`, weight: nb.pesoNascer / 1000, height: nb.comprimento, allergies: [], risks: [], ward: uti ? "UTIN" : "AC",
    bed: uti ? "UTIN-07" : `${m.bed}-RN`, insurance: m.insurance, ...(m.guia ? { guia: m.guia } : {}), authorized: m.authorized,
    diagnosis: `RN ${sex === "F" ? "feminino" : "masculino"} – ${mode}`, admission: `14/11 ${nowHM()}`, days: 1,
    evolutions: [{ time: `14/11 ${nowHM()}`, cat: "Médica", author: professionalName(state.profile), text: `Nascimento por ${mode.toLowerCase()}. Apgar ${nb.apgar1}/${nb.apgar5}, peso ${nb.pesoNascer} g.` }],
    vitals: [], prescriptions: [], newborn: { ...nb, motherId },
  };
  setState((s) => ({
    patients: [...s.patients.map((p) => p.id === motherId ? { ...p, type: "puerpera" as const, ward: "AC" as const, bed: m.bed.startsWith("CO") ? "AC-05" : p.bed, diagnosis: `Puerpério imediato – ${mode}`, babyIds: [...(p.babyIds ?? []), id], evolutions: [{ time: `14/11 ${nowHM()}`, cat: "Médica" as const, author: professionalName(s.profile), text: `Parto ${mode.toLowerCase()} realizado. RN vinculado (${rn.prontuario}).` }, ...p.evolutions] } : p), rn],
  }));
  if (rn.bed.endsWith("-RN")) updatePatient(id, () => ({ bed: "AC-05B" }));
  return id;
}

export function announcePatient(patientId: string, room: string) {
  if (!state.rooms.includes(room)) throw new Error('Selecione o consultório.');
  const p = state.patients.find((x) => x.id === patientId); if (!p) throw new Error('Paciente não encontrado.');
  const e = encounterFor(patientId);
  setState((s) => ({ calls: pushCall(s.calls, { id: crypto.randomUUID(), patientName: p.name, room, risk: e?.triage?.risk, at: new Date().toISOString() }) }));
}
export function addRoom(name: string) { if (state.profile !== 'Administrador') throw new Error('Apenas administradores gerenciam consultórios.'); setState((s) => ({ rooms: addRoomName(s.rooms, name) })); }
export function removeRoom(name: string) { if (state.profile !== 'Administrador') throw new Error('Apenas administradores gerenciam consultórios.'); setState((s) => ({ rooms: removeRoomName(s.rooms, name) })); }

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
