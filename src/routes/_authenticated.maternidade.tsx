import { createFileRoute } from "@tanstack/react-router";
import { CareUnitPage } from "@/components/CareUnitPage";
import { employeeHead } from "@/lib/employee-rules";

export const Route = createFileRoute("/_authenticated/maternidade")({
  head: () => employeeHead("Maternidade – recepção, acolhimento obstétrico e atendimento", "Recepção, classificação de risco obstétrica e atendimento médico da Maternidade do HMISC."),
  component: () => <CareUnitPage unit="Maternidade" />,
});
