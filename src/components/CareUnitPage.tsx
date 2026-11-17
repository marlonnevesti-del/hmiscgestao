import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CareReception } from "./CareReception";
import { CareTriage } from "./CareTriage";
import { MedicalQueue } from "./CareMedical";
import { AmbulatoryAgenda, SadtPanel, SpecialtyManager } from "./AmbulatoryPanels";
import type { CareUnit } from "@/lib/ambulatorio";

/** One page per care unit (Ambulatório / Pronto Socorro / Maternidade) with its own reception, acolhimento and medical queue. */
export function CareUnitPage({ unit }: { unit: CareUnit }) {
  const amb = unit === "Ambulatório";
  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">{unit === "Pronto socorro" ? "Pronto Socorro" : unit}</h1>
    <Tabs defaultValue={amb ? "agenda" : "recepcao"}>
      <TabsList className="flex h-auto flex-wrap">
        {amb && <TabsTrigger value="agenda">Agenda</TabsTrigger>}
        <TabsTrigger value="recepcao">{amb ? "Recepção / chegada" : "Recepção / cadastro"}</TabsTrigger>
        <TabsTrigger value="acolhimento">{amb ? "Acolhimento (Alto Risco)" : "Acolhimento"}</TabsTrigger>
        <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
        {amb && <TabsTrigger value="sadt">SADT · Laudos</TabsTrigger>}
        {amb && <TabsTrigger value="especialidades">Especialidades</TabsTrigger>}
      </TabsList>
      {amb && <TabsContent value="agenda"><AmbulatoryAgenda /></TabsContent>}
      <TabsContent value="recepcao"><CareReception unit={unit} /></TabsContent>
      <TabsContent value="acolhimento"><CareTriage unit={unit} /></TabsContent>
      <TabsContent value="atendimento"><MedicalQueue unit={unit} /></TabsContent>
      {amb && <TabsContent value="sadt"><SadtPanel /></TabsContent>}
      {amb && <TabsContent value="especialidades"><SpecialtyManager /></TabsContent>}
    </Tabs>
  </div>;
}
