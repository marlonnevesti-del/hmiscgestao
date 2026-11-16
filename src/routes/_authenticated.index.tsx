import { createFileRoute, Link } from "@tanstack/react-router";
import { canAccessPage } from "@/lib/hospital-data";
import { professionalName, useStore } from "@/lib/hospital-store";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Início – HMI Gestão" },
    { name: "description", content: "Acesso rápido às áreas liberadas para sua função no hospital materno-infantil." },
    { property: "og:title", content: "Início – HMI Gestão" },
    { property: "og:description", content: "Acesso rápido às áreas liberadas para sua função." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Home,
});

const AREAS = [
  { to: "/recepcao", label: "Recepção & Cadastro" },
  { to: "/acolhimento", label: "Acolhimento" },
  { to: "/atendimento", label: "Consultório Médico" },
  { to: "/pacientes", label: "Pacientes / PEP" },
  { to: "/painel-tv", label: "Painel de Chamadas (TV)" },
  { to: "/centro-cirurgico", label: "Centro Cirúrgico" },
  { to: "/farmacia", label: "Farmácia" },
  { to: "/enfermagem", label: "Posto de Enfermagem" },
  { to: "/almoxarifado", label: "Almoxarifado" },
  { to: "/faturamento", label: "Faturamento TISS" },
] as const;

function Home() {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  return <div className="space-y-5">
    <div><h1 className="text-xl font-semibold">Bem-vindo(a), {professionalName(profile)}</h1><p className="text-sm text-muted-foreground">Escolha a área de trabalho.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {AREAS.filter((a) => canAccessPage(profile, a.to, areas)).map((a) => <Link key={a.to} to={a.to} className="rounded-lg border bg-card p-5 font-medium transition hover:border-primary hover:text-primary">{a.label}</Link>)}
    </div>
  </div>;
}
