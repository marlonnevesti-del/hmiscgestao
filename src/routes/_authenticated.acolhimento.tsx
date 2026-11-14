import { createFileRoute } from "@tanstack/react-router";
import { CareTriage } from "@/components/CareTriage";

export const Route = createFileRoute("/_authenticated/acolhimento")({
  head: () => ({ meta: [
    { title: "Acolhimento e Classificação de Risco – HMI Gestão" },
    { name: "description", content: "Fila em tempo real e triagem pelo Protocolo de Manchester para obstetrícia e pediatria." },
    { property: "og:title", content: "Acolhimento e Classificação de Risco – HMI Gestão" },
    { property: "og:description", content: "Fila em tempo real e triagem pelo Protocolo de Manchester." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CareTriage,
});
