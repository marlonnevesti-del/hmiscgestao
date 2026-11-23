import { releaseHotelariaBed } from "@/lib/hotelaria-beds.functions";
import { useEffect, useState } from 'react';
import { ProcedurePrintButton } from './ProcedurePrint';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EncounterTimeline } from './EncounterTimeline';
import { CidPicker } from './CidPicker';
import { FLOW_LABELS, sortMedicalQueue, type Encounter } from '@/lib/care-flow';
import { BASE_BEDS, can, MANCHESTER, WARDS, type Patient } from '@/lib/hospital-data';
import { callPatient, finishEncounter, psSetDestination, reopenEncounter, requestAdmission, saveMedical, signPrescription, useStore } from '@/lib/hospital-store';
import { cn } from '@/lib/utils';
import { CallPanelButton } from './CallPanelButton';
import { DischargePrint, printDischarge } from './DischargePrint';
import { PhysioRequestButton } from './Physio';
import { ServiceRequestButton } from './ServiceOrders';
import { EvasionButton } from './PsInfantil';
import { PCACR_MAX_MIN, PS_DESTINATIONS, fmtMin, minutes, triagedAt, type PsDestination, type PsEncounter } from '@/lib/ps-infantil';
function action(fn:()=>void) { try { fn(); } catch(err) { toast.error(err instanceof Error?err.message:'Ação não concluída'); } }
const fmtHM = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

