import { useMemo, useState } from "react";
import { Printer, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/hospital-store";
import {
  buildTraceabilityRows,
  filterTraceabilityRows,
  summarizeTraceability,
  toLocalDateKey,
} from "@/lib/pharmacy-traceability";

export function PharmacyTraceability() {
  const movements = useStore((s) => s.movements);
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const institution = useStore((s) => s.institution);

  const today = useMemo(() => toLocalDateKey(new Date().toISOString()), []);
  const [medicine, setMedicine] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [prescriber, setPrescriber] = useState("");
  const [patient, setPatient] = useState("");
  const [lot, setLot] = useState("");

  const allRows = useMemo(
    () => buildTraceabilityRows(movements, encounters, patients),
    [movements, encounters, patients],
  );
  const rows = useMemo(
    () => filterTraceabilityRows(allRows, { medicine, dateFrom, dateTo, prescriber, patient, lot }),
    [allRows, medicine, dateFrom, dateTo, prescriber, patient, lot],
  );
  const summary = useMemo(() => summarizeTraceability(rows), [rows]);

  const clearFilters = () => {
    setMedicine("");
    setDateFrom("");
    setDateTo("");
    setPrescriber("");
    setPatient("");
    setLot("");
  };

  const setTodayOnly = () => {
    setDateFrom(today);
    setDateTo(today);
  };

  const periodLabel = dateFrom && dateTo
    ? dateFrom === dateTo
      ? `Dia ${dateFrom.split("-").reverse().join("/")}`
      : `${dateFrom.split("-").reverse().join("/")} a ${dateTo.split("-").reverse().join("/")}`
    : dateFrom
      ? `A partir de ${dateFrom.split("-").reverse().join("/")}`
      : dateTo
        ? `Até ${dateTo.split("-").reverse().join("/")}`
        : "Todo o período";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-lg font-semibold">Rastreabilidade de Medicamentos</h2>
          <p className="text-xs text-muted-foreground">
            Consulte saídas por medicamento, data, médico prescritor, paciente e lote dispensado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={setTodayOnly}>Hoje</Button>
          <Button size="sm" variant="outline" onClick={clearFilters}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Limpar filtros
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />Imprimir relatório
          </Button>
        </div>
      </div>

      <div className="hidden border-b pb-3 print:block">
        <p className="text-xs font-semibold uppercase tracking-wide">{institution.nomeFantasia || institution.razaoSocial}</p>
        <h1 className="text-base font-bold">Relatório de Rastreabilidade de Saída de Medicamentos</h1>
        <p className="text-xs text-muted-foreground">
          Período: {periodLabel}
          {medicine ? ` · Medicamento: ${medicine}` : ""}
          {prescriber ? ` · Médico: ${prescriber}` : ""}
          {patient ? ` · Paciente/Doc: ${patient}` : ""}
          {lot ? ` · Lote: ${lot}` : ""}
          {" · "}Emitido em {new Date().toLocaleString("pt-BR")}
        </p>
      </div>

      <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6 print:hidden">
        <label className="grid gap-1 text-xs">
          Medicamento
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Ex.: Morfina" value={medicine} onChange={(e) => setMedicine(e.target.value)} />
          </div>
        </label>
        <label className="grid gap-1 text-xs">
          Data inicial
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs">
          Data final
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs">
          Médico prescritor
          <Input placeholder="Nome do médico" value={prescriber} onChange={(e) => setPrescriber(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs">
          Paciente / BAA / FIA
          <Input placeholder="Nome, prontuário ou nº" value={patient} onChange={(e) => setPatient(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs">
          Lote
          <Input placeholder="Nº do lote" value={lot} onChange={(e) => setLot(e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Unidades dispensadas</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.totalQty}</p>
          <p className="text-[11px] text-muted-foreground">{summary.dispenses} saída(s) registrada(s)</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pacientes atendidos</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.uniquePatients}</p>
          <p className="text-[11px] text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Médicos prescritores</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.uniquePrescribers}</p>
          <p className="text-[11px] text-muted-foreground">identificados no filtro</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Lotes distintos</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.uniqueLots}</p>
          <p className="text-[11px] text-muted-foreground">rastreio farmacovigilância</p>
        </div>
      </div>

      {!rows.length ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma saída de medicamento encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Data / Hora</th>
                <th className="px-3 py-2">Medicamento</th>
                <th className="px-3 py-2 text-right">Qtd.</th>
                <th className="px-3 py-2">Lote</th>
                <th className="px-3 py-2">Paciente</th>
                <th className="px-3 py-2">Médico prescritor</th>
                <th className="px-3 py-2">Dispensado por</th>
                <th className="px-3 py-2">Documento</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {new Date(r.at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {r.item}
                    {r.reason && <div className="text-[11px] font-normal text-muted-foreground">{r.reason}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{r.qty}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{r.lot || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.patient}</div>
                    {(r.ward || r.bed) && (
                      <div className="text-[11px] text-muted-foreground">
                        {[r.ward, r.bed ? `Leito ${r.bed}` : ""].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.prescriber}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.dispensedBy}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">
                    {r.fia ? `FIA ${r.fia}` : r.baa ? r.baa : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}