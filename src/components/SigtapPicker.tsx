import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatCode, loadSigtap, searchSigtap, type SigtapProc } from '@/lib/sigtap';

/** Busca na tabela SIGTAP; ao escolher, devolve código e descrição oficiais. */
export function SigtapPicker({ onPick, aihOnly }: { onPick: (p: SigtapProc) => void; aihOnly?: boolean }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<SigtapProc[] | null>(null);
  useEffect(() => { void loadSigtap().then(setList); }, []);
  const hits = list && q.trim().length >= 2 ? searchSigtap(list, q, { aihOnly: !!aihOnly }) : [];
  return <div className="relative sm:col-span-2">
    <label className="text-xs">Buscar procedimento SIGTAP (nome ou código)
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={list ? 'Ex.: parto, cesariano, pneumonia, 0411…' : 'Carregando tabela…'} />
    </label>
    {hits.length > 0 && <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover text-xs shadow-md">
      {hits.map((p) => <li key={p.c}><button type="button" className="w-full px-2 py-1.5 text-left hover:bg-muted" onClick={() => { onPick(p); setQ(''); }}>
        <b>{formatCode(p.c)}</b> · {p.n} {p.v > 0 && <span className="text-muted-foreground">· R$ {p.v.toFixed(2)}</span>}
      </button></li>)}
    </ul>}
  </div>;
}
