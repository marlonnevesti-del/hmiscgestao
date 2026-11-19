import { describe, expect, it } from "vitest";
import { aldreteDischarge, aldreteScore, ccReport, coReport, countMismatch, EMPTY_OBST, EMPTY_SAEP, nextVitalDue, robson, suspensionIssue, CO_BEDS, SRPA_BEDS, type SurgX } from "./surgical-center";

const full = { activity: 2, breathing: 2, circulation: 2, consciousness: 2, saturation: 2 };
describe("SRPA", () => {
  it("6 leitos", () => expect(SRPA_BEDS).toHaveLength(6));
  it("Aldrete 10 libera", () => { expect(aldreteScore(full)).toBe(10); expect(aldreteDischarge(full)).toBe(true); });
  it("8 só libera após regional", () => { const a = { ...full, activity: 1, consciousness: 1 }; expect(aldreteDischarge(a)).toBe(false); expect(aldreteDischarge(a, true)).toBe(true); });
  it("item zero bloqueia", () => expect(aldreteDischarge({ ...full, saturation: 0 }, true)).toBe(false));
  it("15 min na 1ª hora, depois 30", () => {
    expect(nextVitalDue({ bed: "SRPA 1", inAt: "2026-01-01T10:00:00Z", vitals: [] }).toISOString()).toBe("2026-01-01T10:15:00.000Z");
    const v = { at: "2026-01-01T11:00:00Z", pa: "", fc: "", spo2: "", pain: 0, aldrete: full, by: "" };
    expect(nextVitalDue({ bed: "SRPA 1", inAt: "2026-01-01T10:00:00Z", vitals: [v] }).toISOString()).toBe("2026-01-01T11:30:00.000Z");
  });
});
describe("CC", () => {
  it("suspensão exige motivo e justificativa", () => { expect(suspensionIssue("x", "justificativa longa")).toBeTruthy(); expect(suspensionIssue("Recusa do paciente", "curta")).toBeTruthy(); expect(suspensionIssue("Recusa do paciente", "Paciente recusou após orientação")).toBeNull(); });
  it("contagem divergente", () => {
    const c = (phase: "Inicial" | "Final", g: number) => ({ phase, gauze: g, compresses: 5, instruments: 30 });
    expect(countMismatch({ ...EMPTY_SAEP, counts: [c("Inicial", 10), c("Final", 9)] })).toContain("gazes");
    expect(countMismatch({ ...EMPTY_SAEP, counts: [c("Inicial", 10), c("Final", 10)] })).toBeNull();
  });
  it("taxa de suspensão", () => {
    const b = { room: "Sala Cirúrgica 1", start: 8, duration: 1, patient: "", type: "", tuss: "", surgeon: "Dr A", checks: {}, gastos: [], date: "2026-03-02" };
    const r = ccReport([{ ...b, id: "1", status: "Finalizado" }, { ...b, id: "2", status: "Agendado", suspension: { reason: "Recusa do paciente", justification: "x", by: "", at: "" } }] as SurgX[], "2026-03");
    expect(r.suspensionRate).toBe(50); expect(r.done).toBe(1);
  });
});
describe("Centro obstétrico", () => {
  it("leitos oficiais", () => { expect(CO_BEDS.filter((b) => b.startsWith("PPP"))).toHaveLength(8); expect(CO_BEDS.filter((b) => b.startsWith("Observação"))).toHaveLength(10); expect(CO_BEDS).toContain("CTG 1"); });
  it("Robson", () => {
    expect(robson(EMPTY_OBST)).toBe(1);
    expect(robson({ ...EMPTY_OBST, labor: "Induzido" })).toBe(2);
    expect(robson({ ...EMPTY_OBST, parity: "Multípara" })).toBe(3);
    expect(robson({ ...EMPTY_OBST, parity: "Multípara", previousCesarean: true })).toBe(5);
    expect(robson({ ...EMPTY_OBST, presentation: "Pélvica" })).toBe(6);
    expect(robson({ ...EMPTY_OBST, fetuses: 2 })).toBe(8);
    expect(robson({ ...EMPTY_OBST, presentation: "Transversa/oblíqua" })).toBe(9);
    expect(robson({ ...EMPTY_OBST, gestationalWeeks: 34 })).toBe(10);
  });
  it("taxa de cesárea", () => {
    const b = { room: "", start: 0, duration: 1, patient: "", type: "", tuss: "", surgeon: "", status: "Finalizado", checks: {}, gastos: [], date: "2026-03-05" };
    const r = coReport([{ ...b, id: "1", obstetric: { ...EMPTY_OBST, delivery: "Cesárea" } }, { ...b, id: "2", obstetric: { ...EMPTY_OBST, delivery: "Vaginal" } }] as SurgX[], "2026-03");
    expect(r.cesareanRate).toBe(50); expect(r.groups[0]!.total).toBe(2);
  });
});
