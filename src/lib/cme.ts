/** CME – Central de Material e Esterilização: caixas, ciclos de autoclave e rastreabilidade (RDC 15). */
export type KitStatus = "Sujo" | "Preparo" | "Esterilizando" | "Pronto" | "Em uso" | "Bloqueado";
export const KIT_STATUS: KitStatus[] = ["Sujo", "Preparo", "Esterilizando", "Pronto", "Em uso", "Bloqueado"];
export interface CmeKit { id: string; code: string; name: string; items: string; validityDays: number; status: KitStatus; location: string; cycleId?: string | undefined; sterilizedAt?: string | undefined; expiresAt?: string | undefined; patientId?: string | undefined; history: { at: string; by: string; note: string }[] }
export type BioResult = "Pendente" | "Aprovado" | "Reprovado";
export interface CmeCycle { id: string; number: string; autoclave: string; load: string; temperature: number; minutes: number; chemical: "Aprovado" | "Reprovado"; bio: BioResult; kitIds: string[]; by: string; at: string }
export const AUTOCLAVES = ["Autoclave 01", "Autoclave 02"];
export const DEFAULT_KITS: CmeKit[] = [
  ["CX-CES-01", "Caixa de Cesárea 01"], ["CX-CES-02", "Caixa de Cesárea 02"], ["CX-PAR-01", "Caixa de Parto Normal 01"],
  ["CX-CUR-01", "Caixa de Curetagem 01"], ["KT-SUT-01", "Kit de Sutura PS 01"], ["KT-CUR-01", "Kit de Curativo 01"],
].map(([code, name]) => ({ id: code!, code: code!, name: name!, items: "", validityDays: 30, status: "Sujo" as KitStatus, location: "Expurgo CME", history: [] }));

const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
export const kitBarcode = (kit: CmeKit, cycle: CmeCycle) => `CME-${cycle.number.replace(/\D/g, "")}-${kit.code.replace(/[^A-Z0-9]/gi, "")}`.toUpperCase();
export const cycleNumber = (seq: number, at: string) => `${String(seq).padStart(4, "0")}/${at.slice(0, 4)}`;
const log = (k: CmeKit, at: string, by: string, note: string, patch: Partial<CmeKit>): CmeKit => ({ ...k, ...patch, history: [...k.history, { at, by, note }] });

export function startCycle(kits: CmeKit[], cycles: CmeCycle[], input: { autoclave: string; load: string; temperature: number; minutes: number; chemical: "Aprovado" | "Reprovado"; kitIds: string[] }, by: string, at: string) {
  if (!input.kitIds.length) throw new Error("Selecione ao menos uma caixa.");
  const bad = kits.filter((k) => input.kitIds.includes(k.id) && k.status !== "Preparo" && k.status !== "Sujo");
  if (bad.length) throw new Error(`Caixa não está no preparo: ${bad[0]!.name}`);
  const cycle: CmeCycle = { id: crypto.randomUUID(), number: cycleNumber(cycles.length + 1, at), ...input, bio: "Pendente", by, at };
  const ok = input.chemical === "Aprovado";
  return { cycle, kits: kits.map((k) => input.kitIds.includes(k.id) ? log(k, at, by, `Ciclo ${cycle.number} · ${input.autoclave}${ok ? "" : " · indicador químico REPROVADO"}`, ok ? { status: "Pronto", location: "Arsenal CME", cycleId: cycle.id, sterilizedAt: at, expiresAt: addDays(at, k.validityDays) } : { status: "Bloqueado", cycleId: cycle.id }) : k) };
}

/** Biológico reprovado bloqueia todas as caixas do ciclo ainda não usadas. */
export function setBio(kits: CmeKit[], cycle: CmeCycle, bio: BioResult, by: string, at: string) {
  return kits.map((k) => k.cycleId === cycle.id && bio === "Reprovado" && k.status === "Pronto" ? log(k, at, by, `Biológico reprovado no ciclo ${cycle.number}`, { status: "Bloqueado" }) : k);
}

export function checkKitUse(kit: CmeKit | undefined, cycle: CmeCycle | undefined, now: string): string | null {
  if (!kit) return "Código não encontrado no CME.";
  if (kit.status !== "Pronto") return `Caixa ${kit.name} está "${kit.status}".`;
  if (kit.expiresAt && kit.expiresAt < now) return `Caixa ${kit.name} VENCIDA.`;
  if (!cycle || cycle.bio === "Reprovado" || cycle.chemical === "Reprovado") return `Ciclo da caixa ${kit.name} não liberado.`;
  return null;
}

export function findKit(kits: CmeKit[], cycles: CmeCycle[], code: string) {
  const c = code.trim().toUpperCase();
  return kits.find((k) => k.code.toUpperCase() === c || (k.cycleId && kitBarcode(k, cycles.find((y) => y.id === k.cycleId) ?? ({ number: "" } as CmeCycle)) === c));
}
