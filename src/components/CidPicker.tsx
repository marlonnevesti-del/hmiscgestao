import { useState } from 'react';
import { allowedGroups, groupCodes } from '@/lib/cid-access';
import { defaultSpecialty, type Cid } from '@/lib/cid10';
import { useStore } from '@/lib/hospital-store';

export function CidPicker({ patientType, value, onPick }: { patientType: string; value: string; onPick: (c: Cid) => void }) {
  const { cidGroups, cidAreas, employeeArea, profile } = useStore((s) => s);
  const groups = allowedGroups(cidAreas, cidGroups, employeeArea, profile === 'Administrador');
  const preferred = defaultSpecialty(patientType);
  const [picked, setPicked] = useState('');
  if (!groups) return <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground sm:col-span-2">O CID não está liberado para sua área. Peça ao administrador.</div>;
  if (!groups.length) return <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground sm:col-span-2">Nenhum grupo de CID liberado para sua área.</div>;
  const groupId = groups.some((g) => g.id === picked) ? picked : (groups.find((g) => g.specialty === preferred) ?? groups[0])!.id;
  const codes = groupCodes(groups.find((g) => g.id === groupId)!);
  const sel = 'h-9 rounded-md border bg-background px-2 text-sm';
  return <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
    <label className="grid gap-1 text-xs">Grupo do CID<select aria-label="Grupo do CID" className={sel} value={groupId} onChange={(e) => setPicked(e.target.value)}>{groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
    <label className="grid gap-1 text-xs">Código CID-10<select aria-label="Código CID-10" className={sel} value={codes.some((c) => c.code === value) ? value : ''} onChange={(e) => { const c = codes.find((x) => x.code === e.target.value); if (c) onPick(c); }}>
      <option value="">Selecione o CID…</option>{codes.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select></label>
  </div>;
}
