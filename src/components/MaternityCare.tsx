import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { canAccessUnitTab, canAct } from '@/lib/hospital-data';
import { saveMaternityRecord, useStore } from '@/lib/hospital-store';
import { BIRTH_PHASES, BISHOP_FIELDS, SILVERMAN_FIELDS, MEOWS_NUMBERS, HPP_FACTORS, MATERNITY_LABELS, maternityResult, type MaternityKind, type MaternityRecord } from '@/lib/maternity';
import { CO_BEDS } from '@/lib/surgical-center';
import { FLOW_LABELS } from '@/lib/care-flow';
import { cn } from '@/lib/utils';
import { InpatientList } from './InpatientList';

const selectClass = 'min-h-9 w-full min-w-0 rounded-md border bg-background px-2 py-1 text-sm';
const kinds: MaternityKind[] = ['checklist', 'meows', 'bishop', 'silverman', 'hpp'];

export function MaternityCare({ patientId }: { patientId?: string }) {
  const patients = useStore((s) => s.patients);
  const encounters = useStore((s) => s.encounters);
  const profile = useStore((s) => s.profile);
  const areas = useStore((s) => s.accessAreas);
  const [pick, setPick] = useState('');
  const [kind, setKind] = useState<MaternityKind>('checklist');
  const target = patients.find((p) => p.id === patientId);
  const maternalId = target?.type === 'neonato' ? target.newborn?.motherId : patientId;
  const linked = encounters.filter((e) => e.type === 'Maternidade' && (!patientId || e.patientId === maternalId || e.patientId === patientId)).slice().reverse();
  const e = patientId ? linked.find((x) => x.status_fluxo !== 'ALTA_HOSPITALAR') ?? linked[0] : linked.find((x) => x.id === pick);
  const p = patients.find((x) => x.id === e?.patientId);
  const canView = canAccessUnitTab(profile, 'maternidade', 'assistencia', areas);
  const canEdit = canView && (canAct(profile, 'triagem', areas) || canAct(profile, 'prescrever', areas));
  const newbornOnly = target?.type === 'neonato' || p?.type === 'neonato';
  const activeKind = newbornOnly ? 'silverman' : kind;
  if (!canView) return <p className="text-sm text-muted-foreground">Sem acesso às avaliações da Maternidade.</p>;
  return <div className="space-y-4">
    {!patientId && <label className="block max-w-xl space-y-1 text-sm">Paciente / atendimento<select aria-label="Paciente / atendimento" className={selectClass} value={pick} onChange={(event) => setPick(event.target.value)}><option value="">Selecionar…</option>{linked.map((x) => <option key={x.id} value={x.id}>{patients.find((a) => a.id === x.patientId)?.name} · {x.fia?.number || x.number}{x.status_fluxo === 'ALTA_HOSPITALAR' ? ' · encerrado' : ''}</option>)}</select></label>}
    {!e || !p ? <p className="py-4 text-sm text-muted-foreground">{linked.length ? 'Nenhum atendimento selecionado.' : 'Nenhum atendimento da Maternidade registrado.'}</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"><div><h3 className="font-semibold">{p.name}</h3><div className="text-xs text-muted-foreground">{e.fia?.number || e.number} · {FLOW_LABELS[e.status_fluxo]}</div></div><Button asChild size="sm" variant="outline"><Link to="/pacientes/$id" params={{ id: p.id }}>Prontuário</Link></Button></div>
      <Tabs value={activeKind} onValueChange={(value) => setKind(value as MaternityKind)}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1">{kinds.filter((k) => !newbornOnly || k === 'silverman').map((k) => <TabsTrigger key={k} value={k} className="whitespace-normal text-left">{MATERNITY_LABELS[k]}</TabsTrigger>)}</TabsList>
        {kinds.map((k) => <TabsContent key={k} value={k}><AssessmentForm key={`${e.id}:${patientId ?? p.id}:${k}`} kind={k} encounterId={e.id} motherId={p.id} {...(patientId ? { initialTargetId: patientId } : {})} readOnly={!canEdit || e.status_fluxo === 'ALTA_HOSPITALAR'} /></TabsContent>)}
      </Tabs>
      <section className="space-y-2 border-t pt-3"><h3 className="font-semibold">Histórico de avaliações</h3>{(e.maternity ?? []).filter((r) => !patientId || r.patientId === patientId).slice().reverse().map((r) => <RecordDetails key={r.id} record={r} name={patients.find((x) => x.id === r.patientId)?.name ?? ''} />)}{!(e.maternity ?? []).some((r) => !patientId || r.patientId === patientId) && <p className="text-sm text-muted-foreground">Sem avaliações registradas.</p>}</section>
    </>}
  </div>;
}

