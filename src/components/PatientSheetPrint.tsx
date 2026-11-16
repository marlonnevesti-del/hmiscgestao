import { createPortal } from 'react-dom';
import type { Encounter } from '@/lib/care-flow';
import { WARDS, type Patient } from '@/lib/hospital-data';
import { registrationFor } from '@/lib/patient-registration-mapping';
import { patientAge } from '@/lib/patient-registration';
import { Letterhead } from './DischargePrint';

export type SheetKind = 'BAA' | 'FIA';

/** Imprime somente a Ficha do Paciente (BAA ou FIA). */
export function printSheet(kind: SheetKind) {
  document.body.classList.add('print-sheet');
  document.body.dataset['sheet'] = kind;
  const done = () => { document.body.classList.remove('print-sheet'); delete document.body.dataset['sheet']; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}

const fmt = (d?: string) => (d ? new Date(d).toLocaleString('pt-BR') : '');
const fmtDate = (d?: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR') : '');
const F = ({ l, v }: { l: string; v?: string | undefined }) => <span className="sheet-f"><b>{l}:</b> {v || ''}</span>;

function Sheet({ kind, p, e, user }: { kind: SheetKind; p: Patient; e?: Encounter | undefined; user: string }) {
  const r = registrationFor(p);
  const addr = r.addresses.find((a) => a.primary) ?? r.addresses[0];
  const cel = r.phones.find((x) => /cel/i.test(x.type)) ?? r.phones[0];
  const tel = r.phones.find((x) => x !== cel);
  const phone = (x?: { areaCode: string; number: string }) => x?.number ? `(${x.areaCode})${x.number}` : '( )';
  const year = new Date(e?.openedAt ?? Date.now()).getFullYear();
  const num = e?.number ?? '';
  const ward = WARDS.find((w) => w.id === p.ward)?.name ?? '';
  const [room, bed] = (p.bed || '').split('-');
  const doctor = e?.signedBy ?? e?.history.find((h) => h.status === 'EM_ATENDIMENTO_MEDICO')?.by ?? '';
  const guardian = r.guardian || p.guardian || (p.type === 'gestante' || p.type === 'puerpera' ? '' : r.parent1);
  return <section className="doc-page sheet-page" data-kind={kind}>
    <div className="sheet-user">Usuário: {user} {new Date().toLocaleString('pt-BR')}</div>
    <Letterhead title={kind === 'FIA' ? 'Ficha do Paciente - Internação' : 'Ficha do Paciente'} />
    <h3>Dados do Atendimento</h3>
    <div className="sheet-row"><F l={`Atendimento ${kind}`} v={num && `${num} / ${year}`} /><F l="Unidade" v={kind === 'FIA' ? ward : ''} /><F l="Quarto" v={kind === 'FIA' ? room : ''} /><F l="Leito" v={kind === 'FIA' ? bed : ''} /></div>
    <div className="sheet-row"><F l="Convênio" v={r.insurance || p.insurance} /><F l="Data da Chegada" v={fmt(e?.openedAt)} /></div>
    <div className="sheet-row"><F l="Setor" v={e ? `Recepção ${e.type}` : ''} /><F l="Tipo" v={e?.specialty} /></div>
    <h3>Dados do Paciente</h3>
    <div className="sheet-row"><F l="Nome" v={`${p.prontuario} - ${p.name}`} /></div>
    <div className="sheet-row"><F l="Nascimento" v={fmtDate(r.birthDate)} /><F l="Idade" v={patientAge(r) || p.age} /><F l="Sexo" v={r.sex} /><F l="Estado Civil" v={r.maritalStatus || 'Não informado'} /></div>
    <div className="sheet-row"><F l="Telefone" v={phone(tel)} /><F l="Celular" v={phone(cel)} /><F l="Raça/Cor" v={r.skinColor} /><F l="Religião" v={r.religion} /></div>
    <div className="sheet-row"><F l="Nome do Cônjuge" v={r.spouse} /></div>
    <div className="sheet-row"><F l="Profissão" v={r.profession} /></div>
    <div className="sheet-row"><F l="Nome do Pai" v={r.parent2} /></div>
    <div className="sheet-row"><F l="Nome da Mãe" v={r.parent1 || p.motherName} /></div>
    <div className="sheet-row"><F l="Médico Responsável" v={doctor} /></div>
    <h3>Documentos</h3>
    <div className="sheet-row"><F l="CPF" v={r.cpf || p.cpf} /><F l="CNS" v={r.cns} /><F l="Identidade" v={r.identityDocument} /><F l="Órg.Emissor" /></div>
    <h3>Endereço</h3>
    <div className="sheet-row"><F l="Logradouro" v={addr && [addr.streetType, addr.street].filter(Boolean).join(' ') + (addr.number ? `, ${addr.number}` : '')} /></div>
    <div className="sheet-row"><F l="Bairro" v={addr?.neighborhood} /><F l="CEP" v={addr?.postalCode} /></div>
    <div className="sheet-row"><F l="Cidade" v={addr?.city} /><F l="UF" v={addr?.state} /></div>
    <div className="sheet-row"><F l="Complemento" v={addr?.complement} /></div>
    <div className="sheet-cols">
      <div><h3>Observação</h3><p className="pre">{[r.observation1, r.observation2].filter(Boolean).join('\n')}</p></div>
      <div><h3>Procedimentos</h3><p>(&nbsp;&nbsp;&nbsp;) Consulta 03.01.06.009-6<br />(&nbsp;&nbsp;&nbsp;) Medicação 03.01.10.001-2<br />(&nbsp;&nbsp;&nbsp;) Observação 03.01.06.002-9<br />(&nbsp;&nbsp;&nbsp;) Triagem 03.01.01.004-8<br />(&nbsp;&nbsp;&nbsp;) Outras: ______________________<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;______________________________</p></div>
    </div>
    <h3>Acompanhante</h3>
    <div className="sheet-row"><F l="Nome" v={guardian} /></div>
    <div className="sheet-row"><F l="Nascimento" /><F l="Sexo" /><F l="Grau de Parentesco" v={r.guardianRelationship} /></div>
    <div className="sheet-row"><F l="CPF" /></div>
    <div className="sheet-row"><F l="Identidade" /><F l="Complemento" /><F l="UF" /><F l="Emissão" /><F l="Org.Emissor" /></div>
    <div className="sheet-row"><F l="Telefone" v={r.guardianPhone && `(${r.guardianAreaCode})${r.guardianPhone}`} /></div>
    <h3 className="sheet-center">Termo de Responsabilidade</h3>
    <div className="sheet-term">
      <p>Autorizo este hospital a realizar tratamento clínico ou cirúrgico do paciente acima identificado, bem como realizar as investigações técnicas que forem julgadas necessárias para realizar um perfeito diagnóstico.</p>
      <p>Outrosim responsabilizo-me pelo ressarcimento de qualquer despesa que venha a ser realizada durante sua internação, que esteja fora do alcance das normas legais vigentes do convênio. Exceto para o convênio SUS.</p>
      <p>Comprometo-me, ainda, a promover a desocupação das dependências do hospital, após receber autorização de alta pelo médico assistente.</p>
      <p>Declaro que estou ciente que o hospital não se responsabiliza por joias, dinheiro, próteses ou qualquer objeto de pacientes internados, bem como pela fuga ou evasão dos mesmos sem alta.</p>
    </div>
    <div className="sheet-signs"><div><div className="line" />Paciente</div><div><div className="line" />Responsável</div></div>
  </section>;
}

export function PatientSheetPrint({ p, e, user }: { p: Patient; e?: Encounter | undefined; user: string }) {
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="print-doc-root sheet-root">
    <Sheet kind="BAA" p={p} e={e} user={user} />
    <Sheet kind="FIA" p={p} e={e} user={user} />
  </div>, document.body);
}
