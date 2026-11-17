import { Letterhead } from "./DischargePrint";
import { createPortal } from "react-dom";
import type { Encounter } from "@/lib/care-flow";
import { WARDS, type Patient } from "@/lib/hospital-data";
import { registrationFor } from "@/lib/patient-registration-mapping";
import { patientAge } from "@/lib/patient-registration";
import { findStockMedication, type StockMedication } from "@/lib/pharmacy-stock";

/** Imprime a requisição SURE090_R do kit dispensado. */
export function printRequisition() {
  document.body.classList.add("print-req");
  const done = () => { document.body.classList.remove("print-req"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 80);
}
const fmt = (d?: string) => (d ? new Date(d).toLocaleString("pt-BR") : "");

export function RequisitionPrint({ p, e, stock }: { p?: Patient | undefined; e?: Encounter | undefined; stock: StockMedication[] }) {
  if (typeof document === "undefined" || !p || !e) return null;
  const r = registrationFor(p);
  const ward = WARDS.find((w) => w.id === p.ward)?.name ?? p.ward;
  const [room, bed] = (p.bed || "").split("-");
  const items = p.prescriptions.filter((x) => x.pharmacy);
  return createPortal(<div className="req-root"><section className="req-page">
    <Letterhead title="REQUISIÇÃO" />
    <div className="req-h2">SURE090_R - Requisição de Medicamentos por Horário de Dispensação</div>
    <div className="req-row"><span><b>Requisição:</b> {e.requisition ?? ""} - 0</span><span><b>Requisitada em:</b> {fmt(e.signedAt)}</span><span><b>Atendida em:</b> {fmt(e.dispensedAt)}</span></div>
    <div className="req-row"><span><b>{e.type === "Maternidade" ? "FIA" : "BAA"}:</b> {e.number}</span><span>{ward}{room && ` - Quarto: ${room}`}{bed && ` - Leito: ${bed}`}</span></div>
    <div className="req-row"><span><b>Paciente:</b> {p.prontuario} - {p.name.toUpperCase()}</span><span><b>Sexo:</b> {r.sex}</span><span><b>Idade:</b> {patientAge(r) || p.age}</span></div>
    <div className="req-row"><span><b>Médico:</b> {e.signedBy}</span></div>
    <table className="req-table"><thead><tr><th>Horário</th><th>Código</th><th>Medicamento</th><th>Lote</th><th>Via</th><th>Qtde.</th><th>Unid.</th></tr></thead><tbody>
      {items.map((x) => { const m = findStockMedication(stock, x.item); return <tr key={x.id}><td>{x.times?.join(", ") || "<Horário indefinido>"}</td><td>{m?.code ?? ""}</td><td>{x.item}</td><td>{x.lot ?? ""}</td><td>{x.posologia}</td><td>{x.times?.length ?? 1}</td><td>{m?.unit ?? "UN"}</td></tr>; })}
    </tbody></table>
    <div className="req-signs"><div><div className="line" />Farmácia: {e.dispensedBy}</div><div><div className="line" />Recebido por (Enfermagem)</div></div>
  </section></div>, document.body);
}
