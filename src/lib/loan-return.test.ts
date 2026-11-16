import { beforeEach, describe, expect, it } from "vitest";
import { getState, registerLoan, setState, settleLoan } from "./hospital-store";
import { loanReturnedQty, type Depot } from "./supply-flow";

const product = { id: "a", code: "6495", name: "AGULHA", presentation: "", unit: "UN", quantity: 20, minimum: 0, lots: [{ lot: "L1", expiry: "2027-01-01", quantity: 20 }] };
beforeEach(() => setState(() => ({ profile: "Administrador", employeeName: "Teste", stock: [product], warehouse: [product], movements: [] })));
function loan(depot: Depot, direction: "entrada" | "saida") {
  registerLoan(depot, direction, "Instituição", "2026-12-01", [{ id: "a", lot: "L1", expiry: "2027-01-01", qty: 10 }]);
  const m = getState().movements[0];
  if (!m) throw new Error("Empréstimo não criado");
  return m.id;
}
describe.each(["farmacia", "almoxarifado"] as const)("devolução parcial: %s", (depot) => {
  const stock = () => depot === "farmacia" ? getState().stock : getState().warehouse;
  it("recebe apenas 3 de 10, deixando 7 pendentes", () => {
    const id = loan(depot, "saida"); settleLoan(depot, id, 3);
    expect(stock()[0]?.quantity).toBe(13);
    expect(stock()[0]?.lots?.[0]?.quantity).toBe(13);
    expect(getState().movements[0]).toMatchObject({ qty: 10, returnedQty: 3, returns: [{ qty: 3, by: "Teste" }] });
    expect(getState().movements[0]?.settledAt).toBeUndefined();
  });
  it("baixa apenas 3 ao devolver produto recebido emprestado", () => {
    const id = loan(depot, "entrada"); settleLoan(depot, id, 3);
    expect(stock()[0]?.quantity).toBe(27);
    expect(stock()[0]?.lots?.[0]?.quantity).toBe(27);
    expect(getState().movements[0]?.returnedQty).toBe(3);
  });
  it("encerra somente quando as devoluções somam 10 e impede repetição", () => {
    const id = loan(depot, "saida"); settleLoan(depot, id, 3); settleLoan(depot, id, 7);
    expect(stock()[0]?.quantity).toBe(20);
    expect(getState().movements[0]?.returnedQty).toBe(10);
    expect(getState().movements[0]?.settledAt).toBeTruthy();
    expect(getState().movements[0]?.returns?.map((r) => r.qty)).toEqual([3, 7]);
    expect(() => settleLoan(depot, id, 1)).toThrow("já devolvido");
  });
  it("rejeita quantidade maior que pendente sem alterar estoque", () => {
    const id = loan(depot, "saida"); settleLoan(depot, id, 3);
    const before = getState();
    expect(() => settleLoan(depot, id, 8)).toThrow("saldo pendente (7)");
    expect(getState()).toBe(before);
  });
  it.each([0, -1, 1.5, NaN])("rejeita quantidade inválida %s", (qty) => {
    const id = loan(depot, "saida"); const before = getState();
    expect(() => settleLoan(depot, id, qty)).toThrow("inteira maior que zero");
    expect(getState()).toBe(before);
  });
});
it("mantém empréstimos antigos encerrados como totalmente devolvidos", () => {
  loan("farmacia", "saida"); const m = getState().movements[0];
  if (!m) throw new Error("Empréstimo não criado");
  expect(loanReturnedQty({ ...m, settledAt: "2026-11-16" })).toBe(10);
});
it("impede devolver empréstimo em outro estoque", () => {
  const id = loan("farmacia", "saida");
  expect(() => settleLoan("almoxarifado", id, 3)).toThrow("não pertence");
});