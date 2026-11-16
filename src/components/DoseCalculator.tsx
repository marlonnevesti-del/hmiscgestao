import { computeDose, type DoseResult } from "@/lib/dose-calc";
import type { Drug } from "@/lib/hospital-data";

export interface CalcState { regimen: number; presentation: number; mgKgDay: string; doses: string; perDose: string; mgPerMl: string }
export const initCalc = (d: Drug): CalcState => { const r = d.regimens?.[0]; return { regimen: 0, presentation: 0, mgKgDay: String(r?.mgKgDay ?? d.mgKgDay), doses: String(r?.doses ?? d.doses), perDose: "", mgPerMl: String(d.presentations?.[0]?.mgPerMl ?? "") }; };
const num = (v: string) => parseFloat(v.replace(",", ".")) || 0;

export function calcResult(d: Drug, c: CalcState, weight: number): DoseResult {
  const r = d.regimens?.[c.regimen]; const pres = d.presentations?.[c.presentation];
  const conc = num(c.mgPerMl);
  return computeDose({ weightKg: weight, mgKgDay: num(c.mgKgDay), doses: num(c.doses) || 1, maxDay: r?.maxDay ?? d.maxDay, mgPerMl: conc || undefined, dropsPerMl: pres && conc === pres.mgPerMl ? pres.dropsPerMl : undefined, perDoseOverride: c.perDose ? num(c.perDose) : undefined });
}

const box = "h-8 w-full rounded-md border bg-background px-2 text-xs";
export function DoseCalculator({ drug, weight, value, onChange }: { drug: Drug; weight: number; value: CalcState; onChange: (c: CalcState) => void }) {
  const res = calcResult(drug, value, weight); const set = (p: Partial<CalcState>) => onChange({ ...value, ...p });
  return <div className="space-y-2 rounded-md bg-clinical-soft p-3">
    <div className="text-[11px] text-muted-foreground">Calculadora · peso da triagem <b className="text-foreground">{weight} kg</b></div>
    {drug.regimens && <label className="grid gap-1 text-[11px]">Regime de dose<select aria-label="Regime de dose" className={box} value={value.regimen} onChange={(e) => { const i = Number(e.target.value); const r = drug.regimens![i]!; set({ regimen: i, mgKgDay: String(r.mgKgDay), doses: String(r.doses), perDose: "" }); }}>{drug.regimens.map((r, i) => <option key={r.label} value={i}>{r.label} · {r.mgKgDay} mg/kg/dia</option>)}</select></label>}
    {drug.presentations && <label className="grid gap-1 text-[11px]">Apresentação<select aria-label="Apresentação" className={box} value={value.presentation} onChange={(e) => { const i = Number(e.target.value); set({ presentation: i, mgPerMl: String(drug.presentations![i]!.mgPerMl) }); }}>{drug.presentations.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}</select></label>}
    <div className="grid grid-cols-2 gap-2">
      <label className="grid gap-1 text-[11px]">mg/kg/dia<input aria-label="mg/kg/dia" className={box} value={value.mgKgDay} onChange={(e) => set({ mgKgDay: e.target.value, perDose: "" })} /></label>
      <label className="grid gap-1 text-[11px]">Tomadas/dia<input aria-label="Tomadas por dia" className={box} value={value.doses} onChange={(e) => set({ doses: e.target.value })} /></label>
      <label className="grid gap-1 text-[11px]">Dose manual (mg)<input aria-label="Dose manual em mg" placeholder="automática" className={box} value={value.perDose} onChange={(e) => set({ perDose: e.target.value })} /></label>
      <label className="grid gap-1 text-[11px]">Concentração (mg/mL)<input aria-label="Concentração em mg por mL" className={box} value={value.mgPerMl} onChange={(e) => set({ mgPerMl: e.target.value })} /></label>
    </div>
    <div className="flex items-baseline justify-between"><span className="font-mono text-2xl font-semibold text-clinical">{res.perDose} mg</span><span className="font-mono text-xs">{res.day} mg/dia</span></div>
    {(res.drops != null || res.ml != null) && <div className="font-mono text-sm font-semibold">{res.drops != null ? `${res.drops} gotas (${String(res.ml).replace(".", ",")} mL)` : `${String(res.ml).replace(".", ",")} mL`} por dose</div>}
    {res.capped && <div className="text-[11px] text-maternal">Limitada à dose máxima diária</div>}
    {res.manual && <div className="text-[11px] text-maternal">Dose ajustada manualmente pelo médico</div>}
  </div>;
}
