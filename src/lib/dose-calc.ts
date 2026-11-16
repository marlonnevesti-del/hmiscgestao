/** Regime de dose (mg/kg/dia ÷ tomadas, com teto diário) e apresentação para converter mg em mL/gotas. */
export interface Regimen { label: string; mgKgDay: number; doses: number; maxDay: number }
export interface Presentation { label: string; mgPerMl: number; dropsPerMl?: number }
export interface DoseInput { weightKg: number; mgKgDay: number; doses: number; maxDay: number; mgPerMl?: number | undefined; dropsPerMl?: number | undefined; perDoseOverride?: number | undefined }
export interface DoseResult { day: number; perDose: number; capped: boolean; ml?: number | undefined; drops?: number | undefined; manual: boolean }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeDose(i: DoseInput): DoseResult {
  const raw = i.mgKgDay * i.weightKg;
  const capped = i.maxDay > 0 && raw > i.maxDay;
  const autoDay = r2(capped ? i.maxDay : raw);
  const doses = Math.max(1, Math.round(i.doses));
  const manual = i.perDoseOverride != null && i.perDoseOverride > 0;
  const perDose = manual ? r2(i.perDoseOverride!) : r2(autoDay / doses);
  const day = manual ? r2(perDose * doses) : autoDay;
  const ml = i.mgPerMl && i.mgPerMl > 0 ? r2(perDose / i.mgPerMl) : undefined;
  const drops = ml != null && i.dropsPerMl ? Math.round(ml * i.dropsPerMl) : undefined;
  return { day, perDose, capped: !manual && capped, ml, drops, manual };
}

export function doseText(name: string, d: DoseResult, mgKgDay: number, pres?: Presentation) {
  const vol = d.drops != null ? ` = ${d.drops} gotas` : d.ml != null ? ` = ${String(d.ml).replace(".", ",")} mL` : "";
  const ref = d.manual ? "dose ajustada manualmente" : `${mgKgDay} mg/kg/dia`;
  return `${name} ${d.perDose} mg${vol}${pres ? ` (${pres.label})` : ""} · ${ref}`;
}
