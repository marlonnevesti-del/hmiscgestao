import { createFileRoute } from "@tanstack/react-router";
import { CareReception } from "@/components/CareReception";

export const Route = createFileRoute("/_authenticated/recepcao")({
  head: () => ({ meta: [
    { title: "Recepção e Cadastro de Pacientes – HMI Gestão" },
    { name: "description", content: "Cadastro de gestantes e crianças, abertura de atendimento e encaminhamento para triagem ou internação." },
    { property: "og:title", content: "Recepção e Cadastro – HMI Gestão" },
    { property: "og:description", content: "Cadastro de pacientes e abertura de atendimento." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CareReception,
});
