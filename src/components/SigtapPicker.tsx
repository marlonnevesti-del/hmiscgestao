import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCode, loadSigtap, searchSigtap, type SigtapProc } from '@/lib/sigtap';

/** Busca na tabela SIGTAP; ao escolher, devolve código e descrição oficiais. */
export function SigtapPicker({ onPick, aihOnly, disabled = false }: { onPick: (p: SigtapProc) => void; aihOnly?: boolean; disabled?: boolean }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<SigtapProc[] | null>(null);
  useEffect(() => { void loadSigtap().then(setList); }, []);
  const hits = list && q.trim().length >= 2 ? searchSigtap(list, q, { aihOnly: !!aihOnly }) : [];
  return <div className="relative sm:col-span-2">
    <label className="text-xs">Buscar procedimento SIGTAP (nome ou código)
      <Input disabled={disabled} value={q} onChange={(e) => setQ(e.target.value)} placeholder={list ? 'Ex.: consulta, curativo, sutura, 0301…' : 'Carregando tabela…'} />
    </label>
    {!disabled && hits.length > 0 && <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover text-xs shadow-md">
      {hits.map((p) => <li key={p.c}><Button type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal rounded-none px-2 py-1.5 text-left text-xs" onClick={() => { onPick(p); setQ(''); }}>
        <b>{formatCode(p.c)}</b> · {p.n} {p.v > 0 && <span className="text-muted-foreground">· R$ {p.v.toFixed(2)}</span>}
      </Button></li>)}
    </ul>}
  </div>;
}
