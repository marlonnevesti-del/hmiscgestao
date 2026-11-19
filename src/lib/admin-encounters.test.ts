import { describe, it, expect, beforeEach } from "vitest";
import { setState, getState, correctEncounter } from "./hospital-store";
import type { Encounter } from "./care-flow";
const enc = { id: "e1", patientId: "p1", number: "BAA-1", status_fluxo: "AGUARDANDO_MEDICO", openedAt: "", type: "Maternidade", specialty: "Obstetrícia", complaint: "dor", history: [] } as unknown as Encounter;
beforeEach(() => setState(() => ({ profile: "Administrador", encounters: [enc], patients: [{ id: "p1" } as never] })));
describe("correção de atendimento pelo administrador", () => {
  it("move para o ambulatório com pré-consulta", () => { correctEncounter("e1", { type: "Ambulatório", specialty: "Gestação de Alto Risco", complaint: "pré-natal", nursingPreConsult: true }, "unidade errada"); expect(getState().encounters[0]).toMatchObject({ type: "Ambulatório", nursingPreConsult: true }); });
  it("exige justificativa", () => expect(() => correctEncounter("e1", { type: "Maternidade", specialty: "x", complaint: "y", nursingPreConsult: false }, "")).toThrow("justificativa"));
  it("bloqueia não administrador", () => { setState(() => ({ profile: "Recepção" })); expect(() => correctEncounter("e1", { type: "Maternidade", specialty: "x", complaint: "y", nursingPreConsult: false }, "r")).toThrow("administradores"); });
});
