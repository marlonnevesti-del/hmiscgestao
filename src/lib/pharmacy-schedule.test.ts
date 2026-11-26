import { beforeEach, describe, expect, it } from "vitest";
import { buildScheduleTimes, canDispenseNow, formatPosologia, PHARMACY_START_HOUR, remainingDoses } from "./pharmacy-schedule";
import { addStock, callPatient, completeTriage, dispenseKit, dispenseScheduledDose, getState, openEncounter, recordMedication, saveMedical, setState, signPrescription, validatePrescription } from "./hospital-store";

const AT_14H = new Date(2026, 10, 25, 14, 0, 0);
const AT_16H = new Date(2026, 10, 25, 16, 0, 0);

describe("Regras de horário e posologia da farmácia", () => {
  it("gera horários corretos para Agora e intervalos de rotina iniciando às 16:00", () => {
    expect(buildScheduleTimes("Agora", true, new Date(2026, 10, 25, 10, 15))).toEqual(["10:15"]);
    expect(buildScheduleTimes("8x8", false, AT_14H)).toEqual(["16:00", "00:00", "08:00"]);
    expect(buildScheduleTimes("12x12", true, new Date(2026, 10, 25, 10, 15))).toEqual(["10:15", "22:15"]);
    expect(buildScheduleTimes("2x2", false, AT_14H)).toHaveLength(12);
    expect(buildScheduleTimes("4x4", false, AT_14H)).toHaveLength(6);
    expect(buildScheduleTimes("6x6", false, AT_14H)).toHaveLength(4);
    expect(buildScheduleTimes("24x24", false, AT_14H)).toEqual(["16:00"]);
    expect(formatPosologia("EV", "8x8", true)).toBe("EV · 8x8 (Dose imediata)");
  });

  it("bloqueia dispensação de rotina antes das 16:00 e libera para dose imediata ou caso especial", () => {
    expect(PHARMACY_START_HOUR).toBe(16);
    const routine = [{ frequency: "8x8", immediate: false }];
    expect(canDispenseNow(routine, { now: AT_14H }).ok).toBe(false);
    expect(canDispenseNow(routine, { now: AT_14H, specialCaseReason: "Urgência clínica" }).ok).toBe(true);
    expect(canDispenseNow([{ frequency: "Agora", immediate: true }], { now: AT_14H }).ok).toBe(true);
    expect(canDispenseNow(routine, { now: AT_16H }).ok).toBe(true);
  });
});

