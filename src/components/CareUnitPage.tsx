import type React from "react";
import { CareReception } from "./CareReception";
import { CareTriage } from "./CareTriage";
import { MedicalQueue } from "./CareMedical";
import { InpatientList } from "./InpatientList";
import { AmbulatoryReports } from "./AmbulatoryReports";
import { AmbulatoryNursing } from "./AmbulatoryNursing";
import { PsCare, PsCoordination, PsObservation, PsWaiting } from "./PsInfantil";
import { AmbulatoryAgenda, SadtPanel, SpecialtyManager, TodayAppointments } from "./AmbulatoryPanels";
import type { CareUnit } from "@/lib/ambulatorio";
import { useRouterState } from "@tanstack/react-router";
import { useStore } from "@/lib/hospital-store";
import { canAccessUnitTab, UNIT_AREAS, type UnitArea } from "@/lib/hospital-data";

/** One page per care unit (Ambulatório / Pronto Socorro / Maternidade) with its own reception, acolhimento and medical queue. */
export function CareUnitPage({ unit }: { unit: CareUnit }) {
  const amb = unit === "Ambulatório";
  const profile = useStore((s) => s.profile);
  const areas = useStore((s) => s.accessAreas);
  const area: UnitArea = amb ? "ambulatorio" : unit === "Maternidade" ? "maternidade" : "pronto-socorro";
  const tabs = UNIT_AREAS.find((u) => u.id === area)!.tabs.filter((t) => canAccessUnitTab(profile, area, t.id, areas));
  const body: Record<string, React.ReactNode> = { agenda: <AmbulatoryAgenda />, recepcao: amb ? <div className="space-y-4"><TodayAppointments /><CareReception unit={unit} /></div> : <CareReception unit={unit} />, acolhimento: amb ? <AmbulatoryNursing /> : <CareTriage unit={unit} />, atendimento: <MedicalQueue unit={unit} />, sadt: <SadtPanel />, especialidades: <SpecialtyManager />, internados: <InpatientList unit={unit} />, relatorios: <AmbulatoryReports />, aguardando: <PsWaiting />, observacao: <PsObservation />, assistencia: <PsCare />, coordenacao: <PsCoordination /> };
  const aba = useRouterState({ select: (s) => (s.location.search as { aba?: string }).aba });
  if (!tabs.length) return <p className="text-muted-foreground">Você não tem acesso a nenhuma área desta unidade.</p>;
  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">{unit === "Pronto socorro" ? "Pronto-Socorro Infantil" : unit}</h1>
    {(() => { const t = tabs.find((x) => x.id === aba) ?? tabs[0]!; return <><h2 className="text-sm font-medium text-muted-foreground">{t.label}</h2><div key={t.id}>{body[t.id]}</div></>; })()}
  </div>;
}
