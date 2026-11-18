import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';
import type { Encounter } from '@/lib/care-flow';
import type { Patient } from '@/lib/hospital-data';
import { Letterhead } from '@/components/DischargePrint';
import { AihLaudoButton } from '@/components/AihLaudo';

type Doc = 'termo' | 'internado' | 'comparecimento';
const dt = (d?: string) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const today = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const line = (v?: string) => v?.trim() || '____________________________';

const CLAUSES = [
  'Fui devidamente informado(a) sobre a indicação da internação e os objetivos do tratamento proposto pela equipe médica assistente.',
  'Fui esclarecido(a) sobre os riscos, benefícios e alternativas terapêuticas pertinentes ao meu caso.',
  'Autorizo a realização dos procedimentos assistenciais necessários (acessos venosos, sondagens, coletas laboratoriais, punções e medicações prescritas).',
  'Autorizo a realização de exames complementares de imagem e diagnóstico laboratorial.',
  'Estou ciente de que intercorrências podem indicar transferência de setor, encaminhamento à UTI ou intervenção cirúrgica.',
  'Fui informado(a) de que a medicina não é uma ciência exata e não há garantia prévia de resultado.',
  'Comprometo-me a fornecer informações verídicas sobre alergias, hábitos e histórico de saúde.',
  'Estou ciente das normas do Serviço de Controle de Infecção Hospitalar (SCIH) e de higienização.',
  'Autorizo o uso anônimo de dados clínicos para fins científicos, estatísticos e acadêmicos, resguardado o sigilo médico.',
  'Estou ciente de que é proibido fotografar, filmar ou gravar funcionários, pacientes e procedimentos sem autorização.',
  'Tratando-se de recém-nascido em Alojamento Conjunto, estas autorizações se estendem aos cuidados do binômio mãe-bebê.',
  'Fui orientado(a) sobre horários de visitas, troca de acompanhantes e regras internas.',
  'Tenho ciência de que posso revogar este termo a qualquer momento, por manifestação expressa por escrito.',
];

function address(p: Patient) {
  const a = p.registration?.addresses?.find((x) => x.primary) ?? p.registration?.addresses?.[0];
  if (!a) return '—';
  return [[a.streetType, a.street].filter(Boolean).join(' '), a.number, a.complement, a.neighborhood, [a.city, a.state].filter(Boolean).join(' - '), a.postalCode && `CEP ${a.postalCode}`].filter(Boolean).join(', ') || '—';
}

