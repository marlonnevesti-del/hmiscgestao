import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";

const UNIT_PATH: Record<string, string> = { "Ambulatório": "/ambulatorio", "Pronto socorro": "/pronto-socorro", "Maternidade": "/maternidade" };
const CLOSED = new Set(["ALTA_HOSPITALAR", "ENCAMINHADO_INTERNACAO"]);

/** Pending work per menu path, used for sidebar badges and the home cockpit. */
export function pendingCounts(encounters: Encounter[], patients: Patient[]): Record<string, number> {
  const c: Record<string, number> = {};
  const add = (k: string, n = 1) => { c[k] = (c[k] ?? 0) + n; };
  for (const e of encounters) {
    if (CLOSED.has(e.status_fluxo)) continue;
    const path = UNIT_PATH[e.type];
    if (path) add(path);
    if (e.status_fluxo === "AGUARDANDO_TRIAGEM") add("triagem");
    if (e.status_fluxo === "AGUARDANDO_FARMACIA") add("/farmacia");
    if (e.status_fluxo === "AGUARDANDO_MEDICACAO") add("/enfermagem");
  }
  for (const p of patients) if (p.prescriptions.some((r) => r.atb?.status === "Aguardando SCIRAS")) add("/sciras");
  add("internados", encounters.filter((e) => e.status_fluxo === "ENCAMINHADO_INTERNACAO").length);
  return c;
}
