import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Letterhead } from '@/components/DischargePrint';
import { ICU_EXAMPLES, exampleBillingChecks, type ExampleDocument } from '@/lib/icu-examples';
import { UNITS, type IcuUnit } from '@/lib/uti-uci';

function DocumentBody({ doc }: { doc: ExampleDocument }) {
  return <><div className="mb-3 text-xs text-muted-foreground">{doc.at} · {doc.author}</div>
    <dl className="space-y-3">{doc.fields.map(([label, value]) => <div key={label}><dt className="text-sm font-semibold">{label}</dt><dd className="whitespace-pre-wrap text-sm">{value}</dd></div>)}</dl></>;
}

export function IcuExamples({ initialUnit = 'UTIN', initialView = 'flow' }: { initialUnit?: IcuUnit; initialView?: 'flow' | 'billing' } = {}) {
  const [unit, setUnit] = useState<IcuUnit>(initialUnit);
  const [printing, setPrinting] = useState(false);
  const example = ICU_EXAMPLES.find((e) => e.unit === unit);
  useEffect(() => {
    if (!printing) return;
    const cleanup = () => { document.body.classList.remove('print-icu-example'); setPrinting(false); };
    document.body.classList.add('print-icu-example');
    window.addEventListener('afterprint', cleanup);
    const timer = window.setTimeout(() => { try { window.print(); } catch { cleanup(); } }, 150);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', cleanup); document.body.classList.remove('print-icu-example'); };
  }, [printing]);
  if (!example) return null;
  const checks = exampleBillingChecks(example);
  return <div className="space-y-4">
    <div className="flex items-start gap-2 border-l-4 border-destructive bg-destructive/5 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><p><b>Casos fictícios — sem validade assistencial ou fiscal.</b> Não ocupam leitos, não alteram estoque nem entram nas remessas. Códigos, identificadores e autorizações reais precisam de conferência do faturamento.</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Casos de internação">{ICU_EXAMPLES.map((e) => <Button key={e.unit} variant={unit === e.unit ? 'default' : 'outline'} size="sm" aria-pressed={unit === e.unit} onClick={() => setUnit(e.unit)}>{UNITS[e.unit].name}</Button>)}</div>
      <Button variant="outline" size="sm" onClick={() => setPrinting(true)}><Printer className="mr-2 h-4 w-4" />Imprimir caso completo</Button></div>
    <header className="space-y-1 border-b pb-3"><h2 className="text-lg font-semibold">{example.name}</h2><p className="text-sm text-muted-foreground">Nascimento {example.birth} · Mãe: {example.mother} · Peso: {example.weight}</p><p className="text-sm">{example.diagnosis} · CID ilustrativo {example.cid}</p><p className="text-xs text-muted-foreground">Entrada {example.start} · {unit === 'UTIN' ? 'Transferência interna' : 'Alta'} {example.end}</p></header>
    <Tabs key={unit} defaultValue={initialView}><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="flow">Fluxo e documentos</TabsTrigger><TabsTrigger value="billing">Conferência do faturamento</TabsTrigger></TabsList>
      <TabsContent value="flow"><ol className="divide-y">{example.documents.map((doc, i) => <li key={doc.title} className="py-3"><details open={i === 0}><summary className="cursor-pointer text-sm font-semibold">{i + 1}. {doc.title} <span className="font-normal text-muted-foreground">· {doc.at}</span></summary><div className="pt-3"><DocumentBody doc={doc} /></div></details></li>)}</ol></TabsContent>
      <TabsContent value="billing"><div className="flex items-center gap-2 py-3 font-semibold"><FileText className="h-4 w-4" />Conferência por FIA — {unit}</div><dl className="divide-y">{checks.map((c) => <div key={c.item} className="grid gap-1 py-3 text-sm md:grid-cols-2"><dt>{c.item}</dt><dd className={c.status === 'Ilustrado' ? 'text-muted-foreground' : 'font-medium text-destructive'}>{c.status}</dd></div>)}</dl></TabsContent>
    </Tabs>
    {printing && createPortal(<div className="icu-example-print">{example.documents.map((doc, i) => <section className="icu-example-page" key={doc.title}><Letterhead title={doc.title} /><p className="icu-example-notice">SIMULAÇÃO — NÃO TRANSMITIR — SEM VALIDADE CLÍNICA OU FISCAL</p><p><b>{example.name}</b><br />{UNITS[unit].name} · Documento {i + 1}/{example.documents.length + 1}</p><DocumentBody doc={doc} /></section>)}<section className="icu-example-page"><Letterhead title="CONFERÊNCIA DO FATURAMENTO — EXEMPLO" /><p className="icu-example-notice">SIMULAÇÃO — NÃO TRANSMITIR</p><p><b>{example.name}</b> · Documento {example.documents.length + 1}/{example.documents.length + 1}</p><dl>{checks.map((c) => <div key={c.item}><dt><b>{c.item}</b></dt><dd>{c.status}</dd></div>)}</dl></section></div>, document.body)}
  </div>;
}