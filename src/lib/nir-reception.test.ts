import { beforeEach, describe, expect, it } from "vitest";
import { canAccessPage, canAct, type Patient } from "./hospital-data";
import { authorizeAdmission, getState, openEncounter, requestAdmission, setState } from "./hospital-store";

const patient: Patient = {
  id: "rec-nir-1", prontuario: "PR-1", name: "Paciente Recepção NIR", cpf: "", type: "pediatria",
  age: "4 anos", weight: 16, allergies: [], risks: [], ward: "PSP", bed: "", insurance: "SUS",
  authorized: true, diagnosis: "", admission: "", days: 1, evolutions: [], vitals: [], prescriptions: [],
};

describe("Recepção no NIR e encaminhamento de internação", () => {
  beforeEach(() => {
    setState(() => ({ profile: "Recepção", employeeName: "Recepcionista Teste", accessAreas: null, patients: [], encounters: [], queue: [], surgeries: [], beSequence: 0, fiaSequence: 0 }));
  });

  it("permite que a Recepção acesse o NIR mas não regule leitos", () => {
    expect(canAccessPage("Recepção", "/nir")).toBe(true);
    expect(canAccessPage("Outro", "/nir", ["recepcao"])).toBe(true);
    expect(canAct("Recepção", "nir")).toBe(false);
  });

  it("permite encaminhamento de internação pela Recepção e bloqueia escolha de leito", () => {
    const enc = openEncounter(patient, "Pronto socorro", "Pediatria", "Febre persistente");
    requestAdmission(enc.id, { ward: "ENFP", character: "Urgência", cid: "", justification: "Encaminhamento de internação pela recepção", isolation: false, oxygen: false, source: "recepcao" });
    const updated = getState().encounters[0];
    expect(updated?.admission?.status).toBe("pendente");
    expect(updated?.admission?.requestedBy).toBe("Recepcionista Teste");
    expect(() => authorizeAdmission(enc.id, "ENFP-01")).toThrow();
  });
});