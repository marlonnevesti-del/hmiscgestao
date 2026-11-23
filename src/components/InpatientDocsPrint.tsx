import { AmendDocumentButton } from '@/components/DocumentAmend';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';
import type { Encounter } from '@/lib/care-flow';
import type { Patient } from '@/lib/hospital-data';
import { Letterhead } from '@/components/DischargePrint';
import { AihLaudoButton } from '@/components/AihLaudo';
import { ClinicalDocsButtons } from '@/components/ClinicalDocs';

export type Doc = 'termo' | 'internado' | 'comparecimento' | 'acompanhante' | 'pertences' | 'recusa' | 'altaEnf';
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

export function Body({ doc, p, e, companion }: { doc: Doc; p: Patient; e?: Encounter | undefined; companion: string }) {
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
      <ol style={{ fontSize: '9.5pt', lineHeight: 1.22, textAlign: 'justify', margin: '0.2em 0' }}>{CLAUSES.map((c) => <li key={c}>{c}</li>)}</ol>
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
  if (doc === 'pertences') return <section className="doc-page">
    <Letterhead title="TERMO DE GUARDA E RETIRADA DE PERTENCES" />
    <p><b>Paciente:</b> {p.name || line()} · <b>Prontuário:</b> {p.prontuario || line()} · <b>Atendimento:</b> {e?.number || line()}</p>
    <p>Relação dos pertences entregues para guarda do hospital:</p>
    <table className="doc-id"><tbody>{Array.from({ length: 8 }, (_, i) => <tr key={i}><td style={{ height: '1.8em' }}>{i + 1}.</td><td style={{ width: '20%' }}>Qtd:</td></tr>)}</tbody></table>
    <p style={{ textAlign: 'justify' }}>Declaro que entreguei os pertences acima para guarda e que os retirei em perfeitas condições na data abaixo. O hospital não se responsabiliza por objetos não relacionados neste termo.</p>
    <p><b>Entregue em:</b> ____/____/______ às ____:____ &nbsp;&nbsp; <b>Retirado em:</b> ____/____/______ às ____:____</p>
    <p style={{ textAlign: 'right', marginTop: '2em' }}>Criciúma - SC, {today()}.</p>
    <div className="doc-signs"><div className="doc-sign"><div className="line" />Paciente / Responsável</div>
    <div className="doc-sign"><div className="line" />Colaborador do hospital</div></div>
  </section>;
  if (doc === 'altaEnf') return <AltaEnfermagem p={p} e={e} />;
  if (doc === 'recusa') return <section className="doc-page">
    <Letterhead title="TERMO DE RECUSA / DESISTÊNCIA DE ATENDIMENTO" />
    <p style={{ textAlign: 'justify', lineHeight: 1.8 }}>Eu, {line()}, CPF {line()}, ( ) paciente ( ) responsável legal por <b>{p.name ? p.name.toUpperCase() : line()}</b>{p.prontuario ? <>, prontuário <b>{p.prontuario}</b></> : null}, declaro que fui devidamente informado(a) pela equipe do Hospital Materno Infantil Santa Catarina sobre o quadro clínico, a necessidade do atendimento/tratamento proposto e os riscos decorrentes da sua recusa ou interrupção.</p>
    <p style={{ textAlign: 'justify', lineHeight: 1.8 }}>Ainda assim, por livre e espontânea vontade, RECUSO / DESISTO do atendimento ou tratamento indicado, assumindo inteira responsabilidade pelas consequências desta decisão e isentando o hospital e sua equipe.</p>
    <p><b>Motivo:</b> {line()}{line()}</p>
    <p style={{ textAlign: 'right', marginTop: '2em' }}>Criciúma - SC, {today()}.</p>
    <div className="doc-signs"><div className="doc-sign"><div className="line" />Paciente / Responsável</div>
    <div className="doc-sign"><div className="line" />Testemunha</div>
    <div className="doc-sign"><div className="line" />Profissional responsável</div></div>
  </section>;
  if (doc === 'acompanhante') return <section className="doc-page">
    <Letterhead title="DECLARAÇÃO DE ACOMPANHANTE" />
    <p style={{ textAlign: 'justify', lineHeight: 1.8, textIndent: '3em' }}>Declaramos para os devidos fins e efeitos, que o Sr.(a) <b>{p.name.toUpperCase()}</b> recebeu atendimento médico nesta Unidade Hospitalar em <b>{dt(e?.openedAt)}</b>, {e?.discharge?.at ? <>tendo recebido alta em <b>{dt(e.discharge.at)}</b>.</> : <>permanecendo no hospital.</>}</p>
    <p style={{ textAlign: 'justify', lineHeight: 1.8, textIndent: '3em' }}>Acompanhou o(a) paciente o(a) Sr(a) <b>{companion ? companion.toUpperCase() : line()}</b>.</p>
    <p style={{ textAlign: 'center', marginTop: '4em' }}>Criciúma - SC, {today()}.</p>
    <div className="doc-sign"><div className="line" />Responsável</div>
  </section>;
  return <section className="doc-page">
    <Letterhead title="DECLARAÇÃO" />
    <p style={{ textAlign: 'justify', lineHeight: 1.8 }}>Declaramos, para os devidos fins e efeitos, que o(a) Sr.(a) <b>{p.name.toUpperCase()}</b> recebeu atendimento médico nesta Unidade Hospitalar no período de <b>{dt(e?.openedAt)}</b> a <b>{dt(e?.discharge?.at || new Date().toISOString())}</b>.{companion && <> Acompanhou o(a) paciente o(a) Sr.(a) <b>{companion.toUpperCase()}</b>.</>}</p>
    <p style={{ textAlign: 'right', marginTop: '4em' }}>Criciúma - SC, {today()}.</p>
    <div className="doc-sign"><div className="line" />Responsável</div>
  </section>;
}

