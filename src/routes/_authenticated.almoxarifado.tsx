import { createFileRoute } from "@tanstack/react-router";
import { StockTable } from "@/components/StockTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MovementLog, RequestInbox, ReturnForm, TransferForm } from "@/components/SupplyPanels";
import { can } from "@/lib/hospital-data";
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
  component: Almoxarifado,
});

function Almoxarifado() {
  const items = useStore((s) => s.warehouse);
  const profile = useStore((s) => s.profile);
  const pending = useStore((s) => s.requests.filter((r) => r.target === "almoxarifado" && r.status === "Pendente").length);
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Almoxarifado geral</h1><p className="text-sm text-muted-foreground">Saldos importados da posição de estoque de 13/11/2026.</p></div><Tabs defaultValue="estoque" className="space-y-4"><TabsList><TabsTrigger value="estoque">Estoque</TabsTrigger><TabsTrigger value="pedidos">Pedidos da enfermagem ({pending})</TabsTrigger><TabsTrigger value="transferencia">Transferência</TabsTrigger><TabsTrigger value="devolucao">Devolução</TabsTrigger></TabsList>
    <TabsContent value="estoque"><StockTable kind="warehouse" items={items} allowed={can(profile, "almoxarifado")} onAdjust={adjustWarehouse} onDelete={profile === "Administrador" ? (id) => deleteStockItem("warehouse", id) : undefined} /></TabsContent>
    <TabsContent value="pedidos"><RequestInbox target="almoxarifado" /></TabsContent>
    <TabsContent value="transferencia" className="space-y-3"><TransferForm from="almoxarifado" /><MovementLog kinds={["transferencia"]} depot="almoxarifado" /></TabsContent>
    <TabsContent value="devolucao" className="space-y-3"><ReturnForm depot="almoxarifado" /><MovementLog kinds={["devolucao"]} depot="almoxarifado" /></TabsContent></Tabs></div>;
}
