import { createFileRoute } from "@tanstack/react-router";
import { StockTable } from "@/components/StockTable";
import { can } from "@/lib/hospital-data";
import { adjustWarehouse, useStore } from "@/lib/hospital-store";

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
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Almoxarifado geral</h1><p className="text-sm text-muted-foreground">Saldos importados da posição de estoque de 13/11/2026.</p></div><StockTable items={items} allowed={can(profile, "almoxarifado")} onAdjust={adjustWarehouse} /></div>;
}
