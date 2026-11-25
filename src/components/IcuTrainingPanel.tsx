import { Link } from '@tanstack/react-router';
import { ArrowLeft, FileText, BedDouble, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IcuExamples } from '@/components/IcuExamples';
import { ICU_EXAMPLES, exampleChartId, type IcuExample } from '@/lib/icu-examples';
import { UNITS, type IcuUnit } from '@/lib/uti-uci';
import { canAccessPage } from '@/lib/hospital-data';
import { useStore } from '@/lib/hospital-store';

export function IcuTrainingLinks({ unit }: { unit: IcuUnit }) {
  const profile = useStore((s) => s.profile);
  const areas = useStore((s) => s.accessAreas);
  return <nav aria-label="Telas do caso de treinamento" className="flex flex-wrap gap-2 print:hidden">
    {canAccessPage(profile, '/pacientes', areas) && <Button asChild size="sm" variant="outline"><Link to="/pacientes/$id" params={{ id: exampleChartId(unit) }}><Stethoscope className="mr-2 h-4 w-4" />Abrir PEP de treinamento</Link></Button>}
    {canAccessPage(profile, '/internacoes', areas) && <Button asChild size="sm" variant="outline"><Link to="/internacoes" search={{ treinamento: true, caso: unit }}><BedDouble className="mr-2 h-4 w-4" />Internação de treinamento</Link></Button>}
    {canAccessPage(profile, '/faturamento-sus', areas) && <Button asChild size="sm" variant="outline"><Link to="/faturamento-sus" search={{ treinamento: true, caso: unit }}><FileText className="mr-2 h-4 w-4" />AIH de treinamento</Link></Button>}
  </nav>;
}

export function IcuTrainingPatients() {
  return <section className="space-y-4">
    <p className="border-l-4 border-destructive bg-destructive/5 p-3 text-sm"><b>TESTE / TREINAMENTO — 3 casos fictícios.</b> Sem leitos reais, movimentação de estoque ou remessas ao Estado.</p>
    <div className="grid gap-4 lg:grid-cols-3">{ICU_EXAMPLES.map((example) => <article key={example.unit} className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
      <div className="text-xs font-semibold text-destructive">TESTE / TREINAMENTO · {UNITS[example.unit].name}</div>
      <h2 className="break-words text-lg font-semibold">{example.name}</h2>
      <p className="text-sm">{example.diagnosis} · CID {example.cid}</p>
      <dl className="space-y-1 text-sm text-muted-foreground"><div>Nascimento: {example.birth}</div><div>Mãe: {example.mother}</div><div>Peso: {example.weight}</div><div>BAA-SIM-{example.unit} → FIA-SIM-{example.unit}</div><div>Leito virtual: SIM-{example.unit} · não integra o censo real</div></dl>
      <IcuTrainingLinks unit={example.unit} />
    </article>)}</div>
  </section>;
}

export function IcuTrainingChart({ example }: { example: IcuExample }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold">PEP · TESTE / TREINAMENTO</h1><Button asChild size="sm" variant="outline"><Link to="/pacientes" search={{ treinamento: true, caso: example.unit }}><ArrowLeft className="mr-2 h-4 w-4" />Pacientes de treinamento</Link></Button></div>
    <IcuTrainingLinks unit={example.unit} />
    <IcuExamples key={example.unit} initialUnit={example.unit} />
  </div>;
}