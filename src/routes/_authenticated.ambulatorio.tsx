import { createFileRoute } from "@tanstack/react-router";
import { CareUnitPage } from "@/components/CareUnitPage";
import { employeeHead } from "@/lib/employee-rules";

export const Route = createFileRoute("/_authenticated/ambulatorio")({
  head: () => employeeHead("Ambulatório – agenda, especialidades e SADT", "Agenda, recepção, acolhimento de alto risco, consultas e laudos SADT do ambulatório do HMISC."),
  component: () => <CareUnitPage unit="Ambulatório" />,
});
