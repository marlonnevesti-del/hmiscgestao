import type { Prescription } from "./hospital-data";

export const PHARMACY_START_HOUR = 16;

export const ADMIN_ROUTES = [
  "VO",
  "EV",
  "IM",
  "SC",
  "Inalatória",
  "Tópica",
  "SNG/SNE",
  "Retal",
  "Ocular",
  "Otológica",
] as const;
export type AdminRoute = (typeof ADMIN_ROUTES)[number];

export const POSOLOGY_OPTIONS = [
  "Agora",
  "2x2",
  "4x4",
  "6x6",
  "8x8",
  "12x12",
  "24x24",
] as const;
export type PosologyOption = (typeof POSOLOGY_OPTIONS)[number];

const INTERVAL_HOURS: Record<Exclude<PosologyOption, "Agora">, number> = {
  "2x2": 2,
  "4x4": 4,
  "6x6": 6,
  "8x8": 8,
  "12x12": 12,
  "24x24": 24,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatPosologia(route: string, frequency: string, immediate?: boolean): string {
  const r = route.trim();
  const f = frequency.trim();
  const base = [r, f].filter(Boolean).join(" · ");
  if (immediate && f !== "Agora") return `${base} (Dose imediata)`;
  return base || "—";
}

/**
 * Gera os horários de administração conforme a posologia escolhida.
 * - "Agora": 1 dose no horário atual.
 * - Demais com dose imediata: 1ª dose agora e as restantes a cada intervalo.
 * - Rotina sem dose imediata: inicia às 16:00 (horário padrão da farmácia).
 */
export function buildScheduleTimes(
  frequency: PosologyOption,
  immediate: boolean,
  now: Date = new Date(),
): string[] {
  if (frequency === "Agora") {
    return [`${pad2(now.getHours())}:${pad2(now.getMinutes())}`];
  }
  const step = INTERVAL_HOURS[frequency];
  const count = Math.max(1, Math.round(24 / step));
  const startHour = immediate ? now.getHours() : PHARMACY_START_HOUR;
  const minute = immediate ? now.getMinutes() : 0;
  return Array.from({ length: count }, (_, i) => {
    const h = (startHour + i * step) % 24;
    return `${pad2(h)}:${pad2(minute)}`;
  });
}

export function isImmediatePrescription(rx: Pick<Prescription, "immediate" | "frequency">): boolean {
  return Boolean(rx.immediate || rx.frequency === "Agora");
}

/** Horários ainda retidos na farmácia para entrega futura. */
export function remainingDoses(rx: Pick<Prescription, "times" | "dispensedTimes" | "pharmacy">): string[] {
  const times = rx.times ?? [];
  if (!times.length) return [];
  if (rx.pharmacy === "Em falta") return [];
  if (rx.pharmacy === "Dispensada" && !rx.dispensedTimes) return [];
  const done = new Set(rx.dispensedTimes ?? []);
  return times.filter((t) => !done.has(t));
}

/** Verifica se a farmácia pode liberar medicamentos no horário informado. */
export function canDispenseNow(
  prescriptions: Pick<Prescription, "immediate" | "frequency">[],
  opts?: { now?: Date; specialCaseReason?: string },
): { ok: boolean; isBeforeStart: boolean; hasImmediate: boolean; reason?: string } {
  const now = opts?.now ?? new Date();
  const isBeforeStart = now.getHours() < PHARMACY_START_HOUR;
  const hasImmediate = prescriptions.some((rx) => isImmediatePrescription(rx));
  return { ok: true, isBeforeStart, hasImmediate };
}