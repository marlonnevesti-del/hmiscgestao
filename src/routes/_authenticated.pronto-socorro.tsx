import { createFileRoute } from "@tanstack/react-router";
import { CareUnitPage } from "@/components/CareUnitPage";
import { employeeHead } from "@/lib/employee-rules";

export const Route = createFileRoute("/_authenticated/pronto-socorro")({
  head: () => employeeHead("Pronto Socorro – recepção, acolhimento e atendimento", "Recepção, classificação de risco e atendimento médico do Pronto Socorro do HMISC."),
  validateSearch: (s: Record<string, unknown>): { aba?: string } => (typeof s["aba"] === "string" ? { aba: s["aba"] } : {}),
  component: () => <CareUnitPage unit="Pronto socorro" />,
});
