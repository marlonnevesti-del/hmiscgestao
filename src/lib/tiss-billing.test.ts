import { describe, expect, it } from "vitest";
import { isEligibleForTiss } from "./hospital-data";

describe("isEligibleForTiss", () => {
  it("exclui pacientes apenas agendados no ambulatório sem atendimento", () => {
    expect(isEligibleForTiss({ id: "p-agendado", bed: "", days: 0 }, [], [], {})).toBe(false);
  });

  it("exclui pacientes que apenas abriram ficha e ainda aguardam atendimento médico", () => {
    expect(
      isEligibleForTiss(
        { id: "p-espera", bed: "", days: 0 },
        [{ patientId: "p-espera", status_fluxo: "AGUARDANDO_MEDICO" }],
        [],
        {},
      ),
    ).toBe(false);
  });

  it("inclui paciente do ambulatório depois que foi atendido", () => {
    expect(
      isEligibleForTiss(
        { id: "p-atendido", bed: "", days: 0 },
        [{ patientId: "p-atendido", status_fluxo: "ALTA_HOSPITALAR", medical: { cid: "Z00" } }],
        [],
        {},
      ),
    ).toBe(true);
  });

  it("inclui paciente internado em leito ou com diárias, cirurgia ou medicação checada", () => {
    expect(isEligibleForTiss({ id: "p-leito", bed: "AC-01", days: 0 }, [], [], {})).toBe(true);
    expect(isEligibleForTiss({ id: "p-diaria", bed: "", days: 2 }, [], [], {})).toBe(true);
    expect(isEligibleForTiss({ id: "p-cirurgia", bed: "", days: 0 }, [], [{ patientId: "p-cirurgia" }], {})).toBe(true);
    expect(
      isEligibleForTiss(
        { id: "p-med", bed: "", days: 0 },
        [],
        [],
        { "p-med|rx1|08:00": { status: "checado", by: "Enf", at: "08:00" } },
      ),
    ).toBe(true);
  });
});