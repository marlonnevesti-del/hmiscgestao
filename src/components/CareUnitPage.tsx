import type React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CareReception } from "./CareReception";
import { CareTriage } from "./CareTriage";
import { MedicalQueue } from "./CareMedical";
import { AmbulatoryAgenda, SadtPanel, SpecialtyManager } from "./AmbulatoryPanels";
import type { CareUnit } from "@/lib/ambulatorio";
import { useStore } from "@/lib/hospital-store";
import { canAccessUnitTab, UNIT_AREAS, type UnitArea } from "@/lib/hospital-data";

/** One page per care unit (Ambulatório / Pronto Socorro / Maternidade) with its own reception, acolhimento and medical queue. */
export function CareUnitPage({ unit }: { unit: CareUnit }) {
  const amb = unit === "Ambulatório";
  const profile = useStore((s) => s.profile);
  const areas = useStore((s) => s.accessAreas);
  const area: UnitArea = amb ? "ambulatorio" : unit === "Maternidade" ? "maternidade" : "pronto-socorro";
  const tabs = UNIT_AREAS.find((u) => u.id === area)!.tabs.filter((t) => canAccessUnitTab(profile, area, t.id, areas));
  const body: Record<string, React.ReactNode> = { agenda: <AmbulatoryAgenda />, recepcao: <CareReception unit={unit} />, acolhimento: <CareTriage unit={unit} />, atendimento: <MedicalQueue unit={unit} />, sadt: <SadtPanel />, especialidades: <SpecialtyManager /> };
  if (!tabs.length) return <p className="text-muted-foreground">Você não tem acesso a nenhuma área desta unidade.</p>;
  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">{unit === "Pronto socorro" ? "Pronto Socorro" : unit}</h1>
    <Tabs defaultValue={tabs[0]?.id ?? ""}>
      <TabsList className="flex h-auto flex-wrap">
        {tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
      </TabsList>
      {tabs.map((t) => <TabsContent key={t.id} value={t.id}>{body[t.id]}</TabsContent>)}
    </Tabs>
  </div>;
}
