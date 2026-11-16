import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CID_CHAPTERS, DEFAULT_CID_GROUPS, groupCodes } from '@/lib/cid-access';
import { addCidArea, addCidGroup, removeCidArea, removeCidGroup, updateCidArea, useStore } from '@/lib/hospital-store';

const run = (fn: () => void, ok: string) => { try { fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); } };

export function CidAccessSettings() {
  const groups = useStore((s) => s.cidGroups); const areas = useStore((s) => s.cidAreas);
  const [area, setArea] = useState(''); const [label, setLabel] = useState(''); const [ranges, setRanges] = useState<string[]>([]);
  const fixed = new Set(DEFAULT_CID_GROUPS.map((g) => g.id));
  return <section className="space-y-4 rounded-lg border bg-card p-4">
    <div><h2 className="font-semibold">Áreas e acesso ao CID</h2><p className="text-sm text-muted-foreground">Somente administradores liberam o CID e escolhem quais grupos cada área enxerga.</p></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Área</th><th className="p-2">CID liberado</th>{groups.map((g) => <th key={g.id} className="p-2 font-medium">{g.label}</th>)}<th /></tr></thead>
      <tbody>{areas.map((a) => <tr key={a.name} className="border-b">
        <td className="p-2 font-medium">{a.name}</td>
        <td className="p-2"><input type="checkbox" aria-label={`Liberar CID para ${a.name}`} checked={a.enabled} onChange={(e) => run(() => updateCidArea(a.name, { enabled: e.target.checked }), 'Acesso atualizado')} /></td>
        {groups.map((g) => <td key={g.id} className="p-2"><input type="checkbox" disabled={!a.enabled} aria-label={`${g.label} para ${a.name}`} checked={a.groups.includes(g.id)} onChange={(e) => run(() => updateCidArea(a.name, { groups: e.target.checked ? [...a.groups, g.id] : a.groups.filter((x) => x !== g.id) }), 'Acesso atualizado')} /></td>)}
        <td className="p-2"><Button size="icon" variant="ghost" aria-label={`Remover área ${a.name}`} onClick={() => confirm(`Remover a área ${a.name}?`) && run(() => removeCidArea(a.name), 'Área removida')}><Trash2 className="h-4 w-4" /></Button></td>
      </tr>)}</tbody></table></div>
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(() => { addCidArea(area); setArea(''); }, 'Área adicionada'); }}>
      <Input className="max-w-xs" placeholder="Nova área profissional (ex.: Nutrição)" value={area} onChange={(e) => setArea(e.target.value)} /><Button type="submit" variant="outline">Adicionar área</Button></form>
    <p className="text-xs text-muted-foreground">Uma área nova vale para colaboradores cuja função seja "Outro" com o mesmo nome.</p>
    <div className="space-y-2 border-t pt-4"><h3 className="font-medium">Grupos de CID</h3>
      <ul className="flex flex-wrap gap-2">{groups.map((g) => <li key={g.id} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">{g.label} · {groupCodes(g).length} códigos{!fixed.has(g.id) && <button type="button" aria-label={`Remover grupo ${g.label}`} onClick={() => confirm(`Remover o grupo ${g.label}?`) && run(() => removeCidGroup(g.id), 'Grupo removido')}><Trash2 className="h-3 w-3" /></button>}</li>)}</ul>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => { addCidGroup(label, ranges); setLabel(''); setRanges([]); }, 'Grupo criado com os CIDs dos capítulos escolhidos'); }}>
        <Input className="max-w-xs" placeholder="Nova especialidade (ex.: Ortopedia)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">{CID_CHAPTERS.map(([r, n]) => <label key={r} className="flex items-center gap-2"><input type="checkbox" checked={ranges.includes(r)} onChange={(e) => setRanges((x) => e.target.checked ? [...x, r] : x.filter((y) => y !== r))} />{r} · {n}</label>)}</div>
        <Button type="submit" variant="outline">Criar grupo</Button></form>
    </div>
  </section>;
}
