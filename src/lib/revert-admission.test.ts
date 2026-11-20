import { describe, it, expect, beforeEach } from "vitest";
import { setState, getState, revertAdmission } from "./hospital-store";
import type { Encounter } from "./care-flow";
const enc = { id: "e1", patientId: "p1", number: "BAA-1", status_fluxo: "ENCAMINHADO_INTERNACAO", openedAt: "", type: "Pronto socorro", specialty: "Pediatria", complaint: "x", baaClosedAt: "2026-01-01", fia: { number: "FIA-2026-000001" }, admission: { status: "autorizada" }, history: [] } as unknown as Encounter;
beforeEach(() => setState(() => ({ profile: "Administrador", encounters: [enc], patients: [{ id: "p1", bed: "ENFP-01" } as never] })));
describe("desfazer internação", () => {
  it("cancela FIA, reabre BAA e libera leito", () => { expect(revertAdmission("e1", "engano")).toBe("ENFP-01"); const e = getState().encounters[0]; expect(e?.fia).toBeUndefined(); expect(e?.baaClosedAt).toBeUndefined(); expect(e?.status_fluxo).toBe("EM_OBSERVACAO_REAVALIACAO"); expect(getState().patients[0]?.bed).toBe(""); });
  it("exige justificativa", () => expect(() => revertAdmission("e1", " ")).toThrow("justificativa"));
  it("bloqueia não administrador", () => { setState(() => ({ profile: "NIR" as never })); expect(() => revertAdmission("e1", "r")).toThrow("administradores"); });
});
