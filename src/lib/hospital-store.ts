import { DEFAULT_KITS, checkKitUse, findKit, setBio, startCycle, type BioResult, type CmeCycle, type CmeKit, type KitStatus } from './cme';
import { useSyncExternalStore } from "react";
import { linkCode } from "./barcode";
import { PATIENTS, QUEUE, SURGERIES, type Admin, type Newborn, type Patient, type Profile, type QueueItem, type Surgery } from "./hospital-data";

import { transition, validateTriage, type Encounter, type Triage, type FlowStatus } from "./care-flow";
import { BASE_BEDS, can, canAct } from "./hospital-data";
import { DEFAULT_CID_AREAS, DEFAULT_CID_GROUPS, addArea, addGroup, type CidArea, type CidGroup } from "./cid-access";
import { DEFAULT_ROOMS, addRoomName, pushCall, removeRoomName, type PanelCall } from "./panel-calls";
import { catalogToStock, findStockMedication, medicationKey, type StockMedication } from "./pharmacy-stock";
import CATALOG from "./stock-catalog.json";
import CONTROLLED from "./controlled-catalog.json";
import WAREHOUSE from "./warehouse-catalog.json";
import { expiryStatus } from "./controlled";
import { changeQty, checkQty, loanReturnedQty, transferItem, type Depot, type Movement, type SupplyRequest } from "./supply-flow";
export const PHARMACY_CATALOG = catalogToStock([...CATALOG.farm, ...CONTROLLED], 'farm');
export const WAREHOUSE_CATALOG = catalogToStock(WAREHOUSE, 'almox');
import { registrationPatch } from "./patient-registration-mapping";
import type { PatientRegistration } from "./patient-registration";
import { learnDoctor, type Doctor } from "./doctors";
import { addSpecialty, DEFAULT_SPECIALTIES, type AmbSpecialty, type Appointment, type SadtReport, type SpecialtyGroup } from "./ambulatorio";

