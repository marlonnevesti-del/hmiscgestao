import { useState } from 'react';
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
import { Letterhead } from '@/components/DischargePrint';

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
  ['Procedimento solicitado', [['procedimento', '27 – Descrição do procedimento'], ['codigo', '28 – Código procedimento'], ['clinica', '29 – Clínica'], ['carater', '30 – Caráter da internação'], ['docTipo', '31 – Documento (CNS/CPF)'], ['docProf', '32 – Nº documento do profissional'], ['profissional', '33 – Nome do profissional solicitante'], ['dataSol', '34 – Data da solicitação']]],
  ['Causas externas (acidentes ou violências)', [['causaExt', '36/37/38 – Tipo (Trabalho / Típico / Trajeto)'], ['seguradora', '39 – CNPJ da seguradora'], ['bilhete', '40 – Nº do bilhete'], ['serie', '41 – Série'], ['cnpjEmpresa', '42 – CNPJ da empresa'], ['cnae', '43 – CNAE da empresa'], ['cbor', '44 – CBOR'], ['vinculo', '45 – Vínculo (Empregado, Autônomo...)']]],
  ['Autorização', [['autorizador', '46 – Profissional autorizador'], ['orgao', '47 – Cód. órgão emissor'], ['numAih', '52 – Nº da AIH'], ['docAut', '49 – Nº documento autorizador'], ['dataAut', '50 – Data']]],
];

function Cell({ l, v, span = 1 }: { l: string; v?: string | undefined; span?: number }) {
  return <td colSpan={span} style={{ border: '1px solid #000', padding: '2px 4px', verticalAlign: 'top' }}><div style={{ fontSize: '7pt' }}>{l}</div><div style={{ fontSize: '9pt', minHeight: '1.2em', whiteSpace: 'pre-wrap' }}>{v || ''}</div></td>;
}
function Head({ t }: { t: string }) { return <tr><td colSpan={4} style={{ border: '1px solid #000', background: '#ddd', fontWeight: 700, fontSize: '8pt', padding: '2px 4px' }}>{t}</td></tr>; }

function PrintLaudo({ f }: { f: ReturnType<typeof aihDefaults> }) {
  const T = { width: '100%', borderCollapse: 'collapse' as const, marginBottom: 4 };
  return <section className="doc-page">
    <Letterhead title="LAUDO PARA SOLICITAÇÃO DE AUTORIZAÇÃO DE INTERNAÇÃO HOSPITALAR" />
    <table style={T}><tbody>
      <Head t={`IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE — Nº DO ATENDIMENTO: ${f.atendimento || ''}`} />
      <tr><Cell l="1 – Estabelecimento solicitante" v={HOSP} span={3} /><Cell l="2 – CNES" v={CNES} /></tr>
      <tr><Cell l="3 – Estabelecimento executante" v={HOSP} span={3} /><Cell l="4 – CNES" v={CNES} /></tr>
      <Head t="IDENTIFICAÇÃO DO PACIENTE" />
      <tr><Cell l="5 – Nome do paciente" v={f.nome} span={3} /><Cell l="6 – Nº prontuário" v={f.prontuario} /></tr>
      <tr><Cell l="7 – CNS" v={f.cns} /><Cell l="8 – Data de nascimento" v={f.nascimento} /><Cell l="9 – Sexo" v={f.sexo} /><Cell l="10 – Raça/Cor · 10.1 Etnia" v={[f.raca, f.etnia].filter(Boolean).join(' · ')} /></tr>
      <tr><Cell l="11 – Nome da mãe" v={f.mae} span={3} /><Cell l="12 – Telefone" v={f.telMae} /></tr>
      <tr><Cell l="13 – Nome responsável" v={f.responsavel} span={3} /><Cell l="14 – Telefone" v={f.telResp} /></tr>
      <tr><Cell l="15 – Endereço (Rua, Nº, Bairro)" v={f.endereco} span={4} /></tr>
      <tr><Cell l="16 – Município de residência" v={f.municipio} /><Cell l="17 – Cód. IBGE" v={f.ibge} /><Cell l="18 – UF" v={f.uf} /><Cell l="19 – CEP" v={f.cep} /></tr>
      <Head t="JUSTIFICATIVA DA INTERNAÇÃO" />
      <tr><Cell l="20 – Principais sinais e sintomas clínicos" v={f.sintomas} span={4} /></tr>
      <tr><Cell l="21 – Condições que justificam a internação" v={f.condicoes} span={4} /></tr>
      <tr><Cell l="22 – Principais resultados de provas diagnósticas" v={f.exames} span={4} /></tr>
      <tr><Cell l="23 – Diagnóstico inicial" v={f.diagnostico} /><Cell l="24 – CID10 principal" v={f.cid} /><Cell l="25 – CID10 secundário" v={f.cid2} /><Cell l="26 – CID10 causas associadas" v={f.cid3} /></tr>
      <Head t="PROCEDIMENTO SOLICITADO" />
      <tr><Cell l="27 – Descrição do procedimento solicitado" v={f.procedimento} span={3} /><Cell l="28 – Código procedimento" v={f.codigo} /></tr>
      <tr><Cell l="29 – Clínica" v={f.clinica} /><Cell l="30 – Caráter da internação" v={f.carater} /><Cell l="31 – Documento" v={f.docTipo} /><Cell l="32 – Nº documento do profissional" v={f.docProf} /></tr>
      <tr><Cell l="33 – Nome do profissional solicitante/assistente" v={f.profissional} span={2} /><Cell l="34 – Data da solicitação" v={f.dataSol} /><Cell l="35 – Assinatura e carimbo" v={'\n\n'} /></tr>
      <Head t="PREENCHER EM CASO DE CAUSAS EXTERNAS (ACIDENTES OU VIOLÊNCIAS)" />
      <tr><Cell l="36/37/38 – Acidente de trabalho / típico / trajeto" v={f.causaExt} /><Cell l="39 – CNPJ da seguradora" v={f.seguradora} /><Cell l="40 – Nº do bilhete" v={f.bilhete} /><Cell l="41 – Série" v={f.serie} /></tr>
      <tr><Cell l="42 – CNPJ da empresa" v={f.cnpjEmpresa} /><Cell l="43 – CNAE da empresa" v={f.cnae} /><Cell l="44 – CBOR" v={f.cbor} /><Cell l="45 – Vínculo com a previdência" v={f.vinculo} /></tr>
      <Head t="AUTORIZAÇÃO" />
      <tr><Cell l="46 – Nome do profissional autorizador" v={f.autorizador} span={2} /><Cell l="47 – Cód. órgão emissor" v={f.orgao} /><Cell l="52 – Nº da AIH" v={f.numAih} /></tr>
      <tr><Cell l="48/49 – Documento (CNS/CPF) do autorizador" v={f.docAut} span={2} /><Cell l="50 – Data" v={f.dataAut} /><Cell l="51 – Assinatura e carimbo" v={'\n\n'} /></tr>
    </tbody></table>
  </section>;
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
