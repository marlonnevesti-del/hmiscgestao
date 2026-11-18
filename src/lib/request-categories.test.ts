import { describe, expect, it } from "vitest";
import { allowedRequestCategories } from "./warehouse-categories";
describe("categorias liberadas para solicitação", () => {
  it("recepção não pede material hospitalar nem medicamento por padrão", () => {
    expect(allowedRequestCategories("Recepção", null)).toEqual(["escritorio", "higiene"]);
  });
  it("enfermagem pede material hospitalar", () => expect(allowedRequestCategories("Enfermeiro", null)).toContain("hospitalar"));
  it("liberação do administrador vale para a recepção", () => {
    expect(allowedRequestCategories("Recepção", ["recepcao", "pedido:hospitalar", "pedido:escritorio"])).toEqual(["hospitalar", "escritorio"]);
  });
});