interface State { encounters: Encounter[]; beSequence: number; fiaSequence: number; stock: StockMedication[]; warehouse: StockMedication[]; profile: Profile; employeeName: string; patients: Patient[]; queue: QueueItem[]; surgeries: Surgery[]; admins: Record<string, Admin>; rooms: string[]; calls: PanelCall[]; cidGroups: CidGroup[]; cidAreas: CidArea[]; employeeArea: string; accessAreas: string[] | null; removedStock: string[]; movements: Movement[]; requests: SupplyRequest[]; ambSpecialties: AmbSpecialty[]; appointments: Appointment[]; cmeKits: CmeKit[]; cmeCycles: CmeCycle[]; doctors: Doctor[] }
let state: State = { profile: "Outro", employeeName: "", patients: [], queue: [], surgeries: [], admins: {}, encounters: [], beSequence: 0, fiaSequence: 0, stock: PHARMACY_CATALOG, warehouse: WAREHOUSE_CATALOG, rooms: DEFAULT_ROOMS, calls: [], cidGroups: DEFAULT_CID_GROUPS, cidAreas: DEFAULT_CID_AREAS, employeeArea: "", accessAreas: null, removedStock: [], movements: [], requests: [], ambSpecialties: DEFAULT_SPECIALTIES, appointments: [], cmeKits: DEFAULT_KITS, cmeCycles: [], doctors: [] };
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
export function openEncounter(patient: Patient, type: string, specialty: string, complaint: string) {
  requireAction('recepcao');
  if (state.encounters.some((e) => e.patientId === patient.id && e.status_fluxo !== 'ALTA_HOSPITALAR')) throw new Error('Paciente já possui um BAA ativo.');
  const at = new Date().toISOString();
  const number = `BAA-${new Date().getFullYear()}-${String(state.beSequence + 1).padStart(6, '0')}`;
  const e: Encounter = { id: crypto.randomUUID(), patientId: patient.id, number, type, specialty, complaint, status_fluxo: 'AGUARDANDO_TRIAGEM', openedAt: at, history: [{ status: 'AGUARDANDO_TRIAGEM', at, by: professionalName(state.profile), note: 'Recepção: abertura de BAA' }] };
  const direct = type === 'Ambulatório';
  const opened = direct ? transition(e, 'AGUARDANDO_MEDICO', professionalName(state.profile), 'Ambulatório: pré-consulta de enfermagem e atendimento', at) : e;
  setState((s) => ({ beSequence: s.beSequence + 1, patients: [...s.patients.filter((p) => p.id !== patient.id), patient], encounters: [...s.encounters, opened], queue: direct ? s.queue : [...s.queue, { id: e.id, name: patient.name, group: patient.type === 'gestante' || patient.type === 'puerpera' ? 'obstetrica' : 'pediatria', complaint, arrivedMinAgo: 0, detail: patient.age }] }));
  return opened;
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
/** Farmacêutico ajusta dose/apresentação de um item ainda na farmácia; registra o ajuste no próprio item. */
export function adjustPrescription(id: string, rxId: string, item: string, posologia: string) {
  requireAction('farmacia'); const { e, p } = getEncounter(id);
  if (e.status_fluxo !== 'AGUARDANDO_FARMACIA') throw new Error('Prescrição não está na farmácia.');
  if (!item.trim()) throw new Error('Informe a dose do item.');
  updatePatient(p.id, (x) => ({ prescriptions: x.prescriptions.map((r) => r.id === rxId ? { ...r, item: item.trim().replace(/ · ajuste farmácia$/, '') + ' · ajuste farmácia', posologia: posologia.trim() || r.posologia } : r) }));
}
export function dispenseKit(id: string, intervention: string, lots: Record<string, string> = {}) {
  requireAction('farmacia'); const { e, p } = getEncounter(id);
  const meds = p.prescriptions.filter((r) => r.pharmacy);
  if (!meds.length || meds.some((r) => r.pharmacy !== 'Validada')) throw new Error('Valide todos os itens do kit antes de dispensar.');
  const missingLot = meds.find((r) => !(lots[r.id] ?? '').trim());
  if (missingLot) throw new Error(`Informe o lote de ${missingLot.item}.`);
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
  let stock = state.stock;
  meds.forEach((r) => { const m = findStockMedication(stock, r.item)!; stock = changeQty(stock, m.id, -(r.times?.length ?? 1), (lots[r.id] ?? '').trim()); });
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const consumo = meds.map((r) => { const m = findStockMedication(state.stock, r.item)!; return { ...{ id: crypto.randomUUID(), at: new Date().toISOString(), by: professionalName(state.profile) }, kind: 'consumo' as const, from: m.location ?? 'Farmácia', to: p.name, item: m.name, code: m.code, qty: r.times?.length ?? 1, lot: (lots[r.id] ?? '').trim(), reason: 'Dispensação', patient: p.name, patientId: p.id, baa: e.number, ...(e.fia ? { fia: e.fia.number } : {}) }; });
  const requisition = `${String(state.movements.length + state.encounters.indexOf(e) * 7 + 230000).slice(-6)}/${new Date().getFullYear()}`;
  commitEncounter({ ...transition(e, 'AGUARDANDO_MEDICACAO', by, 'Kit dispensado'), intervention, dispensedAt: at, dispensedBy: by, requisition }, { stock, movements: [...consumo, ...state.movements], patients: state.patients.map((x) => x.id === p.id ? { ...x, prescriptions: x.prescriptions.map((r) => r.pharmacy ? { ...r, pharmacy: 'Dispensada', lot: (lots[r.id] ?? '').trim() } : r) } : x) });
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
export function createSectorRequest(sector: string, items: string, note: string) {
  if (!items.trim()) throw new Error('Adicione ao menos um produto.');
  if (!sector.trim()) throw new Error('Selecione o setor solicitante.');
  const r: SupplyRequest = { id: crypto.randomUUID(), target: 'almoxarifado', items: items.trim(), sector, patient: '', note: note.trim(), status: 'Pendente', at: new Date().toISOString(), by: professionalName(state.profile) };
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
/** Atalho usado pela integração da prescrição para acrescentar unidades a um item. */
export function addStock(item: string, qty: number) {
  const existing = findStockMedication(state.stock, item);
  if (existing) { adjustStock(existing.id, qty); return; }
  createStockMedication({ name: medicationKey(item), presentation: '', unit: 'un', quantity: qty, minimum: 0 });
}
export function recordMedication(id: string, rxId: string, time: string, status: Admin['status'], reason = '') {
  requireAction(status === 'cancelado' ? 'prescrever' : 'checar'); const { e, p } = getEncounter(id);
  const rx = p.prescriptions.find((r) => r.id === rxId);
  if (!rx || !rx.times?.includes(time) || (rx.pharmacy && rx.pharmacy !== 'Dispensada') || !['AGUARDANDO_MEDICACAO', 'EM_OBSERVACAO_REAVALIACAO'].includes(e.status_fluxo)) throw new Error('Medicação ainda não liberada para administração.');
  const key = `${p.id}|${rxId}|${time}`;
  if (state.admins[key]?.status === 'checado' || state.admins[key]?.status === 'cancelado') throw new Error('Dose já checada ou cancelada.');
  if (status !== 'checado' && !reason.trim()) throw new Error('Informe a justificativa.');
  const at = new Date().toISOString();
  const admins = { ...state.admins, [key]: { status, by: professionalName(state.profile), at, reason } };
  const allDone = p.prescriptions.filter((r) => r.times?.length).every((r) => r.times?.every((t) => ['checado', 'cancelado'].includes(admins[`${p.id}|${r.id}|${t}`]?.status ?? '')));
  commitEncounter(allDone && e.status_fluxo === 'AGUARDANDO_MEDICACAO' ? transition(e, 'EM_OBSERVACAO_REAVALIACAO', professionalName(state.profile), 'Medicação concluída - pronto para reavaliação', at) : e, { admins });
}
export function requestAdmission(id: string, req: { ward: string; character: 'Urgência' | 'Eletiva'; cid: string; justification: string; isolation: boolean; oxygen: boolean }) {
  requireAction('prescrever'); const { e } = getEncounter(id);
  if (!['EM_ATENDIMENTO_MEDICO', 'EM_OBSERVACAO_REAVALIACAO'].includes(e.status_fluxo)) throw new Error('Solicitação disponível durante a avaliação médica.');
  if (e.admission?.status === 'pendente') throw new Error('Já existe uma solicitação aguardando o NIR.');
  if (!req.justification.trim()) throw new Error('Informe a justificativa clínica.');
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  commitEncounter({ ...e, admission: { ...req, cid: req.cid || e.medical?.cid || '', status: 'pendente', requestedAt: at, requestedBy: by }, history: [...e.history, { status: e.status_fluxo, at, by, note: 'Internação solicitada ao NIR' }] });
}
// Admission closes the BAA and opens the FIA as the official inpatient document.
function openFia(e: Encounter, ward: string, bed: string, at: string, by: string): { e: Encounter; seq: number } {
  if (e.fia) return { e: { ...e, fia: { ...e.fia, ward, bed } }, seq: state.fiaSequence ?? 0 };
  const seq = (state.fiaSequence ?? 0) + 1;
  const number = `FIA-${new Date(at).getFullYear()}-${String(seq).padStart(6, '0')}`;
  const doctor = e.admission?.requestedBy ?? e.signedBy ?? by;
  const fia = { number, openedAt: at, ward, bed, doctor, authorizedBy: by, cid: e.admission?.cid || e.medical?.cid || '', justification: e.admission?.justification ?? '', character: e.admission?.character ?? 'Urgência' };
  return { e: { ...e, fia, baaClosedAt: at, history: [...e.history, { status: e.status_fluxo, at, by, note: `${e.number} encerrada / transferida para internação · ${number} aberta` }] }, seq };
}
export function authorizeAdmission(id: string, bedId: string) {
  requireAction('nir'); const { e, p } = getEncounter(id);
  if (e.admission?.status !== 'pendente') throw new Error('Solicitação não está pendente.');
  const bed = BASE_BEDS.find((b) => b.id === bedId && ['AC', 'UTIN', 'ENFP'].includes(b.ward));
  if (!bed || bed.status !== 'livre' || state.patients.some((x) => x.bed === bed.id)) throw new Error('Selecione um leito livre.');
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
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  const moved = transition(e, 'ENCAMINHADO_INTERNACAO', by, `NIR: leito ${bedCode} (${sector}) reservado na Hotelaria`, at);
  const f = openFia({ ...moved, admission: { ...e.admission, status: 'autorizada', bed: bedCode, decidedAt: at, decidedBy: by } }, sector || e.admission.ward, bedCode, at, by);
  commitEncounter(f.e, { fiaSequence: f.seq, patients: state.patients.map((x) => x.id === p.id ? { ...x, ward: (e.admission!.ward || p.ward) as Patient["ward"], bed: bedCode } : x) });
}
export function rejectAdmission(id: string, note: string) {
  requireAction('nir'); const { e } = getEncounter(id);
  if (e.admission?.status !== 'pendente') throw new Error('Solicitação não está pendente.');
  if (!note.trim()) throw new Error('Informe o motivo da devolução.');
  const at = new Date().toISOString(); const by = professionalName(state.profile);
  commitEncounter({ ...e, admission: { ...e.admission, status: 'recusada', note, decidedAt: at, decidedBy: by }, history: [...e.history, { status: e.status_fluxo, at, by, note: `NIR devolveu: ${note}` }] });
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
    const f = openFia(transition(e, 'ENCAMINHADO_INTERNACAO', by, `Leito ${bed.id}`, at), bed.ward, bed.id, at, by);
    commitEncounter(f.e, { fiaSequence: f.seq, patients: state.patients.map((x) => x.id === p.id ? { ...x, ward: bed.ward, bed: bed.id } : x) }); return;
  }
  if (!details.summary.trim()) throw new Error('Informe o resumo de alta.');
  commitEncounter({ ...transition(e, 'ALTA_HOSPITALAR', by, e.fia ? `${e.fia.number} encerrada (alta)` : 'BAA encerrada', at), discharge: { summary: details.summary, recipe: details.recipe, by, at } }, { patients: state.patients.map((x) => x.id === p.id ? { ...x, bed: '', dischargeForecast: '' } : x), surgeries: state.surgeries.map((s) => s.patientId === p.id ? { ...s, status: 'Finalizado' } : s) });
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
/** Registra no atendimento o código SIGTAP do procedimento realizado (usado no faturamento BPA). */
export function saveSigtapCode(id: string, code: string) {
  const c = code.replace(/\D/g, '');
  if (c.length !== 10) return;
  setState((s) => ({ encounters: s.encounters.map((e) => e.id === id ? { ...e, sigtapCode: c } : e) }));
}

export function saveAihLaudo(id: string, data: Record<string, string>) {
  setState((s) => ({ encounters: s.encounters.map((e) => e.id === id ? { ...e, aihLaudo: { ...data, savedBy: s.employeeName, savedAt: new Date().toISOString() } } : e) }));
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
export function setAppointmentStatus(id: string, status: 'faltou' | 'cancelado') { requireAction('recepcao'); setState((s) => ({ appointments: s.appointments.map((a) => a.id === id && a.status === 'agendado' ? { ...a, status } : a) })); }
export function checkInAppointment(id: string) {
  requireAction('recepcao');
  const a = state.appointments.find((x) => x.id === id); if (!a || a.status !== 'agendado') throw new Error('Agendamento não disponível.');
  const p = state.patients.find((x) => x.id === a.patientId); if (!p) throw new Error('Paciente não encontrado.');
  const sp = state.ambSpecialties.find((x) => x.id === a.specialtyId);
  const e = openEncounter(p, 'Ambulatório', sp?.name ?? '', `Consulta agendada · ${sp?.name ?? ''}${a.note ? ` · ${a.note}` : ''}`);
  setState((s) => ({ appointments: s.appointments.map((x) => x.id === id ? { ...x, status: 'chegou', encounterId: e.id } : x) }));
  return e;
}
export function saveSadtReport(id: string, r: Omit<SadtReport, 'at'>) {
  requireAction('prescrever');
  const { e } = getEncounter(id);
  if (!r.findings.trim() || !r.conclusion.trim()) throw new Error('Preencha achados e conclusão do laudo.');
  const by = professionalName(state.profile); const at = new Date().toISOString();
  let next = e.status_fluxo === 'AGUARDANDO_MEDICO' ? transition(e, 'EM_ATENDIMENTO_MEDICO', by, 'Exame SADT iniciado', at) : e;
  next = transition(next, 'ALTA_HOSPITALAR', by, `Laudo SADT emitido: ${r.exam}`, at);
  commitEncounter({ ...next, sadtReport: { ...r, at } });
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