export function MedicalQueue({ unit, ps }: { unit?: string; ps?: boolean } = {}) {
  const encounters = useStore((s) => s.encounters) as PsEncounter[];
  const patients = useStore((s) => s.patients);
  const profile = useStore((s) => s.profile);
  const navigate = useNavigate();
  const sadtNames = new Set(useStore((s) => s.ambSpecialties).filter((x) => x.group === 'sadt').map((x) => x.name));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!ps) return; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [ps]);
  const list = sortMedicalQueue(encounters.filter((e) => ['AGUARDANDO_MEDICO', 'EM_ATENDIMENTO_MEDICO', 'EM_OBSERVACAO_REAVALIACAO'].includes(e.status_fluxo) && (!unit || e.type === unit) && !(unit === 'Ambulatório' && sadtNames.has(e.specialty)))) as PsEncounter[];
  return <div className="space-y-4">
    {!unit && <h1 className="text-xl font-semibold">Consultório médico</h1>}
    {!list.length && <p className="py-6 text-muted-foreground">Nenhum paciente aguardando atendimento ou reavaliação.</p>}
    {list.map((e) => {
      const p = patients.find((x) => x.id === e.patientId);
      const wait = ps ? (minutes(triagedAt(e), new Date(now).toISOString()) ?? 0) : 0;
      const late = !!ps && !!e.triage && wait > PCACR_MAX_MIN[e.triage.risk];
      const inConsultation = e.status_fluxo === 'EM_ATENDIMENTO_MEDICO';
      return <section key={e.id} className={cn('border-b py-3', late && 'rounded-lg bg-destructive/5')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <b>{p?.name}</b>
            {e.type === 'Ambulatório' && <span className="ml-2 rounded bg-muted px-2 py-1 text-xs">{e.specialty}</span>}
            <span className={cn('ml-2 rounded px-2 py-1 text-xs', MANCHESTER[e.triage?.risk ?? 'azul'].cls)}>{e.triage?.risk}</span>
            <p className="text-sm text-muted-foreground">{e.complaint} · {p?.weight} kg · {FLOW_LABELS[e.status_fluxo]}</p>
            {e.triage && <div className="text-xs">PA {e.triage.vital.pas}/{e.triage.vital.pad} · FC {e.triage.vital.fc} · FR {e.triage.vital.fr} · Tax {e.triage.vital.tax} · SatO2 {e.triage.vital.sat}% · Dor {e.triage.vital.dor}</div>}
            {ps && <div className="text-xs text-muted-foreground">Classificado {fmtHM(triagedAt(e))} · Espera <span className={late ? 'font-semibold text-destructive' : ''}>{fmtMin(wait)}{late ? ' (acima do PCACR)' : ''}</span>{e.ps?.returnRequestedAt ? ' · retorno médico' : ''}{e.ps?.bed ? ` · leito ${e.ps.bed}` : ''}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ps && !inConsultation && <select aria-label="Consultório de destino" className="h-8 rounded-md border bg-background px-2 text-xs" value={e.ps?.destination ?? 'Consultório pediátrico'} disabled={!can(profile, 'triagem') && !can(profile, 'prescrever')} onChange={(ev) => action(() => psSetDestination(e.id, ev.target.value as PsDestination))}>{PS_DESTINATIONS.map((d) => <option key={d}>{d}</option>)}</select>}
            <CallPanelButton patientId={e.patientId} />
            <ProcedurePrintButton patientId={e.patientId} sector="Consultório médico" />
            {inConsultation ? <Button asChild><Link to="/pacientes/$id" params={{ id: e.patientId }}>Retomar atendimento</Link></Button> : <Button disabled={!can(profile, 'prescrever')} onClick={() => action(() => { callPatient(e.id); void navigate({ to: '/pacientes/$id', params: { id: e.patientId } }); })}>{e.status_fluxo === 'EM_OBSERVACAO_REAVALIACAO' ? 'Reavaliar paciente' : 'Iniciar atendimento'}</Button>}
            {ps && <EvasionButton e={e} />}
          </div>
        </div>
        <EncounterTimeline patientId={e.patientId} />
      </section>;
    })}
  </div>;
}
export function MedicalAssessment({ p }: { p:Patient }) {
  const e=useStore((s)=>s.encounters.slice().reverse().find((x)=>x.patientId===p.id)); const profile=useStore((s)=>s.profile);
  const [f,setF]=useState(e?.medical??{anamnesis:'',exam:'',cid:'',diagnosis:''});
  if(!e) return null;
  return <section className="space-y-3 border-y py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Atendimento médico</h2>{['AGUARDANDO_MEDICO','EM_OBSERVACAO_REAVALIACAO'].includes(e.status_fluxo)&&<Button disabled={!can(profile,'prescrever')} onClick={()=>action(()=>callPatient(e.id))}>Chamar / Reavaliar Paciente</Button>}</div><div className="text-sm">Queixa: {e.complaint} {e.triage&&<>· PA {e.triage.vital.pas}/{e.triage.vital.pad} · FC {e.triage.vital.fc} · FR {e.triage.vital.fr} · Tax {e.triage.vital.tax} · SatO2 {e.triage.vital.sat}% · Dor {e.triage.vital.dor}{e.triage.bcf&&` · BCF ${e.triage.bcf}`}</>}</div><div className="grid gap-3 sm:grid-cols-2"><CidPicker patientType={p.type} value={f.cid} onPick={(c)=>setF((x)=>({...x,cid:c.code,diagnosis:x.diagnosis.trim()?x.diagnosis:c.name}))}/>{([['anamnesis','Anamnese'],['exam','Exame físico'],['cid','CID-10'],['diagnosis','Hipótese diagnóstica']] as const).map(([k,l])=><label key={k} className="grid gap-1 text-xs">{l}{k==='anamnesis'||k==='exam'?<textarea aria-label={l} value={f[k]} onChange={(ev)=>setF((x)=>({...x,[k]:ev.target.value}))} className="min-h-24 rounded-md border bg-background p-2 text-sm"/>:<Input value={f[k]} onChange={(ev)=>setF((x)=>({...x,[k]:ev.target.value}))}/>}</label>)}</div><Button disabled={!can(profile,'prescrever')||e.status_fluxo!=='EM_ATENDIMENTO_MEDICO'} onClick={()=>action(()=>{if(!f.anamnesis.trim()||!f.exam.trim()||!f.cid.trim()||!f.diagnosis.trim())throw new Error('Preencha os dados da avaliação.');saveMedical(e.id,f);toast.success('Avaliação médica registrada');})}>Registrar avaliação médica</Button><div className="flex flex-wrap gap-2"><PhysioRequestButton p={p}/><ServiceRequestButton p={p} kind="raio-x"/><ServiceRequestButton p={p} kind="gesso"/></div><Outcome e={e} p={p}/></section>;
}
export function PrescriptionRelease({ patientId }: { patientId:string }) {
  const e=useStore((s)=>s.encounters.slice().reverse().find((x)=>x.patientId===patientId)); const profile=useStore((s)=>s.profile);
  const count=useStore((s)=>s.patients.find((x)=>x.id===patientId)?.prescriptions.length??0);
  useEffect(()=>{ if(e&&count>0&&can(profile,'prescrever')&&e.status_fluxo==='EM_ATENDIMENTO_MEDICO'&&e.medical?.diagnosis.trim()){ try{signPrescription(e.id);toast.success('Prescrição liberada para farmácia e enfermagem');}catch{/* aguarda dados */} } },[e?.id,e?.status_fluxo,e?.medical?.diagnosis,count,profile]);
  if(!e)return null;
  return <div className="flex flex-wrap items-center gap-3 border-b pb-3">{e.signedAt&&<span className="text-xs text-clinical">Liberada por {e.signedBy} · {new Date(e.signedAt).toLocaleString('pt-BR')}</span>}{!e.signedAt&&<span className="text-xs text-muted-foreground">A prescrição é liberada automaticamente para farmácia e enfermagem ao incluir os itens.</span>}</div>;
}
function Outcome({e,p}:{e:Encounter;p:Patient}) {
  const profile=useStore((s)=>s.profile);const [open,setOpen]=useState(false);const [mode,setMode]=useState<'internacao'|'co'|'exames'|'alta'>('internacao'); const [details,setDetails]=useState({bed:'',summary:'',recipe:'',exam:''});const [adm,setAdm]=useState({ward:'',character:'Urgência' as 'Urgência'|'Eletiva',cid:'',justification:'',isolation:false,oxygen:false});
    return <><Button variant="outline" disabled={!can(profile,'prescrever')||!['EM_ATENDIMENTO_MEDICO','EM_OBSERVACAO_REAVALIACAO','ENCAMINHADO_INTERNACAO','ENCAMINHADO_CO'].includes(e.status_fluxo)} onClick={()=>setOpen(true)}>Encaminhar / Desfecho</Button>{e.discharge&&<section className="space-y-2 border-t py-4"><h3 className="font-semibold">Resumo de alta · {e.number}</h3><p className="whitespace-pre-wrap">{e.discharge.summary}</p><h4 className="font-semibold">Receita domiciliar</h4><p className="whitespace-pre-wrap">{e.discharge.recipe||'Sem receita domiciliar'}</p><p className="text-xs">{e.discharge.by} · {new Date(e.discharge.at).toLocaleString('pt-BR')}</p><Button variant="outline" onClick={printDischarge}>Imprimir alta e receita</Button>{profile==='Administrador'&&e.status_fluxo==='ALTA_HOSPITALAR'&&<Button variant="destructive" className="ml-2" onClick={()=>{const r=window.prompt('Justificativa para desfazer a alta (obrigatória):');if(r==null)return;action(()=>{reopenEncounter(e.id,r);toast.success('Alta desfeita e atendimento reaberto');});}}>Desfazer alta (Admin)</Button>}<DischargePrint e={e} p={p}/></section>}<Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Encaminhar / Desfecho · {p.name}</DialogTitle></DialogHeader><select aria-label="Desfecho" value={mode} onChange={(ev)=>setMode(ev.target.value as typeof mode)} className="h-9 w-full rounded-md border bg-background px-2"><option value="internacao">Solicitar Internação</option>{p.type==='gestante'&&<option value="co">Centro Obstétrico / Sala de Parto</option>}<option value="exames">Encaminhar para Exames</option><option value="alta">Alta Hospitalar / Receituário</option></select>{mode==='internacao'&&<div className="grid gap-2 text-sm">{e.admission?.status==='pendente'&&<p className="text-clinical">Solicitação já enviada ao NIR – aguardando leito.</p>}{e.admission?.status==='recusada'&&<p className="text-destructive">NIR devolveu: {e.admission.note}</p>}<label className="grid gap-1">Caráter<select aria-label="Caráter" value={adm.character} onChange={(ev)=>setAdm((x)=>({...x,character:ev.target.value as 'Urgência'|'Eletiva'}))} className="h-9 rounded-md border bg-background px-2"><option>Urgência</option><option>Eletiva</option></select></label><label className="grid gap-1">CID-10 principal<input value={adm.cid||e.medical?.cid||''} onChange={(ev)=>setAdm((x)=>({...x,cid:ev.target.value}))} className="h-9 rounded-md border bg-background px-2"/></label><label className="grid gap-1">Justificativa clínica<textarea value={adm.justification} onChange={(ev)=>setAdm((x)=>({...x,justification:ev.target.value}))} className="min-h-20 rounded-md border bg-background p-2"/></label><label className="flex items-center gap-2"><input type="checkbox" checked={adm.isolation} onChange={(ev)=>setAdm((x)=>({...x,isolation:ev.target.checked}))}/>Precisa de isolamento</label><label className="flex items-center gap-2"><input type="checkbox" checked={adm.oxygen} onChange={(ev)=>setAdm((x)=>({...x,oxygen:ev.target.checked}))}/>Precisa de oxigênio</label></div>}{mode==='co'&&<p className="text-sm text-maternal">Urgência Obstétrica · agenda do Centro Obstétrico</p>}{mode==='exames'&&<label className="grid gap-1 text-sm">Exame solicitado<select aria-label="Exame solicitado" value={details.exam} onChange={(ev)=>setDetails((x)=>({...x,exam:ev.target.value}))} className="h-9 rounded-md border bg-background px-2"><option value="">Selecionar exame</option>{['Laboratório','Imagem','Cardiotocografia'].map((t)=><option key={t}>{t}</option>)}</select></label>}{mode==='alta'&&<><label className="grid gap-1 text-xs">Resumo de alta<textarea value={details.summary} onChange={(ev)=>setDetails((x)=>({...x,summary:ev.target.value}))} className="min-h-24 rounded-md border bg-background p-2"/></label><label className="grid gap-1 text-xs">Receita domiciliar<textarea value={details.recipe} onChange={(ev)=>setDetails((x)=>({...x,recipe:ev.target.value}))} className="min-h-24 rounded-md border bg-background p-2"/></label></>}<Button onClick={()=>{const msg=mode==='alta'?`Atenção: a alta encerrará o ${e.fia?.number??e.number} e liberará o leito de ${p.name}. Confirmar alta?`:mode==='internacao'?`Confirmar envio da solicitação de leito ao NIR para ${p.name}?`:mode==='co'?`Confirmar encaminhamento de ${p.name} ao Centro Obstétrico?`:`Confirmar encaminhamento de ${p.name} para exames?`;if(!window.confirm(msg))return;action(()=>{if(mode==='internacao'){requestAdmission(e.id,adm);setOpen(false);toast.success('Solicitação enviada ao NIR');return;}const prevBed=p.bed;finishEncounter(e.id,mode,details);setOpen(false);toast.success('Desfecho registrado e setores atualizados');if(mode==='alta'){printDischarge();if(prevBed&&!BASE_BEDS.some((b)=>b.id===prevBed))void releaseHotelariaBed({data:{codigo:prevBed}}).then((r)=>r.ok?toast.success(r.message):toast.warning(r.message)).catch(()=>toast.warning('Sem comunicação com a Hotelaria.'));}});}}>Confirmar desfecho</Button></DialogContent></Dialog></>;
}