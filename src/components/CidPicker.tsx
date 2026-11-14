import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { CID10, CID_SPECIALTIES, defaultSpecialty, searchCid, type Cid, type CidSpecialty } from '@/lib/cid10';
import { cn } from '@/lib/utils';
export function CidPicker({ patientType, value, onPick }: { patientType: string; value: string; onPick: (c: Cid) => void }) {
  const [tab, setTab] = useState<CidSpecialty>(defaultSpecialty(patientType));
  const [q, setQ] = useState('');
  const results = searchCid(q);
  const chips = CID10.filter((c) => c.specialty === tab);
  const pick = (c: Cid) => { onPick(c); setQ(''); };
  return <div className="space-y-2 rounded-md border bg-muted/30 p-3 sm:col-span-2">
    <div className="text-xs font-medium">CID-10 · clique para selecionar {value && <span className="ml-2 rounded bg-primary px-2 py-0.5 text-primary-foreground">{value}</span>}</div>
    <div className="relative"><Input aria-label="Buscar CID-10" placeholder="Buscar por código ou doença (ex.: bronq, O80, icterícia)" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
        {results.length ? results.map((c) => <li key={c.code}><button type="button" onClick={() => pick(c)} className="w-full px-3 py-2 text-left text-sm hover:bg-accent"><b>{c.code}</b> · {c.name}</button></li>)
          : <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum CID encontrado — digite manualmente no campo abaixo.</li>}
      </ul>}</div>
    <div className="flex flex-wrap gap-1">{CID_SPECIALTIES.map((s) => <button type="button" key={s.id} onClick={() => setTab(s.id)} className={cn('rounded-md px-3 py-1 text-xs', tab === s.id ? 'bg-primary text-primary-foreground' : 'bg-background border')}>{s.label}</button>)}</div>
    <div className="flex flex-wrap gap-1.5">{chips.map((c) => <button type="button" key={c.code} title={c.name} onClick={() => pick(c)} className={cn('rounded-full border px-2.5 py-1 text-xs hover:border-primary', value === c.code ? 'border-primary bg-primary/10' : 'bg-background', c.frequent && 'font-medium')}><b>{c.code}</b> {c.name}</button>)}</div>
  </div>;
}
