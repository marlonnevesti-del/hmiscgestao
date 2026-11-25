import { describe, expect, it } from "vitest";
import { addEncounterProcedures, getState, openEncounter, setState } from "./hospital-store";
import { buildSusRows } from "./sus-billing";
import type { Patient } from "./hospital-data";

const PROF = { name: "Enf. Teste", cns: "123456789012345", cbo: "223505" };

describe("procedimentos adicionais com SIGTAP", () => {
  it("registra múltiplos procedimentos (pressão e temperatura) sem sobrescrever o SIGTAP principal e gera linhas no BPA", () => {
    setState(() => ({ profile: "Administrador", employeeName: "Enf. Teste", accessAreas: null, patients: [], encounters: [], queue: [], surgeries: [], beSequence: 0 }));
    const p = { id: "p-proc-1", name: "Paciente Proc Extra", age: "28a", type: "maternidade", risk: "verde", bed: "", weight: 65, allergies: [], risks: [], vitals: [], prescriptions: [], evolutions: [], exams: [] } as unknown as Patient;
    const enc = openEncounter(p, "Pronto socorro", "Clínica Médica", "Febre");

    addEncounterProcedures(enc.id, [
      { name: "AFERIÇÃO DE TEMPERATURA", code: "03.01.10.025-0", sector: "Acolhimento / Triagem" },
      { name: "AFERIÇÃO DE PRESSÃO ARTERIAL", code: "03.01.10.003-9", sector: "Acolhimento / Triagem" },
      { name: "AFERIÇÃO DE TEMPERATURA", code: "0301100250", sector: "Acolhimento / Triagem" },
    ]);

    const updated = getState().encounters.find((e) => e.id === enc.id);
    expect(updated?.extraProcedures).toHaveLength(2);
    expect(updated?.extraProcedures?.map((x) => x.code)).toEqual(["0301100250", "0301100039"]);

    const comp = enc.openedAt.slice(0, 7).replace("-", "");
    const rows = buildSusRows(updated ? [updated] : [], getState().patients, comp, PROF);
    const extraRows = rows.filter((r) => r.origin === "procedure");
    expect(extraRows.map((r) => r.procedure)).toEqual(["0301100250", "0301100039"]);
    expect(extraRows.every((r) => r.kind === "BPA")).toBe(true);
  });

  it("registra evolução clínica no prontuário ao salvar com descrição técnica e materiais", () => {
    setState(() => ({ profile: "Administrador", employeeName: "Enf. Teste", accessAreas: null, patients: [], encounters: [], queue: [], surgeries: [], beSequence: 0 }));
    const p = { id: "p-proc-2", name: "Paciente Evolução Proc", age: "32a", type: "maternidade", risk: "verde", bed: "", weight: 68, allergies: [], risks: [], vitals: [], prescriptions: [], evolutions: [], exams: [] } as unknown as Patient;
    const enc = openEncounter(p, "Pronto socorro", "Clínica Médica", "Ferimento");

    addEncounterProcedures(
      enc.id,
      [{ name: "SUTURA SIMPLES", code: "04.01.01.005-8", sector: "Consultório médico" }],
      { professional: "Dr. Carlos", register: "CRM-SC 12345", sector: "Consultório médico", description: "Sutura com 3 pontos simples", materials: "Fio nylon 4-0, lidocaína 2%" },
    );

    const savedPatient = getState().patients.find((x) => x.id === p.id);
    expect(savedPatient?.evolutions).toHaveLength(1);
    expect(savedPatient?.evolutions[0]?.cat).toBe("Procedimento");
    expect(savedPatient?.evolutions[0]?.author).toBe("Dr. Carlos · CRM-SC 12345");
    expect(savedPatient?.evolutions[0]?.text).toContain("SUTURA SIMPLES (04.01.01.005-8)");
    expect(savedPatient?.evolutions[0]?.text).toContain("Sutura com 3 pontos simples");
    expect(savedPatient?.evolutions[0]?.text).toContain("Fio nylon 4-0, lidocaína 2%");
  });
});