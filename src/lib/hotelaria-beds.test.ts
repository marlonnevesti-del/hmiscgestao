import { describe, expect, it } from "vitest";
import { hotelariaBedAvailable, hotelariaSnapshotSchema, isHotelariaFresh, sortHotelaria } from "./hotelaria-beds";

describe("Hotelaria bed integration", () => {
  it("shows an occupied bed as unavailable", () => { expect(hotelariaBedAvailable("ocupado")).toBe(false); expect(hotelariaBedAvailable("disponivel")).toBe(true); });
  it("does not release beds still in the cleaning workflow", () => {
    for (const status of ["aguardando_higienizacao", "higienizacao", "higienizacao_concluida", "bloqueado"] as const) expect(hotelariaBedAvailable(status)).toBe(false);
  });
  it("rejects stale or future snapshots", () => { const now = Date.parse("2026-11-17T11:23:00Z"); expect(isHotelariaFresh("2026-11-17T11:22:44Z", now)).toBe(false); expect(isHotelariaFresh("2026-11-17T11:23:10Z", now)).toBe(false); expect(isHotelariaFresh("2026-11-17T11:22:55Z", now)).toBe(true); });
  it("keeps exact bed codes and source sector order", () => {
    const snapshot = hotelariaSnapshotSchema.parse({ generatedAt: "2026-11-17T11:23:00Z", setores: [{ id: "mat", nome: "Maternidade", ordem: 2, leitos: [{ id: "bed1", codigo: "306A", ordem: 1, status: "ocupado", atualizado_em: "2026-11-17T11:22:00Z" }] }, { id: "ped", nome: "Pediatria", ordem: 1, leitos: [] }] });
    const sorted = sortHotelaria(snapshot); expect(sorted.setores.map((s) => s.nome)).toEqual(["Pediatria", "Maternidade"]); expect(sorted.setores[1]?.leitos[0]?.codigo).toBe("306A"); expect(sorted.setores[1]?.leitos[0]?.status).toBe("ocupado");
  });
  it("rejects unknown statuses and duplicated bed identities", () => {
    const b = { id: "b", codigo: "306A", ordem: 1, status: "livre", atualizado_em: "2026-11-17T11:23:00Z" };
    const data = { generatedAt: "2026-11-17T11:23:00Z", setores: [{ id: "mat", nome: "Maternidade", ordem: 1, leitos: [b] }] };
    expect(hotelariaSnapshotSchema.safeParse(data).success).toBe(false);
    expect(hotelariaSnapshotSchema.safeParse({ ...data, setores: [{ ...data.setores[0], leitos: [{ ...b, status: "ocupado" }, { ...b, status: "disponivel" }] }] }).success).toBe(false);
  });
});