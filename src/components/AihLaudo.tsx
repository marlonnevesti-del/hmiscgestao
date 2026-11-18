import { useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { Encounter } from '@/lib/care-flow';
import type { Patient } from '@/lib/hospital-data';
import { saveAihLaudo, useStore } from '@/lib/hospital-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import susLogo from '@/assets/sus-logo.png';
import footerLogos from '@/assets/aih-footer-logos.png';

type F = Record<string, string>;
const HOSP = 'HOSPITAL MATERNO INFANTIL SANTA CATARINA';
const CNES = '2594277';

/** Campos do laudo pré-preenchidos com cadastro + atendimento; o médico pode editar todos. */
export function aihDefaults(p: Patient, e: Encounter | undefined, doctor: string) {
  const r = p.registration;
  const a = r?.addresses?.find((x) => x.primary) ?? r?.addresses?.[0];
  const ph = r?.phones?.find((x) => x.primary) ?? r?.phones?.[0];
  return {
    atendimento: e?.fia?.number || e?.number || '', nome: p.name, prontuario: p.prontuario, cns: r?.cns || '',
    nascimento: r?.birthDate ? new Date(`${r.birthDate}T12:00:00`).toLocaleDateString('pt-BR') : '',
    sexo: r?.sex || '', raca: r?.skinColor || '', etnia: r?.ethnicity || '',
    mae: p.motherName || r?.parent1 || '', telMae: ph ? `(${ph.areaCode}) ${ph.number}` : '',
    responsavel: p.guardian || r?.guardian || '', telResp: r?.guardianPhone ? `(${r.guardianAreaCode}) ${r.guardianPhone}` : '',
    endereco: a ? [[a.streetType, a.street].filter(Boolean).join(' '), a.number, a.complement, a.neighborhood].filter(Boolean).join(', ') : '',
    municipio: a?.city || '', ibge: a?.cityCode || '', uf: a?.state || '', cep: a?.postalCode || '',
    sintomas: e?.complaint || '', condicoes: e?.fia?.justification || e?.admission?.justification || '', exames: '',
    diagnostico: p.diagnosis || '', cid: e?.fia?.cid || e?.admission?.cid || '', cid2: '', cid3: '',
    procedimento: '', codigo: '0303010037', clinica: e?.type || '', carater: e?.fia?.character || 'Urgência',
    docTipo: 'CNS', docProf: '', profissional: e?.fia?.doctor || doctor, dataSol: new Date().toLocaleDateString('pt-BR'),
    causaExt: '', seguradora: '', bilhete: '', serie: '', cnpjEmpresa: '', cnae: '', cbor: '', vinculo: '',
    autorizador: '', orgao: '', numAih: '', docAut: '', dataAut: '',
  };
}

const SECTIONS: [string, [string, string, boolean?][]][] = [
  ['Identificação do paciente', [['nome', '5 – Nome do paciente'], ['prontuario', '6 – Nº prontuário'], ['cns', '7 – CNS'], ['nascimento', '8 – Data de nascimento'], ['sexo', '9 – Sexo'], ['raca', '10 – Raça/Cor'], ['etnia', '10.1 – Etnia'], ['mae', '11 – Nome da mãe'], ['telMae', '12 – Telefone'], ['responsavel', '13 – Nome responsável'], ['telResp', '14 – Telefone'], ['endereco', '15 – Endereço'], ['municipio', '16 – Município'], ['ibge', '17 – Cód. IBGE'], ['uf', '18 – UF'], ['cep', '19 – CEP']]],
  ['Justificativa da internação', [['sintomas', '20 – Principais sinais e sintomas clínicos', true], ['condicoes', '21 – Condições que justificam a internação', true], ['exames', '22 – Principais resultados de provas diagnósticas', true], ['diagnostico', '23 – Diagnóstico inicial'], ['cid', '24 – CID10 principal'], ['cid2', '25 – CID10 secundário'], ['cid3', '26 – CID10 causas associadas']]],
  ['Procedimento solicitado', [['procedimento', '27 – Descrição do procedimento'], ['codigo', '28 – Código procedimento'], ['clinica', '29 – Clínica'], ['carater', '30 – Caráter da internação'], ['docTipo', '31 – Documento do profissional (CNS ou CPF)'], ['docProf', '32 – Nº documento do profissional'], ['profissional', '33 – Nome do profissional solicitante'], ['dataSol', '34 – Data da solicitação']]],
  ['Causas externas (acidentes ou violências)', [['causaExt', '36/37/38 – Acidente (Trabalho / Típico / Trajeto)'], ['seguradora', '39 – CNPJ da seguradora'], ['bilhete', '40 – Nº do bilhete'], ['serie', '41 – Série'], ['cnpjEmpresa', '42 – CNPJ da empresa'], ['cnae', '43 – CNAE da empresa'], ['cbor', '44 – CBOR'], ['vinculo', '45 – Vínculo (Empregado, Empregador, Autônomo, Desempregado, Aposentado, Não Segurado)']]],
  ['Autorização', [['autorizador', '46 – Profissional autorizador'], ['orgao', '47 – Cód. órgão emissor'], ['numAih', '52 – Nº da AIH'], ['docAut', '49 – Nº documento autorizador'], ['dataAut', '50 – Data']]],
];

const B = '1px solid #000';
const lab: CSSProperties = { fontSize: '7pt', fontWeight: 700 };
const valS: CSSProperties = { fontSize: '9pt', whiteSpace: 'pre-wrap', marginTop: 2 };
function C({ l, v, span = 1, h = 34, children }: { l: string; v?: string | undefined; span?: number; h?: number; children?: ReactNode }) {
  return <td colSpan={span} style={{ border: B, padding: '3px 4px', verticalAlign: 'top', height: h }}><div style={lab}>{l}</div>{children ?? <div style={valS}>{v || ''}</div>}</td>;
}
const box = (on: boolean) => `(${on ? 'X' : '\u00a0\u00a0'})`;
const Title = ({ t }: { t: string }) => <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '8.5pt', margin: '4px 0 1px' }}>{t}</div>;
const T: CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };

