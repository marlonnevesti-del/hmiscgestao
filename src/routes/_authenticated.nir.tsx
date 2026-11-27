import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { HotelariaBedMap } from "@/components/HotelariaBedMap";
import { hotelariaBedsQuery } from "@/lib/hotelaria-beds-query";
import { releaseHotelariaBed, reserveHotelariaBed } from "@/lib/hotelaria-beds.functions";
import { hotelariaBedAvailable, hotelariaOccupancy, hotelariaOccupancyRate, isHotelariaFresh } from "@/lib/hotelaria-beds";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoPermission } from "@/components/AppShell";
import { BASE_BEDS, canAct, MANCHESTER, WARDS } from "@/lib/hospital-data";
import { authorizeAdmission, authorizeAdmissionExternal, rejectAdmission, requestAdmission, revertAdmission, transferBed, useStore } from "@/lib/hospital-store";
import { bedAgeIssue } from "@/lib/nir-rules";
import type { Encounter } from "@/lib/care-flow";
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
  const { data: hotelaria, isFetching, refetch } = useSuspenseQuery(hotelariaBedsQuery);
  const profile = useStore((s) => s.profile);
  const accessAreas = useStore((s) => s.accessAreas);
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const [beds, setBeds] = useState<Record<string, string>>({});
  const reserve = useServerFn(reserveHotelariaBed);
  const release = useServerFn(releaseHotelariaBed);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [transferEnc, setTransferEnc] = useState<Encounter | null>(null);
  const [transferBedId, setTransferBedId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [cancelEnc, setCancelEnc] = useState<Encounter | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardEncId, setForwardEncId] = useState("");
  const [forwardForm, setForwardForm] = useState({ ward: "", character: "Urgência" as "Urgência" | "Eletiva", cid: "", justification: "", isolation: false, oxygen: false });
  const canRegulateBed = canAct(profile, "nir", accessAreas);
  const canForward = canAct(profile, "recepcao", accessAreas) || canAct(profile, "prescrever", accessAreas);
  if (!canRegulateBed && !canForward) return <NoPermission action="acessar o NIR" />;
  const forwardable = encounters.filter((e) => e.status_fluxo !== "ALTA_HOSPITALAR" && !e.fia && e.admission?.status !== "pendente").slice().reverse();
  const occupied = (id: string) => patients.find((p) => p.bed === id);
  const external = hotelaria.status !== "not_configured";
  const connected = hotelaria.status === "connected" && !!hotelaria.snapshot && isHotelariaFresh(hotelaria.snapshot.generatedAt);
  const extFree = connected ? hotelaria.snapshot!.setores.flatMap((st) => st.leitos.filter((l) => hotelariaBedAvailable(l.status)).map((l) => ({ id: l.id, codigo: l.codigo, setor: st.nome }))) : [];
  const occ = connected ? hotelariaOccupancy(hotelaria.snapshot!) : null;
  const free = external ? [] : BASE_BEDS.filter((b) => ADM_WARDS.includes(b.ward) && b.status === "livre" && !occupied(b.id));
  const total = BASE_BEDS.filter((b) => ADM_WARDS.includes(b.ward)).length;
  const pending = encounters.filter((e) => e.admission?.status === "pendente")
    .sort((a, b) => RISK_ORDER.indexOf(a.triage?.risk ?? "azul") - RISK_ORDER.indexOf(b.triage?.risk ?? "azul") || Date.parse(a.admission!.requestedAt) - Date.parse(b.admission!.requestedAt));
  const inpatients = encounters.filter((e) => e.fia && !e.discharge && e.status_fluxo === "ENCAMINHADO_INTERNACAO").slice().reverse();
  const recent = encounters.filter((e) => e.admission && e.admission.status !== "pendente").slice(-10).reverse();
  const agePatient = (patientId: string) => { const p = patients.find((x) => x.id === patientId); return p ? { birthDate: p.registration?.birthDate, age: p.age, type: p.type } : undefined; };
  const run = (fn: () => void, msg: string) => { try { fn(); toast.success(msg); } catch (err) { toast.error(err instanceof Error ? err.message : "Ação não concluída"); } };
  const authorizeExt = async (encId: string) => {
    const enc = pending.find((e) => e.id === encId);
    const bed = extFree.find((b) => b.id === beds[encId]); if (!bed || !enc) return;
    const ageErr = bedAgeIssue(agePatient(enc.patientId), bed.codigo, bed.setor);
    if (ageErr) { toast.error(ageErr); return; }
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
  const releaseBedIfExternal = async (oldBed: string) => {
    if (!oldBed || (!external && BASE_BEDS.some((b) => b.id === oldBed))) return;
    try {
      const r = await release({ data: { codigo: oldBed } });
      if (r.ok) toast.success(r.message); else toast.warning(r.message);
    } catch { toast.warning(`Leito ${oldBed} liberado no sistema, mas sem comunicação com a Hotelaria.`); }
  };
  const confirmTransfer = async () => {
    if (!transferEnc) return;
    const reason = transferReason.trim();
    if (!reason) { toast.error("Informe o motivo da troca de leito."); return; }
    if (external) {
      const bed = extFree.find((b) => b.id === transferBedId); if (!bed) { toast.error("Selecione o novo leito."); return; }
      const ageErr = bedAgeIssue(agePatient(transferEnc.patientId), bed.codigo, bed.setor);
      if (ageErr) { toast.error(ageErr); return; }
      setBusy(transferEnc.id);
      try {
        const r = await reserve({ data: { leitoId: bed.id } });
        if (!r.ok) { toast.error(r.message); return; }
        const oldBed = transferBed(transferEnc.id, r.codigo ?? bed.codigo, bed.setor, reason);
        toast.success(`Leito trocado: ${oldBed} → ${r.codigo ?? bed.codigo}`);
        setTransferEnc(null); setTransferBedId(""); setTransferReason("");
        await releaseBedIfExternal(oldBed);
      } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível trocar o leito"); }
      finally { setBusy(null); void qc.invalidateQueries({ queryKey: hotelariaBedsQuery.queryKey }); }
    } else {
      const bed = free.find((b) => b.id === transferBedId); if (!bed) { toast.error("Selecione o novo leito."); return; }
      run(() => {
        const oldBed = transferBed(transferEnc.id, bed.id, bed.ward, reason);
        setTransferEnc(null); setTransferBedId(""); setTransferReason("");
        void releaseBedIfExternal(oldBed);
      }, `Leito trocado para ${bed.id}`);
    }
  };
  const confirmCancel = async () => {
    if (!cancelEnc) return;
    const reason = cancelReason.trim();
    if (!reason) { toast.error("Informe a justificativa do cancelamento."); return; }
    setBusy(cancelEnc.id);
    try {
      const oldBed = revertAdmission(cancelEnc.id, reason);
      toast.success(`Internação cancelada · ${cancelEnc.number} reaberta`);
      setCancelEnc(null); setCancelReason("");
      await releaseBedIfExternal(oldBed);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível cancelar a internação"); }
    finally { setBusy(null); void qc.invalidateQueries({ queryKey: hotelariaBedsQuery.queryKey }); }
  };
  const wait = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold">NIR – Núcleo Interno de Regulação</h1><p className="text-sm text-muted-foreground">{canRegulateBed ? "Solicitações de internação, mapa em tempo real e liberação de leitos." : "Encaminhamento de internação pela recepção e mapa de leitos em tempo real. A escolha do leito é feita pelo regulador do NIR."}</p></div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span><b>{pending.length}</b> aguardando</span>
        {occ && <><span><b>{occ.ocupado}</b> ocupados</span><span><b>{occ.disponivel}</b> livres</span><span>Ocupação <b>{hotelariaOccupancyRate(occ)}%</b></span></>}
        {!external && <><span><b>{free.length}</b> leitos locais livres</span><span>Ocupação <b>{Math.round(((total - free.length) / total) * 100)}%</b></span></>}
        {canForward && <Button size="sm" onClick={() => { setForwardEncId(""); setForwardForm({ ward: "", character: "Urgência", cid: "", justification: "", isolation: false, oxygen: false }); setForwardOpen(true); }}>Encaminhar internação</Button>}
      </div>
    </header>

    <HotelariaBedMap data={hotelaria} onRefresh={() => void refetch()} refreshing={isFetching} />

    <section className="space-y-3">
      <h2 className="font-semibold">Fila de solicitações</h2>
      {!pending.length && <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma solicitação aguardando regulação.</p>}
      {pending.map((e) => {
        const p = patients.find((x) => x.id === e.patientId); const a = e.admission!;
        const risk = e.triage ? MANCHESTER[e.triage.risk] : undefined;
        const options = free.slice().sort((x, y) => Number(y.ward === a.ward) - Number(x.ward === a.ward));
        const ap = agePatient(e.patientId);
        return <article key={e.id} className="space-y-3 rounded-md border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="font-semibold">{p?.name ?? "Paciente"}{p?.age ? <span className="ml-2 text-xs font-normal text-muted-foreground">({p.age})</span> : null}</div><div className="text-xs text-muted-foreground">{e.number} · solicitado por {a.requestedBy} · espera {wait(a.requestedAt)}</div></div>
            <div className="flex flex-wrap gap-2 text-xs">
              {risk && <span className="rounded border px-2 py-0.5">{risk.label}</span>}
              <span className={cn("rounded border px-2 py-0.5", a.character === "Urgência" && "border-destructive text-destructive")}>{a.character}</span>
              {a.ward && <span className="rounded border px-2 py-0.5">{WARDS.find((w) => w.id === a.ward)?.name}</span>}
              {a.isolation && <span className="rounded border border-destructive px-2 py-0.5 text-destructive">Isolamento</span>}
              {a.oxygen && <span className="rounded border px-2 py-0.5">Oxigênio</span>}
            </div>
          </div>
          <p className="text-sm"><b>CID-10:</b> {a.cid || "—"} · <b>Justificativa:</b> {a.justification}</p>
          {canRegulateBed ? <div className="flex flex-wrap items-center gap-2">
            {external ? <>
              <select disabled={!connected} aria-label="Leito" className="h-9 rounded-md border bg-background px-2 text-sm" value={beds[e.id] ?? ""} onChange={(ev) => setBeds((x) => ({ ...x, [e.id]: ev.target.value }))}>
                <option value="">Selecionar leito disponível (Hotelaria)</option>
                {extFree.map((b) => { const err = bedAgeIssue(ap, b.codigo, b.setor); return <option key={b.id} value={b.id} disabled={!!err}>{b.codigo} · {b.setor}{err ? " (incompatível por idade)" : ""}</option>; })}
              </select>
              <Button disabled={!connected || !beds[e.id] || busy === e.id} onClick={() => void authorizeExt(e.id)}>{busy === e.id ? "Reservando…" : "Autorizar internação"}</Button>
              {!connected && <span className="text-sm text-destructive">Sem atualização da Hotelaria — reserva bloqueada.</span>}
            </> : <>
              <select aria-label="Leito" className="h-9 rounded-md border bg-background px-2 text-sm" value={beds[e.id] ?? ""} onChange={(ev) => setBeds((x) => ({ ...x, [e.id]: ev.target.value }))}>
                <option value="">Selecionar leito livre</option>
                {options.map((b) => { const err = bedAgeIssue(ap, b.id, b.ward); return <option key={b.id} value={b.id} disabled={!!err}>{b.id} · {WARDS.find((w) => w.id === b.ward)?.name}{err ? " (incompatível por idade)" : ""}</option>; })}
              </select>
              <Button disabled={!beds[e.id]} onClick={() => run(() => authorizeAdmission(e.id, beds[e.id] ?? ""), "Internação autorizada e leito reservado")}>Autorizar internação</Button>
            </>}
            <input aria-label="Motivo da devolução" placeholder="Motivo da devolução ao médico" className="h-9 min-w-52 flex-1 rounded-md border bg-background px-2 text-sm" value={notes[e.id] ?? ""} onChange={(ev) => setNotes((x) => ({ ...x, [e.id]: ev.target.value }))} />
            <Button variant="outline" onClick={() => run(() => rejectAdmission(e.id, notes[e.id] ?? ""), "Solicitação devolvida ao médico")}>Devolver</Button>
          </div> : <p className="text-xs font-medium text-muted-foreground">Aguardando escolha e autorização de leito pelo regulador do NIR.</p>}
        </article>;
      })}
    </section>

    <section className="space-y-3">
      <h2 className="font-semibold">Pacientes internados ({inpatients.length})</h2>
      {!inpatients.length && <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum paciente internado com FIA ativa.</p>}
      {inpatients.map((e) => {
        const p = patients.find((x) => x.id === e.patientId);
        const currentBed = p?.bed || e.fia!.bed;
        const ageAlert = bedAgeIssue(agePatient(e.patientId), currentBed, e.fia!.ward);
        return <article key={e.id} className={cn("flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-4", ageAlert && "border-destructive")}>
          <div className="space-y-1">
            <div className="font-semibold">{p?.name ?? "Paciente"}{p?.age ? <span className="ml-2 text-xs font-normal text-muted-foreground">({p.age})</span> : null}</div>
            <div className="text-xs text-muted-foreground">Leito <b>{currentBed}</b> · {e.fia!.ward} · {e.fia!.number} · {e.number}</div>
            {ageAlert && <div className="text-xs font-medium text-destructive">{ageAlert}</div>}
          </div>
          {canRegulateBed && <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => { setTransferEnc(e); setTransferBedId(""); setTransferReason(""); }}>Trocar leito</Button>
            <Button size="sm" variant="destructive" disabled={busy === e.id} onClick={() => { setCancelEnc(e); setCancelReason(""); }}>Cancelar internação</Button>
          </div>}
        </article>;
      })}
    </section>

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

    <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Encaminhar paciente para internação (NIR)</DialogTitle></DialogHeader>
        <div className="grid gap-3 text-sm">
          <p className="text-xs text-muted-foreground">O encaminhamento entra na fila do NIR. A escolha do leito é feita exclusivamente pelo regulador do NIR.</p>
          <label className="grid gap-1">Atendimento / Paciente
            <select aria-label="Atendimento do paciente" className="h-9 rounded-md border bg-background px-2" value={forwardEncId} onChange={(ev) => setForwardEncId(ev.target.value)}>
              <option value="">Selecionar atendimento aberto…</option>
              {forwardable.map((enc) => { const pt = patients.find((x) => x.id === enc.patientId); return <option key={enc.id} value={enc.id}>{pt?.name ?? "Paciente"} · {enc.number} ({enc.type})</option>; })}
            </select>
          </label>
          <label className="grid gap-1">Caráter
            <select aria-label="Caráter" className="h-9 rounded-md border bg-background px-2" value={forwardForm.character} onChange={(ev) => setForwardForm((x) => ({ ...x, character: ev.target.value as "Urgência" | "Eletiva" }))}>
              <option>Urgência</option><option>Eletiva</option>
            </select>
          </label>
          <label className="grid gap-1">Setor sugerido (opcional)
            <select aria-label="Setor sugerido" className="h-9 rounded-md border bg-background px-2" value={forwardForm.ward} onChange={(ev) => setForwardForm((x) => ({ ...x, ward: ev.target.value }))}>
              <option value="">Definir pelo NIR</option>
              {WARDS.filter((w) => ["AC", "UTIN", "ENFP", "UTIP", "UCI"].includes(w.id)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1">CID-10 (opcional)
            <input value={forwardForm.cid} onChange={(ev) => setForwardForm((x) => ({ ...x, cid: ev.target.value }))} className="h-9 rounded-md border bg-background px-2" placeholder="Ex.: J18.9" />
          </label>
          <label className="grid gap-1">Justificativa / Motivo do encaminhamento
            <textarea value={forwardForm.justification} onChange={(ev) => setForwardForm((x) => ({ ...x, justification: ev.target.value }))} className="min-h-20 rounded-md border bg-background p-2" placeholder="Descreva o motivo do encaminhamento para internação" />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={forwardForm.isolation} onChange={(ev) => setForwardForm((x) => ({ ...x, isolation: ev.target.checked }))} />Precisa de isolamento</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={forwardForm.oxygen} onChange={(ev) => setForwardForm((x) => ({ ...x, oxygen: ev.target.checked }))} />Precisa de oxigênio</label>
          <Button disabled={!forwardEncId} onClick={() => run(() => { requestAdmission(forwardEncId, { ...forwardForm, source: "recepcao" }); setForwardOpen(false); }, "Encaminhamento enviado ao NIR (aguardando leito)")}>Confirmar encaminhamento ao NIR</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={!!transferEnc} onOpenChange={(o) => !o && setTransferEnc(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Trocar leito</DialogTitle></DialogHeader>
        {transferEnc && (() => {
          const p = patients.find((x) => x.id === transferEnc.patientId);
          const ap = agePatient(transferEnc.patientId);
          return <div className="space-y-3 text-sm">
            <p><b>{p?.name ?? "Paciente"}</b>{p?.age ? ` (${p.age})` : ""} · Leito atual: <b>{p?.bed || transferEnc.fia?.bed}</b> ({transferEnc.fia?.ward})</p>
            <select aria-label="Novo leito" disabled={external && !connected} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={transferBedId} onChange={(ev) => setTransferBedId(ev.target.value)}>
              <option value="">{external ? "Selecionar novo leito disponível (Hotelaria)" : "Selecionar novo leito livre"}</option>
              {external
                ? extFree.map((b) => { const err = bedAgeIssue(ap, b.codigo, b.setor); return <option key={b.id} value={b.id} disabled={!!err}>{b.codigo} · {b.setor}{err ? " (incompatível por idade)" : ""}</option>; })
                : free.map((b) => { const err = bedAgeIssue(ap, b.id, b.ward); return <option key={b.id} value={b.id} disabled={!!err}>{b.id} · {WARDS.find((w) => w.id === b.ward)?.name}{err ? " (incompatível por idade)" : ""}</option>; })}
            </select>
            {external && !connected && <p className="text-xs text-destructive">Sem atualização da Hotelaria — troca bloqueada.</p>}
            <input aria-label="Motivo da troca de leito" placeholder="Motivo da troca de leito (obrigatório)" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={transferReason} onChange={(ev) => setTransferReason(ev.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransferEnc(null)}>Fechar</Button>
              <Button disabled={(external && !connected) || !transferBedId || !transferReason.trim() || busy === transferEnc.id} onClick={() => void confirmTransfer()}>{busy === transferEnc.id ? "Transferindo…" : "Confirmar troca"}</Button>
            </div>
          </div>;
        })()}
      </DialogContent>
    </Dialog>

    <Dialog open={!!cancelEnc} onOpenChange={(o) => !o && setCancelEnc(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cancelar internação</DialogTitle></DialogHeader>
        {cancelEnc && (() => {
          const p = patients.find((x) => x.id === cancelEnc.patientId);
          return <div className="space-y-3 text-sm">
            <p>A <b>{cancelEnc.fia?.number}</b> de <b>{p?.name ?? "Paciente"}</b> será cancelada, a <b>{cancelEnc.number}</b> será reaberta e o leito <b>{p?.bed || cancelEnc.fia?.bed}</b> será liberado.</p>
            <input aria-label="Justificativa do cancelamento" placeholder="Justificativa do cancelamento (obrigatória)" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={cancelReason} onChange={(ev) => setCancelReason(ev.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelEnc(null)}>Fechar</Button>
              <Button variant="destructive" disabled={!cancelReason.trim() || busy === cancelEnc.id} onClick={() => void confirmCancel()}>{busy === cancelEnc.id ? "Cancelando…" : "Confirmar cancelamento"}</Button>
            </div>
          </div>;
        })()}
      </DialogContent>
    </Dialog>
  </div>;
}
