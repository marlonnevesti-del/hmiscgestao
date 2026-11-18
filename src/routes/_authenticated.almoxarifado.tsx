import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { StockTable } from "@/components/StockTable";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { BreakageForm, MovementLog, RequestInbox, ReturnForm, TransferForm, EntryForm, LoanPanel } from "@/components/SupplyPanels";
import { ConsumptionReport, ExpiryPanel } from "@/components/ControlledCabinet";
import { LabelStudio } from "@/components/LabelStudio";
import { can, WAREHOUSE_TABS } from "@/lib/hospital-data";
import { adjustWarehouse, deleteStockItem, useStore } from "@/lib/hospital-store";

export const Route = createFileRoute("/_authenticated/almoxarifado")({
  head: () => ({ meta: [
    { title: "Almoxarifado Geral – HMI Gestão" },
    { name: "description", content: "Saldos do almoxarifado geral com lotes, validades e custo médio." },
    { property: "og:title", content: "Almoxarifado Geral – HMI Gestão" },
    { property: "og:description", content: "Saldos, lotes e validades do almoxarifado." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  validateSearch: (s: Record<string, unknown>) => ({ aba: typeof s["aba"] === "string" ? s["aba"] : undefined }),
  component: Almoxarifado,
});

function Almoxarifado() {
  const items = useStore((s) => s.warehouse);
  const profile = useStore((s) => s.profile);
  const aba = useRouterState({ select: (st) => (st.location.search as { aba?: string }).aba });
  const tab = WAREHOUSE_TABS.find((t) => t.id === aba);
  const cur = tab?.id ?? "pedidos";
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Almoxarifado geral · {(tab ?? WAREHOUSE_TABS[0]).label}</h1><p className="text-sm text-muted-foreground">Materiais separados em 5 categorias, com lotes e validades.</p></div><Tabs value={cur} className="space-y-4">
    <TabsContent value="pedidos"><RequestInbox target="almoxarifado" /></TabsContent>
    <TabsContent value="validades"><ExpiryPanel depot="almoxarifado" /></TabsContent>
    <TabsContent value="consumo"><ConsumptionReport depot="almoxarifado" /></TabsContent>
    <TabsContent value="estoque"><StockTable kind="warehouse" items={items} allowed={can(profile, "almoxarifado")} onAdjust={adjustWarehouse} onDelete={profile === "Administrador" ? (id) => deleteStockItem("warehouse", id) : undefined} /></TabsContent>
    <TabsContent value="entrada" className="space-y-3"><EntryForm depot="almoxarifado" /><MovementLog kinds={["entrada"]} depot="almoxarifado" /></TabsContent>
    <TabsContent value="emprestimo"><LoanPanel depot="almoxarifado" /></TabsContent>
    <TabsContent value="transferencia" className="space-y-3"><TransferForm from="almoxarifado" /><MovementLog kinds={["transferencia"]} depot="almoxarifado" /></TabsContent>
    <TabsContent value="devolucao" className="space-y-3"><ReturnForm depot="almoxarifado" /><MovementLog kinds={["devolucao"]} depot="almoxarifado" /></TabsContent>
    <TabsContent value="quebra" className="space-y-3"><BreakageForm depot="almoxarifado" /><MovementLog kinds={["quebra"]} depot="almoxarifado" /></TabsContent>
    <TabsContent value="etiquetas"><LabelStudio depot="almoxarifado" /></TabsContent>
  </Tabs></div>;
}
