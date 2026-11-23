import { describe, expect, it } from "vitest";
import { abcCurve, allocateCosts, groupOf, PERDAS } from "./cost-centers";

const mv = (o: object) => ({ id: "1", kind: "consumo", from: "Farmácia", to: "x", item: "Dipirona", qty: 2, lot: "", reason: "", at: "2026-11-10T10:00:00", by: "a", ...o });
const items = [{ name: "Dipirona", unitCost: 5 }] as never;
describe("centro de custos", () => {
  it("dispensação vai para o setor do leito do paciente", () => {
    const e = allocateCosts("202611", { movements: [mv({ patientId: "p1" })] as never, items, patients: [{ id: "p1", ward: "UTIN", days: 0 }] as never, surgeries: [] });
    expect(e[0]).toMatchObject({ center: "UTI Neo", group: "Assistencial", total: 10 });
  });
  it("requisição usa o setor solicitante e vencimento vai para perdas", () => {
    const e = allocateCosts("202611", { movements: [mv({ kind: "requisicao", costCenter: "Cozinha" }), mv({ kind: "vencimento" })] as never, items, patients: [], surgeries: [] });
    expect(e.map((x) => x.center)).toEqual(["Cozinha", PERDAS]);
    expect(groupOf("Cozinha")).toBe("Apoio operacional");
  });
  it("curva ABC classifica A até 80% acumulado", () => {
    const r = abcCurve([{ item: "X", total: 80, qty: 1 }, { item: "Y", total: 15, qty: 1 }, { item: "Z", total: 5, qty: 1 }] as never);
    expect(r.map((x) => x.cls)).toEqual(["A", "B", "C"]);
  });
});