function AssessmentForm({ kind, encounterId, motherId, initialTargetId, readOnly }: { kind: MaternityKind; encounterId: string; motherId: string; initialTargetId?: string; readOnly: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(kind === 'checklist' ? { phase: 'admissao' } : {});
  const [notes, setNotes] = useState('');
  const patients = useStore((s) => s.patients);
  const [targetId, setTargetId] = useState(initialTargetId && patients.some((p) => p.id === initialTargetId && p.type === 'neonato') ? initialTargetId : '');
  const mother = patients.find((p) => p.id === motherId);
  const babies = patients.filter((p) => p.type === 'neonato' && (p.id === motherId || mother?.babyIds?.includes(p.id) || p.newborn?.motherId === motherId));
  const set = (id: string, value: string) => setValues((v) => ({ ...v, [id]: value }));
  const fields = kind === 'bishop' ? BISHOP_FIELDS : kind === 'silverman' ? SILVERMAN_FIELDS : [];
  const phase = BIRTH_PHASES.find((x) => x.id === values['phase']);
  let preview = ''; try { preview = maternityResult(kind, values); } catch { /* An incomplete assessment never receives a reassuring score. */ }
  const select = (id: string, label: string, options: { label: string; value: string }[]) => <label key={id} className="block min-w-0 space-y-1 text-sm">{label}<select aria-label={label} className={selectClass} value={values[id] ?? ''} onChange={(event) => set(id, event.target.value)}><option value="">Selecionar…</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  return <div className="space-y-3">
    <h3 className="font-semibold">{MATERNITY_LABELS[kind]}</h3>
    <p className="text-xs text-muted-foreground">{kind === 'meows' ? 'MEOWS CEMACH / Singh (2012) · 1 gatilho vermelho ou 2 amarelos requerem avaliação clínica. Dor MEOWS 0–3 não equivale à EVA 0–10.' : kind === 'hpp' ? 'CMQCC v3.0 (2022) · reavaliar ao longo do atendimento. Risco não determina transfusão automática.' : kind === 'checklist' ? 'OMS (2015), adaptado · condutas conforme indicação e protocolo institucional.' : kind === 'silverman' ? 'Silverman-Andersen · 0–10. Apneia, cianose e esforço respiratório inadequado exigem avaliação imediata, independentemente do total.' : 'Bishop completo · 0–13. O resultado não é indicação isolada de indução.'}</p>
    <fieldset disabled={readOnly} className="space-y-3">
      {kind === 'silverman' && <label className="block max-w-xl space-y-1 text-sm">Recém-nascido<select aria-label="Recém-nascido" className={selectClass} value={targetId} onChange={(event) => { setTargetId(event.target.value); setValues({}); }}><option value="">Selecionar RN vinculado…</option>{babies.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.prontuario}</option>)}</select></label>}
      {kind === 'checklist' && <><label className="block max-w-xl space-y-1 text-sm">Momento do checklist<select aria-label="Momento do checklist" className={selectClass} value={values['phase'] ?? ''} onChange={(event) => setValues({ phase: event.target.value })}>{BIRTH_PHASES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label><div className="grid gap-3 md:grid-cols-2">{phase?.items.map((label, i) => select(String(i), label, [{ value: 'feito', label: 'Verificado / conduta registrada' }, { value: 'pendente', label: 'Pendente' }, { value: 'na', label: 'Não aplicável / sem indicação' }]))}</div></>}
      <div className="grid gap-3 md:grid-cols-2">{fields.map((f) => select(f.id, f.label, f.options.map((o, i) => ({ value: String(i), label: `${o.label} (${o.score})` }))))}
      {kind === 'meows' && <>{MEOWS_NUMBERS.map((f) => <label key={f.id} className="space-y-1 text-sm">{f.label}<Input aria-label={f.label} type="number" min={f.min} max={f.max} step={f.id === 'temp' ? '0.1' : '1'} value={values[f.id] ?? ''} onChange={(event) => set(f.id, event.target.value)} /></label>)}{select('pain', 'Dor — grau da ficha MEOWS (0–3)', ['0', '1', '2', '3'].map((v) => ({ value: v, label: `Grau ${v}` })))}{select('avpu', 'Resposta neurológica (AVPU)', [{ value: 'A', label: 'Alerta' }, { value: 'V', label: 'Responde à voz' }, { value: 'P', label: 'Responde à dor' }, { value: 'U', label: 'Não responde' }])}</>}
      {kind === 'hpp' && HPP_FACTORS.map((f) => select(f.id, f.label, [{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]))}</div>
      <label className="block space-y-1 text-sm">Observações / conduta / justificativa<Textarea aria-label="Observações / conduta / justificativa" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {preview && <output className={cn('block border-l-4 bg-muted p-3 text-sm font-semibold', preview.includes('acionar') || preview.includes('Risco Alto') ? 'border-destructive text-destructive' : 'border-primary')} aria-live="polite">{preview}</output>}
      {!readOnly && <Button disabled={!preview || (kind === 'silverman' && !targetId)} onClick={() => { try { saveMaternityRecord(encounterId, kind === 'silverman' ? targetId : motherId, kind, values, notes); toast.success('Avaliação registrada no prontuário; confira a confirmação de sincronização.'); setValues(kind === 'checklist' ? { phase: values['phase'] ?? 'admissao' } : {}); setNotes(''); } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível registrar.'); } }}>Registrar avaliação</Button>}
    </fieldset>
    {readOnly && <p className="text-sm text-muted-foreground">Somente visualização.</p>}
  </div>;
}

function RecordDetails({ record: r, name }: { record: MaternityRecord; name: string }) {
  const fields = r.kind === 'bishop' ? BISHOP_FIELDS : r.kind === 'silverman' ? SILVERMAN_FIELDS : [];
  const phase = BIRTH_PHASES.find((p) => p.id === r.values['phase']);
  const label = (key: string) => fields.find((f) => f.id === key)?.label ?? MEOWS_NUMBERS.find((f) => f.id === key)?.label ?? HPP_FACTORS.find((f) => f.id === key)?.label ?? (r.kind === 'checklist' ? phase?.items[Number(key)] : undefined) ?? ({ pain: 'Dor MEOWS', avpu: 'AVPU' }[key as 'pain' | 'avpu'] || key);
  const value = (key: string, raw: string) => fields.find((f) => f.id === key)?.options[Number(raw)]?.label ?? ({ sim: 'Sim', nao: 'Não', feito: 'Verificado / conduta registrada', pendente: 'Pendente', na: 'Não aplicável' } as Record<string, string>)[raw] ?? raw;
  return <details className="border-b py-2 text-sm"><summary className="cursor-pointer break-words"><b>{MATERNITY_LABELS[r.kind]}</b> · {name} · {r.result}<span className="block text-xs text-muted-foreground">{new Date(r.at).toLocaleString('pt-BR')} · {r.by}</span></summary><dl className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(r.values).filter(([key]) => key !== 'phase').map(([key, raw]) => <div key={key}><dt className="text-xs text-muted-foreground">{label(key)}</dt><dd>{value(key, raw)}</dd></div>)}</dl>{r.notes && <p className="mt-2 whitespace-pre-wrap">{r.notes}</p>}</details>;
}

/** Existing CO assignments only; an unassigned place is not confirmed available by Hotelaria. */
export function MaternityObservation() {
  const surgeries = useStore((s) => s.surgeries);
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const beds = [...new Set([...CO_BEDS, ...encounters.filter((e) => e.type === 'Maternidade' && e.fia && e.status_fluxo !== 'ALTA_HOSPITALAR').map((e) => e.fia?.bed ?? '').filter(Boolean)])];
  return <div className="space-y-4"><h3 className="font-semibold">Centro Obstétrico / Maternidade</h3><p className="text-xs text-muted-foreground">Ocupação clínica registrada · disponibilidade e reservas confirmadas pelo NIR.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{beds.map((bed) => {
    const surgery = surgeries.find((s) => s.coBed === bed && s.status !== 'Finalizado');
    const encounter = encounters.find((e) => e.type === 'Maternidade' && e.status_fluxo !== 'ALTA_HOSPITALAR' && e.fia?.bed === bed);
    const patient = patients.find((p) => p.id === (surgery?.patientId ?? encounter?.patientId));
    return <article key={bed} className="space-y-2 rounded-lg border bg-card p-3"><h4 className="font-semibold">{bed}</h4><p className="break-words text-sm">{patient?.name ?? surgery?.patient ?? (encounter ? 'Ocupação registrada' : 'Sem alocação clínica registrada')}</p>{encounter && <p className="text-xs text-muted-foreground">{encounter.fia?.number} · {FLOW_LABELS[encounter.status_fluxo]}</p>}{patient && <Button asChild size="sm" variant="outline"><Link to="/pacientes/$id" params={{ id: patient.id }}>Prontuário</Link></Button>}</article>;
  })}</div><h3 className="font-semibold">Internações da Maternidade</h3><InpatientList unit="Maternidade" /></div>;
}