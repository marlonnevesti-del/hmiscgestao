import { describe, expect, it } from "vitest";
import { buildTraceabilityRows, filterTraceabilityRows, summarizeTraceability } from "./pharmacy-traceability";
import type { Movement } from "./supply-flow";
import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";

const mv = (o: Partial<Movement>): Movement => ({
  id: crypto.randomUUID(),
  kind: "consumo",
  from: "Farmácia",
  to: "Paciente",
  item: "Morfina 10 mg/mL",
  qty: 1,
  lot: "L-MORF-01",
  reason: "Dispensação",
  at: "2026-11-27T14:00:00.000Z",
  by: "Farm. Ana",
  ...o,
});

const pat = (id: string, name: string): Patient => ({
  id, prontuario: `PR-${id}`, name, cpf: "", type: "pediatria", age: "5 anos", weight: 20,
  allergies: [], risks: [], ward: "UTIP", bed: "UTIP-01", insurance: "SUS",
  authorized: true, diagnosis: "", admission: "", days: 1, evolutions: [], vitals: [], prescriptions: [],
});

describe("Rastreabilidade de medicamentos na Farmácia", () => {
  it("cruza médico prescritor salvo na movimentação e fallback pelo BAA/FIA", () => {
    const encounters = [{
      id: "e1", number: "BAA-2026-000100", patientId: "p1", unit: "PS", specialty: "Pediatria",
      openedAt: "2026-11-27T10:00:00Z", openedBy: "Rec", status_fluxo: "AGUARDANDO_MEDICACAO",
      history: [], signedBy: "Dr. Carlos Silva",
    }] as unknown as Encounter[];

    const rows = buildTraceabilityRows(
      [
        mv({ id: "m1", item: "Morfina 10 mg/mL", qty: 2, patient: "Maria", patientId: "p1", baa: "BAA-2026-000100" }),
        mv({ id: "m2", item: "Morfina 10 mg/mL", qty: 1, prescriber: "Dra. Beatriz Lima", patient: "João", patientId: "p2", baa: "BAA-2026-000101" }),
        mv({ id: "m3", kind: "entrada", item: "Morfina 10 mg/mL", qty: 50 }),
      ],
      encounters,
      [pat("p1", "Maria"), pat("p2", "João")],
    );

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === "m1")?.prescriber).toBe("Dr. Carlos Silva");
    expect(rows.find((r) => r.id === "m2")?.prescriber).toBe("Dra. Beatriz Lima");
  });

  it("filtra por medicamento, dia, médico e paciente e soma corretamente", () => {
    const rows = buildTraceabilityRows(
      [
        mv({ id: "1", item: "Morfina 10 mg/mL", qty: 2, at: "2026-11-27T12:00:00Z", prescriber: "Dr. Carlos", patient: "Maria", patientId: "p1", lot: "L1" }),
        mv({ id: "2", item: "Morfina 10 mg/mL", qty: 3, at: "2026-11-27T15:00:00Z", prescriber: "Dra. Ana", patient: "João", patientId: "p2", lot: "L2" }),
        mv({ id: "3", item: "Dipirona 500 mg", qty: 4, at: "2026-11-27T16:00:00Z", prescriber: "Dr. Carlos", patient: "Maria", patientId: "p1", lot: "L3" }),
        mv({ id: "4", item: "Morfina 10 mg/mL", qty: 1, at: "2026-11-26T12:00:00Z", prescriber: "Dr. Carlos", patient: "Maria", patientId: "p1", lot: "L1" }),
      ],
      [],
      [pat("p1", "Maria"), pat("p2", "João")],
    );

    const morfinaDia27 = filterTraceabilityRows(rows, { medicine: "morfina", dateFrom: "2026-11-27", dateTo: "2026-11-27" });
    expect(morfinaDia27).toHaveLength(2);
    const sum = summarizeTraceability(morfinaDia27);
    expect(sum.totalQty).toBe(5);
    expect(sum.uniquePatients).toBe(2);
    expect(sum.uniquePrescribers).toBe(2);
    expect(sum.uniqueLots).toBe(2);

    const porMedico = filterTraceabilityRows(rows, { medicine: "morfina", prescriber: "carlos" });
    expect(porMedico.map((r) => r.id).sort()).toEqual(["1", "4"]);
  });
});