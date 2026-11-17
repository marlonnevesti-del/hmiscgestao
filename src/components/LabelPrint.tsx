import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import JsBarcode from "jsbarcode";
import { isValidEan13 } from "@/lib/barcode";

export type UnitLabel = { kind: "unit"; name: string; lot: string; expiry: string; barcode: string; pharmacist: string; copies: number };
export type DoseLabel = { kind: "dose"; patient: string; bed: string; sector: string; drug: string; quantity: string; route: string; time: string; validity: string; diluent: string; copies: number };
export type CmeLabel = { kind: "cme"; name: string; autoclave: string; cycle: string; date: string; expiry: string; by: string; barcode: string; copies: number };
export type Label = UnitLabel | DoseLabel | CmeLabel;

/** Imprime etiquetas térmicas 50 × 30 mm. */
export function printLabels() {
  document.body.classList.add("print-label");
  const done = () => { document.body.classList.remove("print-label"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 120);
}

function Bars({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => { if (ref.current && value) try { JsBarcode(ref.current, value, { format: isValidEan13(value) ? "EAN13" : "CODE128", height: 34, width: 1.4, fontSize: 11, margin: 0 }); } catch { /* código inválido */ } }, [value]);
  return <svg ref={ref} />;
}

export function LabelBody({ label }: { label: Label }) {
  if (label.kind === "cme") return <><div className="small">HMISC · CME – ESTERILIZAÇÃO</div><b>{label.name.toUpperCase()}</b><div>{label.autoclave.toUpperCase()} · CICLO {label.cycle}</div><div>EST. {label.date}&nbsp; VAL. {label.expiry}</div><div className="small">Resp.: {label.by}</div><Bars value={label.barcode} /></>;
  return label.kind === "unit"
    ? <><b>{label.name.toUpperCase()}</b><div>LP: {label.lot}&nbsp;&nbsp; VAL. {label.expiry}</div><div className="small">Resp.Téc.: {label.pharmacist}</div><Bars value={label.barcode} /></>
    : <><b>{label.patient.toUpperCase()}</b><div>LEITO: {label.bed}&nbsp;&nbsp; SETOR: {label.sector.toUpperCase()}</div><div>{label.drug.toUpperCase()}</div><div>QUANTIDADE: {label.quantity}&nbsp;&nbsp; VIA: {label.route}</div><div>HORÁRIO: {label.time}</div><div>VALIDADE: {label.validity}&nbsp;&nbsp; {label.diluent ? `(X) DILUENTE ${label.diluent}` : "( ) DILUENTE"}</div></>;
}

export function LabelPrint({ label }: { label: Label | null }) {
  if (typeof document === "undefined" || !label) return null;
  const pages = Array.from({ length: Math.max(1, Math.min(200, label.copies)) });
  return createPortal(<div className="label-root">{pages.map((_, i) => <section key={i} className="label-page"><LabelBody label={label} /></section>)}</div>, document.body);
}