describe("Retenção de doses restantes na farmácia (2+ administrações)", () => {
  let encId = "";
  beforeEach(() => {
    setState(() => ({
      profile: "Administrador",
      patients: [],
      encounters: [],
      admins: {},
      movements: [],
      stock: [],
    }));
    const e = openEncounter(
      {
        id: "p-sched",
        prontuario: "PR-S1",
        name: "Paciente Horário",
        cpf: "",
        age: "36a",
        type: "gestante",
        ward: "PSP",
        bed: "L01",
        insurance: "SUS",
        authorized: true,
        weight: 70,
        allergies: [],
        risks: [],
        diagnosis: "Em avaliação",
        admission: "25/11/2026",
        days: 1,
        evolutions: [],
        vitals: [],
        prescriptions: [
          {
            id: "rx-8x8",
            cat: "Medicamento",
            item: "Dipirona 500 mg/mL",
            posologia: "EV · 8x8 (Dose imediata)",
            route: "EV",
            frequency: "8x8",
            immediate: true,
            times: ["14:00", "22:00", "06:00"],
            pharmacy: "Pendente",
          },
        ],
      },
      "Pronto Socorro",
      "",
      "Dor",
    );
    encId = e.id;
    completeTriage(encId, {
      risk: "verde",
      complaint: "Dor",
      weight: 70,
      allergies: [],
      ig: "",
      dum: "",
      bcf: "",
      contractions: "",
      bleeding: "",
      fluid: "",
      height: "",
      head: "",
      guardian: "",
      maxWait: 120,
      vital: { time: "14:00", pas: 120, pad: 80, fc: 80, fr: 16, tax: 36.5, sat: 98, dor: 4, ingesta: 0, diurese: 0, vomitos: 0 },
    });
    callPatient(encId);
    saveMedical(encId, { anamnesis: "Dor", exam: "Normal", cid: "R52", diagnosis: "Dor aguda" });
    signPrescription(encId);
    validatePrescription(encId, "rx-8x8");
    addStock("Dipirona", 5);
  });

  it("dispensa apenas a 1ª dose imediata antes das 16:00 e retém as demais na farmácia", () => {
    dispenseKit(encId, "1ª dose imediata", { "rx-8x8": "L10" }, { now: AT_14H, retainRemaining: true });
    const rx = getState().patients[0]?.prescriptions.find((r) => r.id === "rx-8x8")!;
    expect(rx.pharmacy).toBe("Parcial");
    expect(rx.dispensedTimes).toEqual(["14:00"]);
    expect(remainingDoses(rx)).toEqual(["22:00", "06:00"]);
    expect(getState().stock.find((s) => s.name === "dipirona")?.quantity).toBe(4);

    // Enfermagem consegue checar a 1ª dose, mas não a 2ª ainda retida
    recordMedication(encId, "rx-8x8", "14:00", "checado");
    expect(() => recordMedication(encId, "rx-8x8", "22:00", "checado")).toThrow("retida na farmácia");

    // Farmácia entrega a 2ª e 3ª doses após as 16:00
    dispenseScheduledDose(encId, "rx-8x8", "22:00", "L10", { now: AT_16H });
    expect(getState().stock.find((s) => s.name === "dipirona")?.quantity).toBe(3);
    recordMedication(encId, "rx-8x8", "22:00", "checado");

    dispenseScheduledDose(encId, "rx-8x8", "06:00", "L10", { now: AT_16H });
    const doneRx = getState().patients[0]?.prescriptions.find((r) => r.id === "rx-8x8")!;
    expect(doneRx.pharmacy).toBe("Dispensada");
    expect(remainingDoses(doneRx)).toEqual([]);
    expect(getState().stock.find((s) => s.name === "dipirona")?.quantity).toBe(2);
  });

  it("dispensa apenas o horário selecionado (targetTime) e mantém os demais horários pendentes na lista", () => {
    dispenseKit(encId, "Dose 14:00", { "rx-8x8": "L10" }, { now: AT_16H, targetTime: "14:00" });
    const afterFirst = getState().patients[0]?.prescriptions.find((r) => r.id === "rx-8x8")!;
    expect(afterFirst.pharmacy).toBe("Parcial");
    expect(afterFirst.dispensedTimes).toEqual(["14:00"]);
    expect(remainingDoses(afterFirst)).toEqual(["22:00", "06:00"]);
    expect(getState().stock.find((s) => s.name === "dipirona")?.quantity).toBe(4);

    dispenseKit(encId, "Dose 22:00", { "rx-8x8": "L10" }, { now: AT_16H, targetTime: "22:00" });
    const afterSecond = getState().patients[0]?.prescriptions.find((r) => r.id === "rx-8x8")!;
    expect(afterSecond.pharmacy).toBe("Parcial");
    expect(remainingDoses(afterSecond)).toEqual(["06:00"]);
    expect(getState().stock.find((s) => s.name === "dipirona")?.quantity).toBe(3);

    dispenseKit(encId, "Dose 06:00", { "rx-8x8": "L10" }, { now: AT_16H, targetTime: "06:00" });
    const afterThird = getState().patients[0]?.prescriptions.find((r) => r.id === "rx-8x8")!;
    expect(afterThird.pharmacy).toBe("Dispensada");
    expect(remainingDoses(afterThird)).toEqual([]);
    expect(getState().stock.find((s) => s.name === "dipirona")?.quantity).toBe(2);
  });
});