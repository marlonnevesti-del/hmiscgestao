import { createFileRoute } from "@tanstack/react-router";
import { CareTriage } from "@/components/CareTriage";

export const Route = createFileRoute("/_authenticated/acolhimento")({
  head: () => ({ meta: [
    { title: "Painel de Filas e Risco PCACR – HMI Gestão" },
    { name: "description", content: "Filas em tempo real e classificação pelo Protocolo de Acolhimento e Risco de Santa Catarina para obstetrícia e pediatria." },
    { property: "og:title", content: "Painel de Filas e Risco PCACR – HMI Gestão" },
    { property: "og:description", content: "Filas por gravidade e classificação pelo protocolo de Santa Catarina." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CareTriage,
});
