import { beforeEach, describe, expect, it } from 'vitest';
import { BASE_BEDS, type Patient } from './hospital-data';
import { transition, sortMedicalQueue, type Encounter, type Triage } from './care-flow';
import { addStock, adjustStock, callPatient, completeTriage, createStockMedication, dispenseKit, finishEncounter, requestAdmission, authorizeAdmission, rejectAdmission, getState, openEncounter, recordMedication, saveMedical, setState, signPrescription, updatePatient, validatePrescription } from './hospital-store';
const patient=():Patient=>({id:'care-p',prontuario:'PR-1',name:'Teste clínico',cpf:'',type:'pediatria',age:'2 anos',weight:0,allergies:[],risks:[],ward:'PSP',bed:'',insurance:'SUS',authorized:true,diagnosis:'',admission:'',days:1,evolutions:[],vitals:[],prescriptions:[]});
const triage=():Triage=>({risk:'amarelo',weight:12,vital:{time:'14:08',pas:90,pad:60,fc:100,fr:20,tax:37,sat:98,dor:2,ingesta:0,diurese:0,vomitos:0},complaint:'Febre',allergies:['Dipirona'],ig:'',dum:'',bcf:'',contractions:'',fluid:'',bleeding:'',height:'85',head:'',guardian:'Responsável'});
let id='';
function medical(){const e=openEncounter(patient(),'Pronto-Socorro Pediátrico','Pediatria','Febre');id=e.id;completeTriage(id,triage());callPatient(id);saveMedical(id,{anamnesis:'Febre',exam:'Exame clínico',cid:'R50.9',diagnosis:'Febre'});updatePatient('care-p',()=>({prescriptions:[{id:'dose',cat:'Medicamento',item:'Paracetamol 180 mg',posologia:'VO',times:['14:00','18:00','22:00']}]}));}
function dispensed(){medical();signPrescription(id);validatePrescription(id,'dose');addStock('Paracetamol',3);dispenseKit(id,'Conferido',{dose:'L1'});}
beforeEach(()=>setState(()=>({profile:'Administrador',employeeName:'Profissional verificado',patients:[],queue:[],encounters:[],surgeries:[],admins:{},stock:[],beSequence:0,fiaSequence:0})));
describe('esteira do BE',()=>{
  it('abertura gera BE sequencial e aguarda triagem',()=>{const e=openEncounter(patient(),'Pronto-Socorro Pediátrico','Pediatria','Febre');expect(e.number).toMatch(/BAA-\d{4}-000001/);expect(e.status_fluxo).toBe('AGUARDANDO_TRIAGEM');expect(getState().queue[0]?.id).toBe(e.id);});
  it('impede dois BEs ativos para mesmo paciente',()=>{openEncounter(patient(),'PSP','Pediatria','Febre');expect(()=>openEncounter(patient(),'PSP','Pediatria','Febre')).toThrow('BAA ativo');});
  it('triagem exige peso pediátrico',()=>{const e=openEncounter(patient(),'PSP','Pediatria','Febre');expect(()=>completeTriage(e.id,{...triage(),weight:0})).toThrow('Peso atual obrigatório');expect(getState().encounters[0]?.status_fluxo).toBe('AGUARDANDO_TRIAGEM');});
  it('triagem transporta alergia, peso e sinais e retira da fila',()=>{medical();expect(getState().queue).toHaveLength(0);expect(getState().patients[0]?.allergies).toEqual(['Dipirona']);expect(getState().patients[0]?.weight).toBe(12);expect(getState().patients[0]?.vitals[0]?.sat).toBe(98);expect(getState().encounters[0]?.status_fluxo).toBe('EM_ATENDIMENTO_MEDICO');});
  it('ordena médico por gravidade e chegada',()=>{medical();const e=getState().encounters[0];if(!e)throw new Error('Fixture');const rows:Encounter[]=[{...e,id:'azul',triage:{...triage(),risk:'azul'}},{...e,id:'tarde',openedAt:'2026-11-14T15:00:00Z',triage:{...triage(),risk:'vermelho'}},{...e,id:'cedo',openedAt:'2026-11-14T14:00:00Z',triage:{...triage(),risk:'vermelho'}}];expect(sortMedicalQueue(rows).map((x)=>x.id)).toEqual(['cedo','tarde','azul']);});
  it('somente a liberação da prescrição libera a farmácia',()=>{medical();expect(getState().encounters[0]?.status_fluxo).toBe('EM_ATENDIMENTO_MEDICO');signPrescription(id);expect(getState().encounters[0]?.status_fluxo).toBe('AGUARDANDO_FARMACIA');expect(getState().encounters[0]?.signedBy).toBe('Profissional verificado');});
  it('dispensação exige validação de todo kit',()=>{medical();signPrescription(id);addStock('Paracetamol',3);expect(()=>dispenseKit(id,'')).toThrow('Valide todos');});
  it('dispensação exige lote de cada item',()=>{medical();signPrescription(id);validatePrescription(id,'dose');addStock('Paracetamol',3);expect(()=>dispenseKit(id,'')).toThrow('lote');});
  it('estoque insuficiente não avança etapa',()=>{medical();signPrescription(id);validatePrescription(id,'dose');expect(()=>dispenseKit(id,'',{dose:'L1'})).toThrow('Estoque insuficiente');expect(getState().encounters[0]?.status_fluxo).toBe('AGUARDANDO_FARMACIA');});
  it('dispensação abate estoque e libera enfermagem',()=>{dispensed();expect(getState().stock.find((item)=>item.name==='paracetamol')?.quantity).toBe(0);expect(getState().encounters[0]?.status_fluxo).toBe('AGUARDANDO_MEDICACAO');expect(getState().patients[0]?.prescriptions[0]?.pharmacy).toBe('Dispensada');});
  it('não permite checagem antes da dispensação',()=>{medical();signPrescription(id);expect(()=>recordMedication(id,'dose','14:00','checado')).toThrow('não liberada');});
  it('todas as doses checadas devolvem paciente à reavaliação',()=>{dispensed();recordMedication(id,'dose','14:00','checado');expect(getState().encounters[0]?.status_fluxo).toBe('AGUARDANDO_MEDICACAO');recordMedication(id,'dose','18:00','checado');recordMedication(id,'dose','22:00','checado');expect(getState().encounters[0]?.status_fluxo).toBe('EM_OBSERVACAO_REAVALIACAO');expect(getState().admins['care-p|dose|22:00']?.by).toBe('Profissional verificado');expect(Date.parse(getState().admins['care-p|dose|22:00']?.at??'')).not.toBeNaN();});
  it('dose checada não pode ser repetida',()=>{dispensed();recordMedication(id,'dose','14:00','checado');expect(()=>recordMedication(id,'dose','14:00','checado')).toThrow('já checada');});
  it('internação ocupa leito e alta o libera preservando BE',()=>{medical();finishEncounter(id,'internacao',{bed:'ENFP-01',summary:'',recipe:'',exam:''});expect(getState().patients[0]?.bed).toBe('ENFP-01');expect(getState().encounters[0]?.status_fluxo).toBe('ENCAMINHADO_INTERNACAO');finishEncounter(id,'alta',{summary:'Estável',recipe:'Orientações',exam:''});expect(getState().patients[0]?.bed).toBe('');expect(getState().encounters[0]?.status_fluxo).toBe('ALTA_HOSPITALAR');expect(getState().encounters[0]?.discharge?.summary).toBe('Estável');});
  it('encaminhamento gestante integra agenda obstétrica',()=>{const e=openEncounter({...patient(),type:'gestante'},'PSO','Obstetrícia','Contrações');completeTriage(e.id,triage());callPatient(e.id);finishEncounter(e.id,'co',{summary:'',recipe:'',exam:''});expect(getState().encounters[0]?.status_fluxo).toBe('ENCAMINHADO_CO');expect(getState().surgeries[0]?.patientId).toBe('care-p');});
  it('internação encerra BAA e abre FIA sequencial com dados do médico',()=>{medical();requestAdmission(id,{ward:'',character:'Urgência',cid:'J18.9',justification:'Pneumonia',isolation:false,oxygen:true});authorizeAdmission(id,'ENFP-01');const e=getState().encounters[0];expect(e?.fia?.number).toMatch(/^FIA-\d{4}-000001$/);expect(e?.baaClosedAt).toBeTruthy();expect(e?.fia?.cid).toBe('J18.9');expect(e?.fia?.doctor).toBe('Profissional verificado');expect(e?.fia?.bed).toBe('ENFP-01');});
  it('exames mantêm observação com pendência',()=>{medical();finishEncounter(id,'exames',{exam:'Laboratório',summary:'',recipe:''});expect(getState().encounters[0]?.examPending).toBe('Laboratório');expect(getState().encounters[0]?.status_fluxo).toBe('EM_OBSERVACAO_REAVALIACAO');});
  it('impede salto de triagem direto para alta',()=>{const e=openEncounter(patient(),'PSP','Pediatria','Febre');expect(()=>transition(e,'ALTA_HOSPITALAR','Médico')).toThrow();});
  it('leitos começam livres sem ocupantes fictícios',()=>expect(BASE_BEDS.every((b)=>b.status==='livre')).toBe(true));
  it('recepção não classifica risco',()=>{setState(()=>({profile:'Recepção'}));const e=openEncounter(patient(),'PSP','Pediatria','Febre');expect(()=>completeTriage(e.id,triage())).toThrow('perfil');});
  it('reclassifica quem já aguarda médico sem duplicar o BE',()=>{const e=openEncounter(patient(),'PSP','Pediatria','Febre');completeTriage(e.id,triage());completeTriage(e.id,{...triage(),risk:'vermelho',maxWait:0});expect(getState().encounters).toHaveLength(1);expect(getState().encounters[0]?.triage?.risk).toBe('vermelho');expect(getState().encounters[0]?.history.at(-1)?.note).toContain('Reclassificação');});
  it('cadastra medicamento com apresentação e estoque mínimo',()=>{createStockMedication({name:'Ondansetrona 8 mg/4 mL',presentation:'Ampola',unit:'amp',quantity:15,minimum:20});const item=getState().stock[0];expect(item).toMatchObject({name:'Ondansetrona 8 mg/4 mL',presentation:'Ampola',unit:'amp',quantity:15,minimum:20});adjustStock(item!.id,5);expect(getState().stock[0]?.quantity).toBe(20);expect(()=>adjustStock(item!.id,-21)).toThrow('negativo');});
});describe('NIR', () => {
  it('solicitação médica vai ao NIR sem ocupar leito e NIR autoriza', () => {
    medical();
    requestAdmission(id, { ward: 'ENFP', character: 'Urgência', cid: '', justification: 'Desidratação', isolation: true, oxygen: false });
    expect(getState().encounters[0]?.admission?.status).toBe('pendente');
    expect(getState().patients[0]?.bed).toBe('');
    expect(() => requestAdmission(id, { ward: 'ENFP', character: 'Urgência', cid: '', justification: 'x', isolation: false, oxygen: false })).toThrow();
    authorizeAdmission(id, 'ENFP-01');
    expect(getState().patients[0]?.bed).toBe('ENFP-01');
    expect(getState().encounters[0]?.status_fluxo).toBe('ENCAMINHADO_INTERNACAO');
    expect(getState().encounters[0]?.admission?.status).toBe('autorizada');
  });
  it('NIR devolve com motivo obrigatório', () => {
    medical();
    requestAdmission(id, { ward: 'AC', character: 'Eletiva', cid: '', justification: 'Obs', isolation: false, oxygen: false });
    expect(() => rejectAdmission(id, '')).toThrow();
    rejectAdmission(id, 'Sem critério');
    expect(getState().encounters[0]?.admission?.status).toBe('recusada');
  });
});
