import { describe, expect, it } from "vitest";
import { hotelariaBedAvailable, hotelariaOccupancy, hotelariaOccupancyRate, hotelariaSnapshotSchema, isHotelariaFresh, sortHotelaria } from "./hotelaria-beds";

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
import { normalizeHotelaria as norm2, hotelariaSnapshotSchema as schema2 } from "./hotelaria-beds";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("hotelaria camelCase payload", () => {
  i2("accepts atualizadoEm and sigla from Hotelaria", () => {
    const s = schema2.parse(norm2({ generatedAt: "2026-11-17T12:04:51.979Z", setores: [{ id: "m", nome: "Maternidade", sigla: "MAT", ordem: 1, leitos: [{ id: "b", codigo: "300.1", status: "disponivel", ordem: 1, atualizadoEm: "2026-11-16T18:27:50.632+00:00" }] }] }));
    e2(s.setores[0]!.leitos[0]!.atualizado_em).toBe("2026-11-16T18:27:50.632+00:00");
  });
});

describe("Hotelaria occupation counts", () => {
  const bed = (id: string, status: string) => ({ id, codigo: id, ordem: 1, status, atualizado_em: "2026-11-17T11:23:00Z" });
  const snap = hotelariaSnapshotSchema.parse({
    generatedAt: "2026-11-17T11:23:00Z",
    setores: [
      { id: "mat", nome: "Maternidade", ordem: 1, leitos: [bed("b1", "ocupado"), bed("b2", "ocupado"), bed("b3", "disponivel"), bed("b4", "aguardando_higienizacao")] },
      { id: "utn", nome: "UTI Neonatal", ordem: 2, leitos: [bed("b5", "higienizacao"), bed("b6", "bloqueado")] },
    ],
  });
  it("counts beds the hospital marked occupied in Hotelaria", () => {
    expect(hotelariaOccupancy(snap)).toEqual({ total: 6, ocupado: 2, disponivel: 1, higienizacao: 2, bloqueado: 1 });
  });
  it("rounds the occupancy rate from occupied beds only", () => {
    expect(hotelariaOccupancyRate(hotelariaOccupancy(snap))).toBe(33);
    expect(hotelariaOccupancyRate({ total: 0, ocupado: 0, disponivel: 0, higienizacao: 0, bloqueado: 0 })).toBe(0);
  });
});
