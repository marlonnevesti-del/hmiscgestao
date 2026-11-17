import { createFileRoute } from "@tanstack/react-router";
import { CarePharmacy } from "@/components/CarePharmacy";

export const Route = createFileRoute("/_authenticated/farmacia")({
  head: () => ({ meta: [
    { title: "Farmácia e Checagem Beira-Leito – HMI Gestão" },
    { name: "description", content: "Triagem farmacêutica, dispensação por kit e aprazamento com checagem de medicações." },
    { property: "og:title", content: "Farmácia e Checagem Beira-Leito – HMI Gestão" },
    { property: "og:description", content: "Triagem farmacêutica, dispensação e checagem de medicações." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  validateSearch: (s: Record<string, unknown>) => ({ aba: typeof s["aba"] === "string" ? s["aba"] : undefined }),
  component: CarePharmacy,
});
