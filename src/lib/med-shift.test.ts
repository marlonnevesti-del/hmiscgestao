import { describe, expect, it } from "vitest";
import type { Encounter } from "./care-flow";
import type { Patient, Prescription } from "./hospital-data";
import { currentShift, doseRows, shiftProgress, type DoseRow } from "./med-shift";

const enc = { id: "e1", number: "001", patientId: "p1", status_fluxo: "AGUARDANDO_MEDICACAO", openedAt: "2026-03-10T06:00:00", signedAt: "2026-03-10T07:00:00", type: "Ambulatório", specialty: "Clínica", complaint: "Dor", history: [] } as unknown as Encounter;
const rx: Prescription = { id: "rx1", cat: "Medicamento", item: "Dipirona", posologia: "1 g EV", times: ["08:00"], pharmacy: "Dispensada" };
const pat = (r = rx) => ({ id: "p1", name: "Ana", ward: "AC", bed: "AC-01", prescriptions: [r] }) as unknown as Patient;
const now = new Date("2026-03-10T09:00:00").getTime();

describe("med-shift", () => {
  it("shifts", () => { expect(currentShift(new Date("2026-03-10T03:00:00"))).toBe("Madrugada"); expect(currentShift(new Date("2026-03-10T20:00:00"))).toBe("Noite"); });
  it("unchecked past dose is atrasado", () => expect(doseRows([enc], [pat()], {}, now)[0]?.status).toBe("atrasado"));
  it("checked dose", () => expect(doseRows([enc], [pat()], { "p1|rx1|08:00": { status: "checado", by: "Ana", at: "x" } }, now)[0]?.status).toBe("checado"));
  it("undispensed is aguardando", () => expect(doseRows([enc], [pat({ ...rx, pharmacy: "Validada" })], {}, now)[0]?.status).toBe("aguardando"));
  it("mostra somente as doses da liberação atual", () => {
    const current = { ...enc, prescriptionBatchId: "nova" };
    const patient = { ...pat(), prescriptions: [{ ...rx, batchId: "antiga" }, { ...rx, id: "rx2", batchId: "nova" }] } as Patient;
    expect(doseRows([current], [patient], {}, now).map((d) => d.key)).toEqual(["p1|rx2|08:00"]);
  });
  it("time before signature goes to next day", () => expect(doseRows([enc], [pat({ ...rx, times: ["06:00"] })], {}, now)[0]?.dueAt).toBe(new Date("2026-03-11T06:00:00").getTime()));
  it("progress 1 of 4 = 25%", () => {
    const r = { status: "checado" } as DoseRow;
    expect(shiftProgress([r, { ...r, status: "pendente" }, { ...r, status: "atrasado" }, { ...r, status: "aguardando" }]).pct).toBe(25);
  });
});
