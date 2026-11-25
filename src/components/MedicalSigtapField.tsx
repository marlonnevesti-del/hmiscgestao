import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { can } from '@/lib/hospital-data';
import type { Encounter } from '@/lib/care-flow';
import { setMedicalSigtapCode, useStore } from '@/lib/hospital-store';
import { medicalSigtapCode, validMedicalSigtap } from '@/lib/medical-sigtap';
import { formatCode, loadSigtap, type SigtapProc } from '@/lib/sigtap';
import { SigtapPicker } from './SigtapPicker';
import { cn } from '@/lib/utils';

export function MedicalSigtapField({ encounter }: { encounter: Encounter }) {
  const profile = useStore((s) => s.profile);
  const [catalog, setCatalog] = useState<SigtapProc[]>([]);
  const id = useId();
  useEffect(() => { void loadSigtap().then(setCatalog); }, []);
  const code = medicalSigtapCode(encounter.sigtapCode);
  const invalid = !validMedicalSigtap(code);
  const editable = can(profile, 'prescrever') && ['EM_ATENDIMENTO_MEDICO', 'EM_OBSERVACAO_REAVALIACAO', 'ENCAMINHADO_INTERNACAO', 'ENCAMINHADO_CO'].includes(encounter.status_fluxo);
  const procedure = catalog.find((p) => p.c === code);
  return <div className="space-y-2">
    <SigtapPicker disabled={!editable} onPick={(p) => setMedicalSigtapCode(encounter.id, p.c)} />
    <label htmlFor={id} className="text-xs font-medium">Procedimento SIGTAP *</label>
    <div className="flex items-center gap-2">
      <Input id={id} readOnly value={formatCode(code)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} className={cn('min-w-0 flex-1 font-mono', invalid && 'border-destructive')} />
      <Button type="button" variant="ghost" size="icon" title="Limpar procedimento SIGTAP" aria-label="Limpar procedimento SIGTAP" disabled={!editable || !code} onClick={() => setMedicalSigtapCode(encounter.id, '')}><X className="h-4 w-4" /></Button>
    </div>
    {procedure && <p className="text-xs text-muted-foreground">{procedure.n}</p>}
    {invalid && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">Informe o procedimento SIGTAP para concluir o atendimento.</p>}
  </div>;
}