/** Termo de responsabilidade e declarações (internação / comparecimento), preenchidos com os dados do cadastro e atendimento. */
export function InpatientDocsButtons({ p, e, only }: { p: Patient; e?: Encounter | undefined; only?: 'termos' | 'clinicos' | 'admin' }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [companion, setCompanion] = useState('');
  const run = (d: Doc) => {
    if (d !== 'termo' && d !== 'altaEnf') {
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
    {(!only || only === 'clinicos') && <><AihLaudoButton p={p} e={e} /><ClinicalDocsButtons p={p} e={e} /></>}
    {(!only || only === 'admin') && <AmendDocumentButton p={p} e={e} />}
    {(!only || only === 'termos') && <>
    <button onClick={() => run('termo')} className={btn}><FileText className="h-4 w-4" />Termo internação</button>
    <button onClick={() => run('internado')} className={btn}><FileText className="h-4 w-4" />Decl. internação</button>
    <button onClick={() => run('comparecimento')} className={btn}><FileText className="h-4 w-4" />Decl. atendimento</button>
    <button onClick={() => run('acompanhante')} className={btn}><FileText className="h-4 w-4" />Decl. acompanhante</button>
    <button onClick={() => run('altaEnf')} className={btn}><FileText className="h-4 w-4" />Orientação alta enfermagem</button>
    </>}
    {doc && typeof document !== 'undefined' && createPortal(<div className="print-doc-root term-root"><Body doc={doc} p={p} e={e} companion={companion} /></div>, document.body)}
  </>;
}

const ALTA_ENF: [string, string[]][] = [
  ['2. VACINAS E TESTE DO PEZINHO', ['O teste do pezinho deve ser realizado entre o 3º e 5º dia de vida do recém-nascido na Unidade Básica de Saúde mais próxima de sua residência; neste dia o recém-nascido já pode realizar as vacinas BCG e Hepatite B. Lembre-se de levar a certidão de nascimento e a caderneta de saúde.']],
  ['3. TESTE DA ORELHINHA E LINGUINHA', ['O teste da orelhinha e da linguinha estão agendados para o dia/horário ____/____/______ às ____:____. Local de realização: Hospital Materno Infantil Santa Catarina, acesso pela recepção da maternidade. Caso não consiga comparecer ou precise reagendar, comunique através do contato (48) 3512-2137.']],
  ['4. AMAMENTAÇÃO', ['Em casos de dificuldade para amamentação, temos como apoio o Banco de Leite Humano do HMISC, que presta auxílio/atendimento à puérpera até 60 dias do nascimento do recém-nascido, sendo necessário entrar em contato com a equipe pelo telefone/WhatsApp (48) 98849-6636 para agendamento (segunda a sexta-feira).', 'BENEFÍCIOS DO LEITE MATERNO: maior contato com a mãe, melhora a digestão e diminui as cólicas, reduz o risco de doenças alérgicas, estimula e fortalece a arcada dentária e previne doenças contagiosas como diarreia.', 'Em casos de engasgo durante as mamadas, coloque o bebê no colo com a barriga para baixo, a cabeça mais baixa que o tronco, dando leves tapinhas entre as costas até que ele expulse o conteúdo.']],
  ['5. CUIDADO COM AS MAMAS', ['Lave suas mamas somente com água.', 'Em casos de rachaduras nos mamilos, observe a forma em que o bebê está abocanhando.', 'Mantenha o mamilo sempre hidratado com o próprio leite materno.', 'Tome banho de sol antes das 09h ou após as 16h, durante 10 a 15 minutos, com os seios expostos; aproveite para dar um banho de sol em seu bebê também.', 'Seu útero estará voltando ao normal, por isso é comum ter cólicas, que podem aumentar durante a amamentação.', 'A mastite é o empedramento das mamas e ocorre quando a mulher produz muito leite. As mamas ficam brilhantes, vermelhas e pode haver febre; faça compressas de água gelada e retire o excesso de leite com as mãos. Se os sintomas persistirem, procure atendimento médico.']],
  ['6. HIGIENE E LIMPEZA DO COTO UMBILICAL', ['A cada troca de fralda e após o banho, pingar 2 gotas de álcool líquido 70% no coto umbilical.', 'No banho, lavar o coto umbilical com água e sabonete e secar com a toalha de banho.', 'Pode utilizar gaze e cotonete para auxiliar na higienização.', 'Não deixe nada sobre o coto umbilical; caso a fralda cubra o coto, dobre a fralda para que ele permaneça livre, auxiliando na ventilação.', 'Após a queda do coto umbilical, permanecer usando álcool líquido 70% por mais 7 dias.', 'Em caso de vermelhidão, inchaço, odor ou calor no local do coto umbilical, procurar atendimento médico imediatamente.']],
  ['7. REGISTRO DO RECÉM-NASCIDO NO CARTÓRIO', ['Conferir as informações descritas na Declaração de Nascido Vivo (DNV). Em caso de erros, comunicar imediatamente o profissional enfermeiro para correção.', 'Cuidados com a DNV: não rasurar, não molhar, não riscar, não extraviar, pois não emitimos 2ª via.', 'Documentos para registro do recém-nascido: documentos pessoais dos pais (RG, CPF, certidão de nascimento ou casamento); pais não casados no civil devem comparecer juntos ao cartório.', 'Pai ou mãe menor de 18 anos deve comparecer ao cartório juntamente com o responsável maior de idade.']],
  ['8. CARTÃO DO SUS DO RECÉM-NASCIDO', ['O cartão do SUS deverá ser realizado na recepção da maternidade do HMISC durante o período de internação. Após a alta hospitalar, procurar a Unidade de Saúde do seu bairro.', 'Documentos para recém-nascidos registrados em cartório: certidão de nascimento do recém-nascido e RG da mãe.', 'Documentos para recém-nascidos não registrados: Declaração de Nascido Vivo (DNV) e RG da mãe. O recém-nascido será identificado como RN de (nome da mãe). Após o registro, encaminhar a certidão à UBS de referência para atualização do nome.']],
];

/** Orientação de Alta da Enfermagem – Alojamento Conjunto (modelo institucional HMISC, 2 folhas A4). */
function AltaEnfermagem({ p, e }: { p: Patient; e?: Encounter | undefined }) {
  const birth = p.registration?.birthDate ? new Date(`${p.registration.birthDate}T12:00:00`).toLocaleDateString('pt-BR') : '';
  const sec = (t: string, items: string[]) => <div key={t} style={{ breakInside: 'avoid' }}><h3 style={{ margin: '0.5em 0 0.2em', fontSize: '10.5pt' }}>{t}</h3><ul style={{ margin: 0, paddingLeft: '1.2em' }}>{items.map((i) => <li key={i}>{i}</li>)}</ul></div>;
  const style = { fontSize: '9.5pt', lineHeight: 1.3, textAlign: 'justify' as const };
  return <>
    <section className="doc-page" style={style}>
      <Letterhead title="ORIENTAÇÃO DE ALTA DA ENFERMAGEM – ALOJAMENTO CONJUNTO" />
      <table className="doc-id"><tbody>
        <tr><td><b>Nome do Paciente:</b> {p.name || line()}</td><td><b>Prontuário:</b> {p.prontuario || line()}</td></tr>
        <tr><td><b>Data de Nascimento:</b> {birth || line()}</td><td><b>Data da alta:</b> {e?.discharge?.at ? dt(e.discharge.at) : '____/____/______'}</td></tr>
      </tbody></table>
      {sec('1. CONSULTAS PÓS-PARTO E NASCIMENTO', ['Após a alta hospitalar, realizar a primeira consulta puerperal e do recém-nascido na Unidade Básica de Saúde mais próxima de sua residência. Documentos necessários: certidão de nascimento e caderneta de saúde do recém-nascido, cartão de pré-natal e nota de alta entregue pelo obstetra e pediatra.'])}
      {ALTA_ENF.slice(0, 4).map(([t, i]) => sec(t, i))}
    </section>
    <section className="doc-page" style={style}>
      <Letterhead title="ORIENTAÇÃO DE ALTA DA ENFERMAGEM – ALOJAMENTO CONJUNTO" />
      {ALTA_ENF.slice(4).map(([t, i]) => sec(t, i))}
      <div style={{ border: '1.5px solid currentColor', padding: '0.4em 0.6em', marginTop: '0.6em', breakInside: 'avoid' }}><b>SINAIS DE ALERTA:</b> puérpera com cefaleia intensa e alterações visuais, dificuldade respiratória, dificuldade para esvaziar a bexiga, febre ou calafrios, sangramento vaginal em grande quantidade, dor abdominal severa, secreção ou vermelhidão na ferida operatória deve procurar atendimento médico.</div>
      <p style={{ marginTop: '0.6em' }}><b>OBSERVAÇÃO:</b></p>
      <div style={{ borderBottom: '1px solid currentColor', height: '1.4em' }} /><div style={{ borderBottom: '1px solid currentColor', height: '1.4em' }} /><div style={{ borderBottom: '1px solid currentColor', height: '1.4em' }} />
      <p style={{ textAlign: 'right', marginTop: '1em' }}>Criciúma - SC, {today()}.</p>
      <div className="doc-signs"><div className="doc-sign"><div className="line" />Puérpera / Responsável</div><div className="doc-sign"><div className="line" />Enfermeiro(a) – Carimbo / COREN</div></div>
    </section>
  </>;
}
