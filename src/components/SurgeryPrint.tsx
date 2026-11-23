import { createPortal } from "react-dom";
import { CHECKLIST, type Patient, type Surgery } from "@/lib/hospital-data";
import { Letterhead, LetterFooter } from "@/components/DischargePrint";

/** Imprime somente a descrição cirúrgica + checklist (oculta o resto da tela). */
export function printSurgery() {
  document.body.classList.add("print-surg");
  const done = () => { document.body.classList.remove("print-surg"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 80);
}
const PH = { signIn: "Sign In – antes da indução anestésica", timeOut: "Time Out – antes da incisão", signOut: "Sign Out – antes de sair da sala" } as const;
const F = ({ l, v }: { l: string; v?: string | number | undefined }) => <span className="sheet-f"><b>{l}:</b> {v || "—"}</span>;

export function SurgeryPrint({ s, p }: { s?: Surgery | undefined; p?: Patient | undefined }) {
  if (typeof document === "undefined" || !s) return null;
  const t = s.team; const r = s.report;
  return createPortal(<div className="surg-root"><section className="sheet-page">
    <Letterhead title="Descrição Cirúrgica / Anestésica e Checklist de Cirurgia Segura" />
    <h3>Identificação</h3>
    <div className="sheet-row"><F l="Paciente" v={s.patient} />{p && <F l="Idade" v={p.age} />}{p && <F l="Prontuário" v={p.id.slice(0, 8)} />}<F l="Data" v={s.date ? new Date(s.date + "T00:00").toLocaleDateString("pt-BR") : ""} /><F l="Sala" v={s.room} /><F l="Caráter" v={s.urgency} /></div>
    <div className="sheet-row"><F l="Procedimento" v={s.type} /><F l="Código" v={s.tuss} /></div>
    <h3>Equipe</h3>
    <div className="sheet-row"><F l="Cirurgião" v={t ? `${t.surgeon} ${t.surgeonCrm ? "CRM " + t.surgeonCrm : ""}` : s.surgeon} /><F l="Auxiliar" v={t?.assistant} /><F l="Anestesista" v={t ? `${t.anesthetist} ${t.anesthetistCrm ? "CRM " + t.anesthetistCrm : ""}` : ""} /></div>
    <div className="sheet-row"><F l="Pediatra/Neonatologista" v={t?.pediatrician} /><F l="Instrumentador(a)" v={t?.scrub} /><F l="Circulante" v={t?.circulating} /></div>
    <h3>Horários</h3>
    <div className="sheet-row"><F l="Entrada em sala" v={r?.roomIn} /><F l="Indução" v={r?.induction} /><F l="Incisão" v={r?.incision} /><F l="Término" v={r?.end} /><F l="Saída de sala" v={r?.roomOut} /></div>
    <h3>Anestesia</h3>
    <div className="sheet-row"><F l="Tipo" v={r?.anesthesia} /></div>
    <div className="pre">{r?.anesthesiaNotes}</div>
    <h3>Descrição cirúrgica</h3>
    <div className="sheet-row"><F l="Diagnóstico pré-operatório" v={r?.preDx} /><F l="Diagnóstico pós-operatório" v={r?.postDx} /></div>
    <div className="pre"><b>Técnica:</b> {r?.technique || "—"}</div>
    <div className="pre"><b>Achados:</b> {r?.findings || "—"}</div>
    <div className="sheet-row"><F l="Perda sanguínea" v={r?.bloodLoss} /><F l="Drenos/curativos" v={r?.drains} /><F l="Peça para anatomopatológico" v={r?.specimen} /></div>
    <div className="sheet-row"><F l="Intercorrências" v={r?.complications} /><F l="Encaminhamento" v={r?.destination} /></div>
  </section><section className="sheet-page">
    <Letterhead title="Checklist de Cirurgia Segura (OMS)" />
    <div className="sheet-row"><F l="Paciente" v={s.patient} /><F l="Procedimento" v={s.type} /><F l="Data" v={s.date ? new Date(s.date + "T00:00").toLocaleDateString("pt-BR") : ""} /></div>
    <h3>Checklist de Cirurgia Segura (OMS)</h3>
    <div className="sheet-cols">{(["signIn", "timeOut", "signOut"] as const).map((ph) => <div key={ph}><b>{PH[ph]}</b>{CHECKLIST[ph].map((i) => <div key={i}>{s.checks[`${ph}:${i}`] ? "[X]" : "[  ]"} {i}</div>)}</div>)}</div>
    <div className="sheet-signs"><div><div className="line" />Cirurgião(ã) – carimbo e CRM</div><div><div className="line" />Anestesiologista – carimbo e CRM</div></div>
    <LetterFooter />
  </section></div>, document.body);
}
