import { createFileRoute } from '@tanstack/react-router';
import { NoPermission } from '@/components/AppShell';
import { ServiceBoard } from '@/components/ServiceOrders';
import { canAccessPage } from '@/lib/hospital-data';
import { useStore } from '@/lib/hospital-store';

export const Route = createFileRoute('/_authenticated/raio-x')({
  head: () => ({ meta: [
    { title: 'Raio-X – HMI Gestão' },
    { name: 'description', content: 'Pedidos médicos de radiografia por setor, com registro do exame no prontuário.' },
    { property: 'og:title', content: 'Raio-X – HMI Gestão' },
    { property: 'og:description', content: 'Pedidos médicos de radiografia por setor, com registro do exame no prontuário.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Page,
});

function Page() {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  if (!canAccessPage(profile, '/raio-x', areas)) return <NoPermission action="acessar Raio-X" />;
  return <div className="space-y-4 p-4"><h1 className="text-2xl font-bold">Raio-X</h1><ServiceBoard kind="raio-x" /></div>;
}
