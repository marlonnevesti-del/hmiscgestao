import catalog from "./doctors-catalog.json";

export interface Doctor { code?: string | undefined; name: string; crm?: string | undefined; specialty?: string | undefined; rqe?: string | undefined; cns?: string | undefined; cnsStatus?: string | undefined; teams?: string | undefined; sources?: string | undefined }
export const DOCTOR_CATALOG = catalog as Doctor[];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
export const doctorKey = (d: Doctor) => d.crm ? norm(d.crm).replace(/[^A-Z0-9]/g, '') : norm(d.name);
export function validDoctorCns(cns: string) {
  return /^[12789]\d{14}$/.test(cns) && [...cns].reduce((sum, digit, i) => sum + Number(digit) * (15 - i), 0) % 11 === 0;
}
export function mergeImportedDoctors(existing: Doctor[], incoming: Doctor[]): Doctor[] {
  const map = new Map(existing.map((d) => [doctorKey(d), d]));
  for (const d of incoming) {
    const key = doctorKey(d); const old = map.get(key);
    const combine = (a = '', b = '') => [...new Set([...a.split(';'), ...b.split(';')].map((s) => s.trim()).filter(Boolean))].join('; ');
    map.set(key, { ...old, ...d, specialty: combine(old?.specialty, d.specialty), teams: combine(old?.teams, d.teams), sources: combine(old?.sources, d.sources), cns: d.cns || old?.cns || '', cnsStatus: !d.cns && old?.cns ? old.cnsStatus : d.cnsStatus });
  }
  const result = [...map.values()];
  const counts = new Map<string, number>();
  for (const d of result) if (d.cns) counts.set(d.cns, (counts.get(d.cns) ?? 0) + 1);
  return result.map((d) => (counts.get(d.cns ?? '') ?? 0) > 1 ? { ...d, cnsStatus: 'Conferir CNS repetido' } : d);
}
/** Exact council match first; never infer identity from a partial name. */
export function resolveDoctor(list: Doctor[], name: string, crm = '') {
  if (crm) return list.find((d) => doctorKey(d) === doctorKey({ name, crm }));
  const matches = list.filter((d) => norm(d.name) === norm(name));
  return matches.length === 1 ? matches[0] : undefined;
}
export const documentCns = (d: Doctor | undefined) => d?.cnsStatus === 'Conferir CNS repetido' || !validDoctorCns(d?.cns ?? '') ? '' : d?.cns ?? '';

/** Catalog merged with learned doctors (learned entries override/complete the CRM). */
export function mergeDoctors(learned: Doctor[]): Doctor[] {
  const updated = DOCTOR_CATALOG.map((d) => ({ ...d, ...(learned.find((l) => doctorKey(l) === doctorKey(d)) ?? learned.find((l) => norm(l.name) === norm(d.name))) }));
  return mergeImportedDoctors(updated, learned);
}
export const findDoctor = (list: Doctor[], name: string) => list.find((d) => norm(d.name) === norm(name));
export function searchDoctors(list: Doctor[], q: string, limit = 8): Doctor[] {
  const n = norm(q); if (n.length < 2) return [];
  return list.filter((d) => norm(d.name).includes(n) || (d.code ?? "").includes(n) || norm(d.crm ?? "").includes(n)).slice(0, limit);
}
/** Returns the learned list with the doctor added/updated, or the same list when nothing new. */
export function learnDoctor(learned: Doctor[], name: string, crm: string): Doctor[] {
  const nm = name.trim(), c = crm.trim(); if (!nm || !c) return learned;
  const known = findDoctor(mergeDoctors(learned), nm); if (known?.crm && norm(known.crm) === norm(c)) return learned;
  return [...learned.filter((d) => norm(d.name) !== norm(nm)), { ...known, name: known?.name ?? nm.toUpperCase(), crm: c }];
}
