import { createFileRoute } from '@tanstack/react-router';
import { NoPermission } from '@/components/AppShell';
import { PhysioBoard } from '@/components/Physio';
import { canAccessPage } from '@/lib/hospital-data';
import { useStore } from '@/lib/hospital-store';

export const Route = createFileRoute('/_authenticated/fisioterapia')({
  head: () => ({ meta: [
    { title: 'Fisioterapia Hospitalar – HMI Gestão' },
    { name: 'description', content: 'Solicitações médicas de fisioterapia, atendimentos e sessões registradas no prontuário.' },
    { property: 'og:title', content: 'Fisioterapia Hospitalar – HMI Gestão' },
    { property: 'og:description', content: 'Fila de pedidos de fisioterapia respiratória e motora por setor.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Page,
});

function Page() {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  if (!canAccessPage(profile, '/fisioterapia', areas)) return <NoPermission action="acessar a Fisioterapia" />;
  return <div className="space-y-4 p-4"><h1 className="text-2xl font-bold">Fisioterapia Hospitalar</h1><PhysioBoard /></div>;
}
