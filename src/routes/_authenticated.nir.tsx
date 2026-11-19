import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { HotelariaBedMap } from "@/components/HotelariaBedMap";
import { hotelariaBedsQuery } from "@/lib/hotelaria-beds-query";
import { reserveHotelariaBed } from "@/lib/hotelaria-beds.functions";
import { hotelariaBedAvailable, hotelariaOccupancy, hotelariaOccupancyRate, isHotelariaFresh } from "@/lib/hotelaria-beds";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoPermission } from "@/components/AppShell";
import { BASE_BEDS, can, MANCHESTER, WARDS } from "@/lib/hospital-data";
import { authorizeAdmission, authorizeAdmissionExternal, rejectAdmission, useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/nir")({
  loader: ({ context }) => context.queryClient.ensureQueryData(hotelariaBedsQuery),
  head: () => ({ meta: [
    { title: "NIR – Regulação de Leitos – HMI Gestão" },
    { name: "description", content: "Fila de solicitações de internação e mapa de leitos do Núcleo Interno de Regulação." },
    { property: "og:title", content: "NIR – Regulação de Leitos" },
    { property: "og:description", content: "Liberação e sequenciamento das internações do hospital." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: NirPage,
});

const ADM_WARDS = ["AC", "UTIN", "ENFP"];
const RISK_ORDER = ["vermelho", "laranja", "amarelo", "verde", "azul"];

function NirPage() {
  const { data: hotelaria } = useSuspenseQuery(hotelariaBedsQuery);
  const profile = useStore((s) => s.profile);
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const [beds, setBeds] = useState<Record<string, string>>({});
  const reserve = useServerFn(reserveHotelariaBed);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!can(profile, "nir")) return <NoPermission action="acessar o NIR" />;
  const occupied = (id: string) => patients.find((p) => p.bed === id);
  const external = hotelaria.status !== "not_configured";
  const connected = hotelaria.status === "connected" && !!hotelaria.snapshot && isHotelariaFresh(hotelaria.snapshot.generatedAt);
  const extFree = connected ? hotelaria.snapshot!.setores.flatMap((st) => st.leitos.filter((l) => hotelariaBedAvailable(l.status)).map((l) => ({ id: l.id, codigo: l.codigo, setor: st.nome }))) : [];
  const occ = connected ? hotelariaOccupancy(hotelaria.snapshot!) : null;
  const free = external ? [] : BASE_BEDS.filter((b) => ADM_WARDS.includes(b.ward) && b.status === "livre" && !occupied(b.id));
  const total = BASE_BEDS.filter((b) => ADM_WARDS.includes(b.ward)).length;
  const pending = encounters.filter((e) => e.admission?.status === "pendente")
    .sort((a, b) => RISK_ORDER.indexOf(a.triage?.risk ?? "azul") - RISK_ORDER.indexOf(b.triage?.risk ?? "azul") || Date.parse(a.admission!.requestedAt) - Date.parse(b.admission!.requestedAt));
  const recent = encounters.filter((e) => e.admission && e.admission.status !== "pendente").slice(-10).reverse();
  const run = (fn: () => void, msg: string) => { try { fn(); toast.success(msg); } catch (err) { toast.error(err instanceof Error ? err.message : "Ação não concluída"); } };
  const authorizeExt = async (encId: string) => {
    const bed = extFree.find((b) => b.id === beds[encId]); if (!bed) return;
    setBusy(encId);
    try {
      const r = await reserve({ data: { leitoId: bed.id } });
      if (!r.ok) { toast.error(r.message); return; }
      authorizeAdmissionExternal(encId, r.codigo ?? bed.codigo, bed.setor);
      toast.success(`Internação autorizada · leito ${r.codigo ?? bed.codigo} ocupado na Hotelaria`);
      setBeds((x) => ({ ...x, [encId]: "" }));
    } catch (err) { toast.error(err instanceof Error ? err.message : "Ação não concluída"); }
    finally { setBusy(null); void qc.invalidateQueries({ queryKey: hotelariaBedsQuery.queryKey }); }
  };
  const wait = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold">NIR – Núcleo Interno de Regulação</h1><p className="text-sm text-muted-foreground">Solicitações de internação dos médicos e liberação de leitos.</p></div>
      <div className="flex flex-wrap gap-4 text-sm"><span><b>{pending.length}</b> aguardando</span>{occ && <><span><b>{occ.ocupado}</b> ocupados</span><span><b>{occ.disponivel}</b> livres</span><span>Ocupação <b>{hotelariaOccupancyRate(occ)}%</b></span></>}{!external && <><span><b>{free.length}</b> leitos locais livres</span><span>Ocupação <b>{Math.round(((total - free.length) / total) * 100)}%</b></span></>}</div>
    </header>

    <section className="space-y-3">
      <h2 className="font-semibold">Fila de solicitações</h2>
      {!pending.length && <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma solicitação aguardando regulação.</p>}
      {pending.map((e) => {
        const p = patients.find((x) => x.id === e.patientId); const a = e.admission!;
        const risk = e.triage ? MANCHESTER[e.triage.risk] : undefined;
        const options = free.slice().sort((x, y) => Number(y.ward === a.ward) - Number(x.ward === a.ward));
        return <article key={e.id} className="space-y-3 rounded-md border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="font-semibold">{p?.name ?? "Paciente"}</div><div className="text-xs text-muted-foreground">{e.number} · solicitado por {a.requestedBy} · espera {wait(a.requestedAt)}</div></div>
            <div className="flex flex-wrap gap-2 text-xs">
              {risk && <span className="rounded border px-2 py-0.5">{risk.label}</span>}
              <span className={cn("rounded border px-2 py-0.5", a.character === "Urgência" && "border-destructive text-destructive")}>{a.character}</span>
              {a.ward && <span className="rounded border px-2 py-0.5">{WARDS.find((w) => w.id === a.ward)?.name}</span>}
              {a.isolation && <span className="rounded border border-destructive px-2 py-0.5 text-destructive">Isolamento</span>}
              {a.oxygen && <span className="rounded border px-2 py-0.5">Oxigênio</span>}
            </div>
          </div>
          <p className="text-sm"><b>CID-10:</b> {a.cid || "—"} · <b>Justificativa:</b> {a.justification}</p>
          <div className="flex flex-wrap items-center gap-2">
            {external ? <>
              <select disabled={!connected} aria-label="Leito" className="h-9 rounded-md border bg-background px-2 text-sm" value={beds[e.id] ?? ""} onChange={(ev) => setBeds((x) => ({ ...x, [e.id]: ev.target.value }))}>
                <option value="">Selecionar leito disponível (Hotelaria)</option>
                {extFree.map((b) => <option key={b.id} value={b.id}>{b.codigo} · {b.setor}</option>)}
              </select>
              <Button disabled={!connected || !beds[e.id] || busy === e.id} onClick={() => void authorizeExt(e.id)}>{busy === e.id ? "Reservando…" : "Autorizar internação"}</Button>
              {!connected && <span className="text-sm text-destructive">Sem atualização da Hotelaria — reserva bloqueada.</span>}
            </> : <>
              <select aria-label="Leito" className="h-9 rounded-md border bg-background px-2 text-sm" value={beds[e.id] ?? ""} onChange={(ev) => setBeds((x) => ({ ...x, [e.id]: ev.target.value }))}>
                <option value="">Selecionar leito livre</option>
                {options.map((b) => <option key={b.id} value={b.id}>{b.id} · {WARDS.find((w) => w.id === b.ward)?.name}</option>)}
              </select>
              <Button disabled={!beds[e.id]} onClick={() => run(() => authorizeAdmission(e.id, beds[e.id] ?? ""), "Internação autorizada e leito reservado")}>Autorizar internação</Button>
            </>}
            <input aria-label="Motivo da devolução" placeholder="Motivo da devolução ao médico" className="h-9 min-w-52 flex-1 rounded-md border bg-background px-2 text-sm" value={notes[e.id] ?? ""} onChange={(ev) => setNotes((x) => ({ ...x, [e.id]: ev.target.value }))} />
            <Button variant="outline" onClick={() => run(() => rejectAdmission(e.id, notes[e.id] ?? ""), "Solicitação devolvida ao médico")}>Devolver</Button>
          </div>
        </article>;
      })}
    </section>

    <HotelariaBedMap data={hotelaria} />
    {!external && <section className="space-y-3">
      <h2 className="font-semibold">Mapa de leitos</h2>
      {WARDS.filter((w) => ADM_WARDS.includes(w.id)).map((w) => <div key={w.id}>
        <h3 className="mb-2 text-sm font-medium">{w.name}</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {BASE_BEDS.filter((b) => b.ward === w.id).map((b) => { const p = occupied(b.id); const busy = !!p || b.status !== "livre";
            return <div key={b.id} className={cn("rounded-md border p-2 text-xs", busy ? "bg-muted" : "border-primary")}><div className="font-semibold">{b.id}</div><div className="truncate text-muted-foreground">{p ? p.name : b.status === "livre" ? "Livre" : b.status}</div></div>; })}
        </div>
      </div>)}
    </section>}

    {!!recent.length && <section className="space-y-2"><h2 className="font-semibold">Últimas decisões</h2><ul className="space-y-1 text-sm">{recent.map((e) => <li key={e.id}>{patients.find((x) => x.id === e.patientId)?.name} · {e.admission!.status === "autorizada" ? `autorizada – leito ${e.admission!.bed}` : `devolvida – ${e.admission!.note}`} · {e.admission!.decidedBy}</li>)}</ul></section>}
  </div>;
}