function Body({ doc, p, e, companion }: { doc: Doc; p: Patient; e?: Encounter | undefined; companion: string }) {
  const r = p.registration;
  const birth = r?.birthDate ? new Date(`${r.birthDate}T12:00:00`).toLocaleDateString('pt-BR') : '—';
  const bed = e?.fia?.bed || p.bed;
  const ward = e?.fia?.ward || p.ward;
  const doctor = e?.fia?.doctor || e?.signedBy || '';
  if (doc === 'termo') return <>
    <section className="doc-page">
      <Letterhead title="TERMO DE RESPONSABILIDADE DE INTERNAÇÃO" />
      <p>O Hospital Materno Infantil Santa Catarina informa ao paciente e/ou ao seu representante legal que o mesmo receberá assistência médica e multiprofissional durante o período de internação nesta instituição.</p>
      <table className="doc-id"><tbody>
        <tr><td colSpan={2}><b>DADOS DO PACIENTE</b></td></tr>
        <tr><td><b>Nome:</b> {p.name}</td><td><b>Nascimento:</b> {birth} ({p.age})</td></tr>
        <tr><td><b>CPF:</b> {p.cpf || r?.cpf || '—'}</td><td><b>CNS:</b> {r?.cns || '—'} · <b>Prontuário:</b> {p.prontuario}</td></tr>
        <tr><td colSpan={2}><b>Endereço:</b> {address(p)}</td></tr>
        <tr><td><b>FIA:</b> {e?.fia?.number || '—'} · <b>Leito:</b> {bed}</td><td><b>Internação:</b> {dt(e?.fia?.openedAt)}</td></tr>
      </tbody></table>
      <h3>DECLARO QUE:</h3>
      <ol>{CLAUSES.map((c) => <li key={c}>{c}</li>)}</ol>
    </section>
    <section className="doc-page">
      <Letterhead title="ORIENTAÇÕES PARA SEGURANÇA DO PACIENTE" />
      <p>O HMISC segue as 6 Metas Internacionais de Segurança do Paciente:</p>
      <p><b>1.1 Prevenção de quedas:</b> manter grades elevadas e chamar a enfermagem antes de levantar.<br />
        <b>1.2 Pulseira de identificação:</b> uso contínuo durante toda a internação; deve ser conferida antes de qualquer procedimento.<br />
        <b>1.3 Política sazonal:</b> uso de máscara conforme orientações do SCIH.</p>
      <p><b>LIDO, COMPREENDIDO, CIENTE E DE ACORDO</b> com todas as cláusulas e orientações acima, autorizo a internação e os cuidados descritos.</p>
      <table className="doc-id"><tbody>
        <tr><td colSpan={2}><b>DECLARANTE</b></td></tr>
        <tr><td><b>Nome completo:</b> {line()}</td><td><b>CPF:</b> {line()}</td></tr>
        <tr><td colSpan={2}>( ) Paciente &nbsp;&nbsp; ( ) Responsável ou representante legal — Grau de parentesco: {line()}</td></tr>
      </tbody></table>
      <p style={{ textAlign: 'right', marginTop: '2em' }}>Criciúma - SC, {today()}.</p>
      <div className="doc-sign"><div className="line" />Assinatura do Paciente / Responsável</div>
    </section>
  </>;
  if (doc === 'internado') return <section className="doc-page">
    <Letterhead title="DECLARAÇÃO" />
    <p style={{ textAlign: 'justify', lineHeight: 1.8 }}>Declaro, para os devidos fins, que o(a) paciente <b>{p.name.toUpperCase()}</b> está internado(a) neste hospital no leito <b>{bed}</b> da unidade <b>{ward}</b>{doctor ? <> sob cuidados do(a) profissional <b>{doctor}</b></> : null}, no período de <b>{dt(e?.fia?.openedAt || e?.openedAt)}</b> a <b>{dt(new Date().toISOString())}</b> (ainda internado(a)).{companion && <> Acompanhante: <b>{companion.toUpperCase()}</b>.</>}</p>
    <p style={{ textAlign: 'right', marginTop: '4em' }}>Criciúma - SC, {today()}.</p>
    <div className="doc-sign"><div className="line" />Responsável pela Declaração</div>
  </section>;
  return <section className="doc-page">
    <Letterhead title="DECLARAÇÃO" />
    <p style={{ textAlign: 'justify', lineHeight: 1.8 }}>Declaramos, para os devidos fins e efeitos, que o(a) Sr.(a) <b>{p.name.toUpperCase()}</b> recebeu atendimento médico nesta Unidade Hospitalar no período de <b>{dt(e?.openedAt)}</b> a <b>{dt(e?.discharge?.at || new Date().toISOString())}</b>.{companion && <> Acompanhou o(a) paciente o(a) Sr.(a) <b>{companion.toUpperCase()}</b>.</>}</p>
    <p style={{ textAlign: 'right', marginTop: '4em' }}>Criciúma - SC, {today()}.</p>
    <div className="doc-sign"><div className="line" />Responsável</div>
  </section>;
}

/** Termo de responsabilidade e declarações (internação / comparecimento), preenchidos com os dados do cadastro e atendimento. */
export function InpatientDocsButtons({ p, e }: { p: Patient; e?: Encounter | undefined }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [companion, setCompanion] = useState('');
  const run = (d: Doc) => {
    if (d !== 'termo') {
      const c = window.prompt('Nome do acompanhante (deixe em branco se não houver):', p.guardian || p.registration?.guardian || '');
      if (c === null) return;
      setCompanion(c.trim());
    }
    setDoc(d);
    document.body.classList.add('print-doc', 'print-term');
    const done = () => { document.body.classList.remove('print-doc', 'print-term'); setDoc(null); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 150);
  };
  const btn = 'flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted';
  return <>
    <AihLaudoButton p={p} e={e} />
    <button onClick={() => run('termo')} className={btn}><FileText className="h-4 w-4" />Termo internação</button>
    <button onClick={() => run('internado')} className={btn}><FileText className="h-4 w-4" />Decl. internação</button>
    <button onClick={() => run('comparecimento')} className={btn}><FileText className="h-4 w-4" />Decl. atendimento</button>
    {doc && typeof document !== 'undefined' && createPortal(<div className="print-doc-root term-root"><Body doc={doc} p={p} e={e} companion={companion} /></div>, document.body)}
  </>;
}
