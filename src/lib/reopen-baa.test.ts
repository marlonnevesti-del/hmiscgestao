import { beforeEach, describe, expect, it } from "vitest";
import { getState, reopenBaaForReturn, setState } from "./hospital-store";

const baseEnc = {
  id: "e-ret",
  number: "BAA-2026-000901",
  patientId: "p-ret",
  type: "Pronto-Socorro" as const,
  specialty: "Pediatria",
  complaint: "Febre",
  status_fluxo: "ALTA_HOSPITALAR" as const,
  openedAt: "2026-11-27T10:00:00.000Z",
  discharge: { summary: "Alta orientada", recipe: "", at: "2026-11-27T12:00:00.000Z", by: "Dr. Teste" },
  history: [{ status: "ALTA_HOSPITALAR" as const, at: "2026-11-27T12:00:00.000Z", by: "Dr. Teste", note: "Alta" }],
};

describe("reopenBaaForReturn", () => {
  beforeEach(() => {
    setState(() => ({
      profile: "Recepção",
      accessAreas: null,
      patients: [{ id: "p-ret", name: "Paciente Teste" } as never],
      encounters: [baseEnc],
    }));
  });

  it("permite que a Recepção reabra BAA com alta por retorno do paciente", () => {
    const updated = reopenBaaForReturn("e-ret", "Piora da febre no mesmo dia", "AGUARDANDO_TRIAGEM");
    expect(updated.status_fluxo).toBe("AGUARDANDO_TRIAGEM");
    expect(updated.discharge).toBeUndefined();
    expect(updated.history.at(-1)?.note).toContain("BAA reaberta por retorno do paciente: Piora da febre no mesmo dia");
    expect(getState().encounters[0]?.status_fluxo).toBe("AGUARDANDO_TRIAGEM");
  });

  it("exige motivo do retorno", () => {
    expect(() => reopenBaaForReturn("e-ret", "   ")).toThrow("motivo");
  });

  it("bloqueia reabertura por retorno quando já existe internação (FIA)", () => {
    setState(() => ({
      encounters: [{ ...baseEnc, fia: { number: "FIA-2026-000901", openedAt: "2026-11-27T11:00:00.000Z", ward: "UTIN", bed: "UTIN-01", doctor: "Dr. Teste", authorizedBy: "NIR", cid: "P07.0", justification: "UTI", character: "Urgência" } }],
    }));
    expect(() => reopenBaaForReturn("e-ret", "Retorno")).toThrow("FIA");
  });
});