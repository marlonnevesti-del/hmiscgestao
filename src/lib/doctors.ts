import catalog from "./doctors-catalog.json";

export interface Doctor { code?: string | undefined; name: string; crm?: string | undefined; specialty?: string | undefined; rqe?: string | undefined }
export const DOCTOR_CATALOG = catalog as Doctor[];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ");

/** Catalog merged with learned doctors (learned entries override/complete the CRM). */
export function mergeDoctors(learned: Doctor[]): Doctor[] {
  const map = new Map(DOCTOR_CATALOG.map((d) => [norm(d.name), d]));
  for (const d of learned) { const k = norm(d.name); const cur = map.get(k); map.set(k, { ...cur, ...d, crm: d.crm || cur?.crm }); }
  return [...map.values()];
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
