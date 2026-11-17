import { z } from "zod";

export const HOTELARIA_POLL_MS = 5000;
export const HOTELARIA_STALE_MS = 15000;
export const hotelariaStatusSchema = z.enum(["ocupado", "aguardando_higienizacao", "higienizacao", "higienizacao_concluida", "disponivel", "bloqueado"]);
export type HotelariaStatus = z.infer<typeof hotelariaStatusSchema>;
export const HOTELARIA_LABELS: Record<HotelariaStatus, string> = {
  ocupado: "Ocupado", aguardando_higienizacao: "Alta/aguardando higienização",
  higienizacao: "Em higienização", higienizacao_concluida: "Higienização concluída",
  disponivel: "Leito disponível", bloqueado: "Bloqueado",
};
export const hotelariaSnapshotSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  setores: z.array(z.object({
    id: z.string().min(1).max(100), nome: z.string().min(1).max(120), ordem: z.number().int(),
    leitos: z.array(z.object({
      id: z.string().min(1).max(100), codigo: z.string().min(1).max(100), ordem: z.number().int(),
      status: hotelariaStatusSchema, atualizado_em: z.string().datetime({ offset: true }),
      higienizacao_iniciada_em: z.string().datetime({ offset: true }).nullable().optional(),
    })).max(1000),
  })).max(100),
}).superRefine((snapshot, ctx) => {
  const sectors = snapshot.setores.map((s) => s.id);
  const beds = snapshot.setores.flatMap((s) => s.leitos.map((b) => b.id));
  if (new Set(sectors).size !== sectors.length || new Set(beds).size !== beds.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Identificadores duplicados" });
});
export type HotelariaSnapshot = z.infer<typeof hotelariaSnapshotSchema>;
export type HotelariaResult = {
  status: "not_configured" | "unavailable" | "connected";
  snapshot: HotelariaSnapshot | null; checkedAt: string; message: string;
};
export function isHotelariaFresh(generatedAt: string, now = Date.now()) {
  const age = now - Date.parse(generatedAt);
  return Number.isFinite(age) && age >= -5000 && age <= HOTELARIA_STALE_MS;
}
// Cleaning completed is intentionally not the same as a released bed.
export function hotelariaBedAvailable(status: HotelariaStatus) { return status === "disponivel"; }
export function sortHotelaria(snapshot: HotelariaSnapshot): HotelariaSnapshot {
  return { ...snapshot, setores: [...snapshot.setores].sort((a, b) => a.ordem - b.ordem).map((s) => ({ ...s, leitos: [...s.leitos].sort((a, b) => a.ordem - b.ordem) })) };
}
// Hotelaria sends camelCase "atualizadoEm"; accept both shapes.
export function normalizeHotelaria(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as { setores?: unknown };
  if (!Array.isArray(r.setores)) return raw;
  return { ...r, setores: r.setores.map((s: Record<string, unknown>) => ({ ...s, leitos: Array.isArray(s["leitos"]) ? (s["leitos"] as Record<string, unknown>[]).map((l) => ({ ...l, atualizado_em: l["atualizado_em"] ?? l["atualizadoEm"] })) : s["leitos"] })) };
}
