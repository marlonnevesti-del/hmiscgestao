import { createFileRoute } from "@tanstack/react-router";
import { CareUnitPage } from "@/components/CareUnitPage";
import { employeeHead } from "@/lib/employee-rules";

export const Route = createFileRoute("/_authenticated/maternidade")({
  head: () => employeeHead("Maternidade – parto seguro e assistência obstétrica", "Recepção, triagem obstétrica, observação, leitos, checklist de parto seguro e escalas maternas e neonatais do HMISC."),
  validateSearch: (s: Record<string, unknown>): { aba?: string } => (typeof s["aba"] === "string" ? { aba: s["aba"] } : {}),
  component: () => <CareUnitPage unit="Maternidade" />,
});
