import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HOTELARIA_LABELS, hotelariaOccupancy, isHotelariaFresh, type HotelariaResult, type HotelariaStatus } from "@/lib/hotelaria-beds";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/hospital-store";

const STATUS_CLASS: Record<HotelariaStatus, string> = {
  ocupado: "bg-bed-occupied text-primary-foreground",
  aguardando_higienizacao: "bg-bed-discharge text-foreground",
  higienizacao: "bg-bed-cleaning text-foreground",
  higienizacao_concluida: "bg-clinical-soft text-foreground",
  disponivel: "bg-bed-free text-foreground",
  bloqueado: "bg-destructive text-destructive-foreground",
};
export function HotelariaBedMap({ data, onRefresh, refreshing }: { data: HotelariaResult; onRefresh?: () => void; refreshing?: boolean }) {
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const patients = useStore((s) => s.patients);
  const who = (codigo: string) => patients.find((p) => p.bed === codigo);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const snapshot = data.snapshot;
  const fresh = data.status === "connected" && !!snapshot && isHotelariaFresh(snapshot.generatedAt, now || Date.now());
  const all = snapshot?.setores.flatMap((s) => s.leitos) ?? [];
  const bed = all.find((b) => b.id === selected);
  return <section className="space-y-4" aria-label="Mapa da Hotelaria">
    <header className="flex flex-wrap justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Mapa de leitos em tempo real · Hospital Care Connect</h2>
        {fresh && <span className="inline-flex items-center gap-1.5 rounded-full bg-bed-free/30 px-2.5 py-0.5 text-xs font-medium text-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Tempo real (5s)</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className={cn("text-sm", fresh ? "text-muted-foreground" : "text-destructive")}>
          {fresh ? `Atualizado às ${new Date(data.checkedAt).toLocaleTimeString("pt-BR")}` : data.message}
        </span>
        {onRefresh && <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={onRefresh}>{refreshing ? "Atualizando…" : "Atualizar agora"}</Button>}
      </div>
    </header>
    {!fresh && <p className="border-l-4 border-destructive bg-muted p-3 text-sm">Disponibilidade não confirmada. Liberação de leitos da Hotelaria indisponível.</p>}
    {snapshot && <>
      <div className="flex flex-wrap gap-3 text-xs">{Object.entries(HOTELARIA_LABELS).map(([status, label]) => <span key={status} className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-sm", STATUS_CLASS[status as HotelariaStatus])} />{label}</span>)}</div>
      {snapshot.setores.map((sector) => { const so = hotelariaOccupancy({ ...snapshot, setores: [sector] }); return <section key={sector.id} className="border-t pt-4">
        <div className="mb-3 flex justify-between gap-2"><h3 className="font-semibold">{sector.nome}</h3><span className="text-xs text-muted-foreground">{so.total} leitos · <b>{so.ocupado}</b> ocupados · {so.disponivel} livres{so.higienizacao ? ` · ${so.higienizacao} em higienização` : ""}{so.bloqueado ? ` · ${so.bloqueado} bloqueados` : ""}</span></div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-8 lg:grid-cols-12">{sector.leitos.map((b) => {
          const localPatient = who(b.codigo);
          const hotelariaNote = b.observacao?.trim() || null;
          const shortLabel = localPatient
            ? localPatient.name.split(" ").slice(0, 2).join(" ")
            : fresh && b.status === "ocupado"
              ? (hotelariaNote ? hotelariaNote.split(/\s+/).slice(0, 2).join(" ") : "Hotelaria")
              : null;
          const tooltip = `${b.codigo} — ${fresh ? HOTELARIA_LABELS[b.status] : "Situação não confirmada"}${localPatient ? ` · ${localPatient.name}` : hotelariaNote ? ` · ${hotelariaNote}` : ""}`;
          return <Button key={b.id} variant="ghost" onClick={() => setSelected(b.id)} title={tooltip} className={cn("h-auto min-h-12 min-w-0 flex-col whitespace-normal break-words rounded-sm px-1 py-2 text-xs leading-tight", fresh ? STATUS_CLASS[b.status] : "bg-muted text-muted-foreground", /isolamento/i.test(b.codigo) && "ring-2 ring-bed-isolation")}>
            {b.codigo}{/isolamento/i.test(b.codigo) && <span className="text-xs">ISO</span>}{shortLabel && <span className="block w-full truncate text-[10px] font-normal">{shortLabel}</span>}
          </Button>;
        })}</div>
      </section>; })}
    </>}
    <Dialog open={!!bed} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent><DialogHeader><DialogTitle>Leito {bed?.codigo}</DialogTitle></DialogHeader>{bed && <div className="space-y-2 text-sm"><p>{fresh ? HOTELARIA_LABELS[bed.status] : "Situação não confirmada"}</p>{who(bed.codigo) && <p><b>Paciente:</b> {who(bed.codigo)!.name} · Pront. {who(bed.codigo)!.prontuario}</p>}{fresh && bed.status === "ocupado" && !who(bed.codigo) && (bed.observacao?.trim() ? <><p><b>Paciente (Hotelaria):</b> {bed.observacao.trim()}</p><p className="text-muted-foreground">Registrado no Hospital Care Connect — ainda não vinculado a uma internação no SIShmisc.</p></> : <p className="text-muted-foreground">Ocupado na Hotelaria — o paciente ainda não foi registrado no SIShmisc.</p>)}{bed.status !== "ocupado" && bed.observacao?.trim() && <p><b>Observação (Hotelaria):</b> {bed.observacao.trim()}</p>}<p className="text-muted-foreground">Última alteração: {new Date(bed.atualizado_em).toLocaleString("pt-BR")}</p></div>}</DialogContent></Dialog>
  </section>;
}