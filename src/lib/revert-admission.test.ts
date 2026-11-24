import { describe, it, expect, beforeEach } from "vitest";
import { setState, getState, revertAdmission, transferBed } from "./hospital-store";
import type { Encounter } from "./care-flow";
const enc = { id: "e1", patientId: "p1", number: "BAA-1", status_fluxo: "ENCAMINHADO_INTERNACAO", openedAt: "", type: "Pronto socorro", specialty: "Pediatria", complaint: "x", baaClosedAt: "2026-01-01", fia: { number: "FIA-2026-000001", bed: "UTIPED-01", ward: "UTI PED" }, admission: { status: "autorizada", bed: "UTIPED-01" }, history: [] } as unknown as Encounter;
beforeEach(() => setState(() => ({ profile: "Administrador", accessAreas: null, encounters: [enc], patients: [{ id: "p1", name: "Queli", age: "37 anos", registration: { birthDate: "1989-05-18" }, bed: "UTIPED-01" } as never] })));
describe("desfazer internação", () => {
  it("cancela FIA, reabre BAA e libera leito", () => { expect(revertAdmission("e1", "engano")).toBe("UTIPED-01"); const e = getState().encounters[0]; expect(e?.fia).toBeUndefined(); expect(e?.baaClosedAt).toBeUndefined(); expect(e?.status_fluxo).toBe("EM_OBSERVACAO_REAVALIACAO"); expect(getState().patients[0]?.bed).toBe(""); });
  it("permite cancelamento por operador com acesso ao NIR", () => { setState(() => ({ profile: "Enfermeiro", accessAreas: ["nir"] })); expect(revertAdmission("e1", "leito incorreto")).toBe("UTIPED-01"); });
  it("exige justificativa", () => expect(() => revertAdmission("e1", " ")).toThrow("justificativa"));
  it("bloqueia perfil sem acesso ao NIR ou administração", () => { setState(() => ({ profile: "Recepção", accessAreas: null })); expect(() => revertAdmission("e1", "r")).toThrow("NIR"); });
});
describe("troca de leito no NIR", () => {
  it("transfere paciente para novo leito compatível e retorna leito anterior", () => {
    expect(transferBed("e1", "AC-01", "Alojamento Conjunto", "Idade incompatível com UTIPED")).toBe("UTIPED-01");
    const e = getState().encounters[0];
    expect(e?.fia?.bed).toBe("AC-01");
    expect(e?.fia?.ward).toBe("Alojamento Conjunto");
    expect(getState().patients[0]?.bed).toBe("AC-01");
  });
  it("bloqueia troca para leito pediátrico quando paciente é adulto", () => {
    expect(() => transferBed("e1", "UTIPED-02", "UTI PED", "troca")).toThrow("14 anos");
  });
  it("exige motivo para troca de leito", () => {
    expect(() => transferBed("e1", "AC-01", "Alojamento Conjunto", " ")).toThrow("motivo");
  });
});
