import { describe, expect, it } from "vitest";
import { computeContractGoals, runSusPreAudit } from "./sus-audit-sc";
import type { SusRow } from "./sus-billing";
import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";

const makeRow = (overrides: Partial<SusRow> = {}): SusRow => ({
  encounter: {
    id: "e1", number: "FIA-2026-000100", patientId: "p1", type: "Maternidade", specialty: "Obstetrícia",
    complaint: "Parto", status_fluxo: "ALTA_HOSPITALAR", openedAt: "2026-11-10T08:00:00.000Z",
    discharge: { summary: "OK", recipe: "", at: "2026-11-12T10:00:00.000Z", by: "Dr." },
    history: [],
  } as Encounter,
  kind: "AIH",
  date: "2026-11-10",
  cns: "700000000000001",
  cpf: "11122233344",
  name: "Maria Teste",
  birthDate: "1995-05-10",
  sex: "F",
  motherName: "Ana Teste",
  cityCode: "420460",
  cid: "O800",
  procedure: "0310010039",
  issues: [],
  aihNumber: "4226100000001",
  aihAuthorizedAt: "2026-11-10",
  exitReason: "61",
  births: [{ rnId: "rn1", name: "RN de Maria", dnv: "1234567890", weight: 3200, weeks: "39", alive: true }],
  ...overrides,
});

const validProf = { name: "Dr. Manoel", cns: "700000000000002", cbo: "225125" };

describe("runSusPreAudit (regras SES-SC / DATASUS)", () => {
  it("alerta série AIH fora de SC (42) e autorização posterior à alta", () => {
    const row = makeRow({ aihNumber: "3526100000001", aihAuthorizedAt: "2026-11-15" });
    const res = runSusPreAudit([row], [], "202611", validProf);
    expect(res.findings.some((f) => f.message.includes("não inicia com 42"))).toBe(true);
    expect(res.findings.some((f) => f.message.includes("posterior à data da alta"))).toBe(true);
  });

  it("bloqueia DNV duplicada na mesma competência e IBGE 999999", () => {
    const r1 = makeRow({ cityCode: "999999" });
    const r2 = makeRow({ encounter: { ...r1.encounter, id: "e2", number: "FIA-2026-000101" } });
    const res = runSusPreAudit([r1, r2], [], "202611", validProf);
    expect(res.findings.some((f) => f.severity === "bloqueio" && f.message.includes("999999"))).toBe(true);
    expect(res.findings.some((f) => f.severity === "bloqueio" && f.message.includes("DNV 1234567890 duplicada"))).toBe(true);
  });

  it("alerta quando RN permanece na UTI Neo e motivo da mãe não é 62", () => {
    const rn = { id: "rn1", name: "RN de Maria", ward: "UTIN", bed: "UTIN-05" } as Patient;
    const mae = { id: "p1", name: "Maria Teste", babyIds: ["rn1"] } as Patient;
    const row = makeRow({ patient: mae, exitReason: "61" });
    const res = runSusPreAudit([row], [mae, rn], "202611", validProf);
    expect(res.findings.some((f) => f.message.includes("motivo de saída da mãe deve ser 62"))).toBe(true);
  });
});

describe("computeContractGoals", () => {
  it("calcula progresso de partos e internações frente às metas mensais", () => {
    const r1 = makeRow();
    const goals = computeContractGoals([r1], [r1.encounter], "202611", { partos: 10, internacoes: 10, consultas: 100, exames: 50 });
    expect(goals.find((g) => g.key === "partos")?.actual).toBe(1);
    expect(goals.find((g) => g.key === "internacoes")?.pct).toBe(10);
  });
});