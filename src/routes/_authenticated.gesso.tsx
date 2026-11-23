import { createFileRoute } from '@tanstack/react-router';
import { NoPermission } from '@/components/AppShell';
import { ServiceBoard } from '@/components/ServiceOrders';
import { canAccessPage } from '@/lib/hospital-data';
import { useStore } from '@/lib/hospital-store';

export const Route = createFileRoute('/_authenticated/gesso')({
  head: () => ({ meta: [
    { title: 'Gesso – HMI Gestão' },
    { name: 'description', content: 'Pedidos médicos de imobilização gessada por setor, com registro no prontuário.' },
    { property: 'og:title', content: 'Gesso – HMI Gestão' },
    { property: 'og:description', content: 'Pedidos médicos de imobilização gessada por setor, com registro no prontuário.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Page,
});

function Page() {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  if (!canAccessPage(profile, '/gesso', areas)) return <NoPermission action="acessar Gesso" />;
  return <div className="space-y-4 p-4"><h1 className="text-2xl font-bold">Gesso</h1><ServiceBoard kind="gesso" /></div>;
}
