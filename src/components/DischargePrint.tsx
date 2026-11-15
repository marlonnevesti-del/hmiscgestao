import { createPortal } from 'react-dom';
import type { Encounter } from '@/lib/care-flow';
import type { Patient } from '@/lib/hospital-data';

/** Imprime somente o documento de alta/receita (oculta o resto da tela). */
export function printDischarge() {
  document.body.classList.add('print-doc');
  const done = () => { document.body.classList.remove('print-doc'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}

const fmt = (d?: string) => (d ? new Date(d).toLocaleString('pt-BR') : '—');

function Header({ title, e, p }: { title: string; e: Encounter; p: Patient }) {
  return <>
    <div className="doc-head"><div><b>HMISC · Hospital Materno-Infantil</b><div>Documento clínico</div></div><div className="doc-title">{title}</div></div>
    <table className="doc-id"><tbody>
      <tr><td><b>Paciente:</b> {p.name}</td><td><b>Prontuário:</b> {p.prontuario}</td></tr>
      <tr><td><b>Idade:</b> {p.age}{p.weight ? ` · ${p.weight} kg` : ''}</td><td><b>Convênio:</b> {p.insurance}</td></tr>
      <tr><td><b>Atendimento:</b> {e.number}</td><td><b>Alergias:</b> {p.allergies.length ? p.allergies.join(', ') : 'Nega'}</td></tr>
    </tbody></table>
  </>;
}
function Sign({ e }: { e: Encounter }) {
  return <div className="doc-sign"><div className="line" />{e.discharge?.by}<br />Carimbo / CRM · {fmt(e.discharge?.at)}</div>;
}

export function DischargePrint({ e, p }: { e: Encounter; p: Patient }) {
  if (!e.discharge || typeof document === 'undefined') return null;
  return createPortal(<div className="print-doc-root">
    <section className="doc-page">
      <Header title="SUMÁRIO DE ALTA" e={e} p={p} />
      <p><b>Entrada:</b> {fmt(e.openedAt)} · <b>Alta:</b> {fmt(e.discharge.at)}</p>
      {e.medical && <p><b>Diagnóstico:</b> {e.medical.cid} — {e.medical.diagnosis}</p>}
      <h3>Resumo e orientações de alta</h3>
      <p className="pre">{e.discharge.summary}</p>
      <Sign e={e} />
    </section>
    <section className="doc-page">
      <Header title="RECEITUÁRIO" e={e} p={p} />
      <h3>Uso domiciliar</h3>
      <p className="pre">{e.discharge.recipe || 'Sem receita domiciliar.'}</p>
      <Sign e={e} />
    </section>
  </div>, document.body);
}