function AihHeader() {
  return <table style={{ ...T, marginBottom: 4 }}><tbody><tr>
    <td style={{ border: B, width: '50%', padding: 6 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><img src={susLogo} alt="SUS" style={{ height: 42 }} /><div style={{ fontWeight: 700, fontSize: '10pt', lineHeight: 1.3 }}>Sistema Único de Saúde<br />Ministério da Saúde</div></div></td>
    <td style={{ border: B, textAlign: 'center', fontWeight: 700, fontSize: '11pt', lineHeight: 1.3, padding: 6 }}>Laudos para Solicitação de Autorização de Internação Hospitalar<br />(Laudo Manual)</td>
  </tr></tbody></table>;
}
function AihFooter() {
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
    <img src={footerLogos} alt="SUS · Santa Casa · HMISC · Governo de SC" style={{ height: 24 }} />
    <div style={{ textAlign: 'right', fontSize: '6.5pt' }}><b>UNIDADE CRICIÚMA | HMISC</b><br />Rua Wenceslau Braz, 115, Operária Nova, Criciúma – SC. CEP 88.809-020</div>
  </div>;
}
const pageS: CSSProperties = { position: 'relative', minHeight: '270mm', paddingBottom: 40, fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' };

export function PrintLaudo({ f }: { f: ReturnType<typeof aihDefaults> }) {
  const sx = f.sexo.toLowerCase(); const doc = f.docTipo.toUpperCase(); const ce = f.causaExt.toLowerCase(); const vi = f.vinculo.toLowerCase();
  return <>
    <section className="doc-page" style={pageS}>
      <AihHeader />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', fontWeight: 700, borderTop: B, paddingTop: 2 }}><span>IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE</span><span>Nº DO ATENDIMENTO: {f.atendimento || '______________'}</span></div>
      <table style={T}><tbody>
        <tr><C l="1 – Nome do Estabelecimento Solicitante" v={HOSP} span={3} /><C l="2 – Cnes" v={CNES} /></tr>
        <tr><C l="3 – Nome do Estabelecimento Executante" v={HOSP} span={3} /><C l="4 – Cnes" v={CNES} /></tr>
      </tbody></table>
      <div style={{ fontSize: '8pt', fontWeight: 700, marginTop: 3 }}>IDENTIFICAÇÃO DO PACIENTE</div>
      <table style={T}><colgroup><col style={{ width: '31%' }} /><col style={{ width: '17%' }} /><col style={{ width: '18%' }} /><col style={{ width: '16%' }} /><col style={{ width: '18%' }} /></colgroup><tbody>
        <tr><C l="5 – Nome do Paciente" v={f.nome} span={4} h={40} /><C l="6 – Nº Prontuário" v={f.prontuario} /></tr>
        <tr><C l="7 – Cartão Nacional de Saúde (CNS)" v={f.cns} h={50} /><C l="8 – Data de Nascimento" v={f.nascimento} /><C l="9 – Sexo"><div style={valS}>MASC {box(sx.startsWith('m'))}{'  '}FEM {box(sx.startsWith('f'))}</div></C><C l="10 – Raça/ Cor" v={f.raca} /><C l="10.1 – Etnia" v={f.etnia} /></tr>
      </tbody></table>
      <table style={T}><colgroup><col style={{ width: '50%' }} /><col style={{ width: '50%' }} /></colgroup><tbody>
        <tr><C l="11 – Nome Da Mãe" v={f.mae} h={44} /><C l="12 – Telefone de Contato" v={f.telMae || '(0    )'} /></tr>
        <tr><C l="13 – Nome Responsável" v={f.responsavel} h={44} /><C l="14 – Telefone de Contato" v={f.telResp || '(0    )'} /></tr>
        <tr><C l="15 – Endereço (Rua, Nº, Bairro)" v={f.endereco} span={2} h={44} /></tr>
      </tbody></table>
      <table style={T}><colgroup><col style={{ width: '57%' }} /><col style={{ width: '20%' }} /><col style={{ width: '7%' }} /><col style={{ width: '16%' }} /></colgroup><tbody>
        <tr><C l="16 – Município de Residência" v={f.municipio} h={56} /><C l="17 – Cód. IBGE Município" v={f.ibge} /><C l="18 – UF" v={f.uf} /><C l="19 – CEP" v={f.cep} /></tr>
      </tbody></table>
      <Title t="JUSTIFICATIVA DA INTERNAÇÃO" />
      <table style={T}><tbody>
        <tr><C l="20 – Principais Sinais e Sintomas Clínicos" v={f.sintomas} h={70} /></tr>
        <tr><C l="21 – Condições que Justificam a Internação" v={f.condicoes} h={70} /></tr>
        <tr><C l="22 – Principais Resultados de Provas Diagnosticas (Resultados de Exames Realizados)" v={f.exames} h={70} /></tr>
      </tbody></table>
      <AihFooter />
    </section>
    <section className="doc-page" style={{ ...pageS, breakBefore: 'page' }}>
      <AihHeader />
      <table style={T}><colgroup><col style={{ width: '40%' }} /><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /><col style={{ width: '22%' }} /></colgroup><tbody>
        <tr><C l="23 – Diagnostico Inicial" v={f.diagnostico} h={50} /><C l="24 – CID10 Principal" v={f.cid} /><C l="25 – CID10 Secundário" v={f.cid2} /><C l="26 – CID10 Causas Associadas" v={f.cid3} /></tr>
      </tbody></table>
      <Title t="PROCEDIMENTO SOLICITADO" />
      <table style={T}><colgroup><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /><col style={{ width: '16%' }} /><col style={{ width: '22%' }} /><col style={{ width: '24%' }} /></colgroup><tbody>
        <tr><C l="27 – Descrição do Procedimento Solicitado" v={f.procedimento} span={4} h={46} /><C l="28 – Código Procedimento" v={f.codigo} /></tr>
        <tr><C l="29 – Clínica" v={f.clinica} h={50} /><C l="30 – Caráter da Internação" v={f.carater} /><C l="31 – Clínica"><div style={valS}>CNS {box(doc === 'CNS')}{'  '}CPF {box(doc === 'CPF')}</div></C><C l="32 – Nº Documento (CNS/CPF) do Profissional Solicitante/Assistente" v={f.docProf} span={2} /></tr>
      </tbody></table>
      <table style={T}><colgroup><col style={{ width: '45%' }} /><col style={{ width: '17%' }} /><col style={{ width: '38%' }} /></colgroup><tbody>
        <tr><C l="33 – Nome do Profissional Solicitante/Assistente" v={f.profissional} h={64} /><C l="34 – Data da Solicitação" v={f.dataSol} /><C l="35 – Assinatura e Carimbo (Nº do Registro do Conselho)" v="" /></tr>
      </tbody></table>
      <Title t="PREENCHER EM CASO DE CAUSAS EXTERNAS (ACIDENTES OU VIOLÊNCIAS)" />
      <table style={T}><colgroup><col style={{ width: '31%' }} /><col style={{ width: '42%' }} /><col style={{ width: '17%' }} /><col style={{ width: '10%' }} /></colgroup><tbody>
        <tr><td rowSpan={2} style={{ border: B, padding: '3px 4px', verticalAlign: 'top', fontSize: '7.5pt', fontWeight: 700, lineHeight: 2.2 }}>
          36 - {box(ce.includes('trabalho') && !ce.includes('típ') && !ce.includes('traj'))} Acidente de Trabalho<br />37 - {box(ce.includes('típ') || ce.includes('tip'))} Acidente de Trabalho Típico<br />38 - {box(ce.includes('traj'))} Acidente de Trabalho Trajeto</td>
          <C l="39 – CNPJ da Seguradora" v={f.seguradora} h={40} /><C l="40 – Nº do Bilhete" v={f.bilhete} /><C l="41 – Série" v={f.serie} /></tr>
        <tr><C l="42 – CNPJ da Empresa" v={f.cnpjEmpresa} h={60} /><C l="43 – CNAE da Empresa" v={f.cnae} /><C l="44 – CBOR" v={f.cbor} /></tr>
        <tr><C l="45 – Vínculo com a Previdência" span={4} h={40}><div style={{ ...valS, fontSize: '8pt', display: 'flex', flexWrap: 'wrap', gap: '4px 22px', paddingLeft: 20 }}>
          {['Empregado', 'Empregador', 'Autônomo', 'Desempregado', 'Aposentado', 'Não Segurado'].map((o) => <span key={o}>{box(vi === o.toLowerCase())} {o}</span>)}</div></C></tr>
      </tbody></table>
      <Title t="AUTORIZAÇÃO" />
      <table style={T}><colgroup><col style={{ width: '16%' }} /><col style={{ width: '54%' }} /><col style={{ width: '30%' }} /></colgroup><tbody>
        <tr><C l="46 – Nome do Profissional Autorizador" v={f.autorizador} span={2} h={46} /><C l="52 – Nº da Autorização de Internação Hospitalar" v={f.numAih} /></tr>
        <tr><C l="47 – Cód. do Órgão Emissor" v={f.orgao} h={36} /><C l="49 – Nº Documento (CNS/CPF) do Profissional Autorizador" v={f.docAut} span={2} /></tr>
        <tr><C l="48 – Documento"><div style={valS}>CNS {box(!f.docAut || f.docAut.replace(/\D/g, '').length !== 11)}{'  '}CPF {box(f.docAut.replace(/\D/g, '').length === 11)}</div></C><C l="51 – Assinatura e Carimbo (Nº do Registro do Conselho)" v="" span={2} h={50} /></tr>
        <tr><C l="50 – Data da Solicitação" v={f.dataAut} span={3} h={30} /></tr>
      </tbody></table>
      <AihFooter />
    </section>
  </>;
}

export function AihLaudoButton({ p, e }: { p: Patient; e?: Encounter | undefined }) {
  const employee = useStore((s) => s.employeeName);
  const [f, setF] = useState<ReturnType<typeof aihDefaults> | null>(null);
  const [printing, setPrinting] = useState(false);
  const open = () => setF({ ...aihDefaults(p, e, employee), ...(e?.aihLaudo ?? {}) });
  const set = (k: string, v: string) => setF((x) => (x ? { ...x, [k]: v } : x));
  const val = (k: string) => (f as F | null)?.[k] ?? '';
  const save = () => { if (e && f) { saveAihLaudo(e.id, f); toast.success('Laudo de AIH salvo no atendimento'); } };
  const print = () => {
    save(); setPrinting(true);
    document.body.classList.add('print-doc', 'print-term');
    const done = () => { document.body.classList.remove('print-doc', 'print-term'); setPrinting(false); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 150);
  };
  return <>
    <button onClick={open} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"><FileText className="h-4 w-4" />Laudo AIH</button>
    <Dialog open={!!f && !printing} onOpenChange={(o) => !o && setF(null)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Laudo para Solicitação de AIH</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Dados puxados do cadastro e do atendimento. Corrija ou complete o que for necessário.</p>
        {f && SECTIONS.map(([title, fields]) => <div key={title} className="space-y-2">
          <h3 className="mt-2 text-sm font-semibold">{title}</h3>
          <div className="grid gap-2 sm:grid-cols-2">{fields.map(([k, l, big]) => <label key={k} className={big ? 'text-xs sm:col-span-2' : 'text-xs'}>{l}
            {big ? <Textarea value={val(k)} onChange={(ev) => set(k, ev.target.value)} rows={3} /> : <Input value={val(k)} onChange={(ev) => set(k, ev.target.value)} />}</label>)}</div>
        </div>)}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" disabled={!e} onClick={save}>Salvar</Button>
          <Button onClick={print}>Salvar e imprimir</Button>
        </div>
      </DialogContent>
    </Dialog>
    {printing && f && typeof document !== 'undefined' && createPortal(<div className="print-doc-root term-root"><PrintLaudo f={f} /></div>, document.body)}
  </>;
}
