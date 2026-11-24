import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PHARMACY_CATALOG, WAREHOUSE_CATALOG, getState, setState, subscribeState } from "./hospital-store";
import { DEFAULT_CID_AREAS, DEFAULT_CID_GROUPS } from "./cid-access";
import { DEFAULT_ROOMS } from "./panel-calls";
import { DEFAULT_SPECIALTIES } from "./ambulatorio";
import { registerSyncRetry, setSyncStatus } from "./sync-status";
import { refillSequence } from "./sequence-pool";
import { mergeCatalog, normalizeStock } from "./pharmacy-stock";

// Shared clinical data persisted as one snapshot row; keys below are the durable part of the store.
const KEYS = ["encounters", "beSequence", "fiaSequence", "stock", "patients", "queue", "surgeries", "admins", "rooms", "calls", "warehouse", "cidGroups", "cidAreas", "removedStock", "movements", "requests", "ambSpecialties", "appointments", "cmeKits", "cmeCycles", "doctors", "milkBank"] as const;
type Snapshot = Record<(typeof KEYS)[number], unknown>;
const pick = () => Object.fromEntries(KEYS.map((k) => [k, getState()[k]])) as Snapshot;

let version = -1;
/** Último snapshot confirmado com o servidor: base para a mesclagem em conflito. */
let base: Partial<Snapshot> = {};
let applying = false;
let dirty = false;
let saving = false;

function apply(data: Partial<Snapshot>, v: number) {
  version = v;
  base = JSON.parse(JSON.stringify(data ?? {}));
  if (!data || !Object.keys(data).length) return;
  const removed = Array.isArray(data.removedStock) ? (data.removedStock as string[]) : [];
  applying = true;
  const clinical = Object.fromEntries(KEYS.filter((key) => key in data).map((key) => [key, data[key]]));
  setState(() => ({ ...clinical, stock: mergeCatalog(normalizeStock(data.stock), PHARMACY_CATALOG, removed), warehouse: mergeCatalog(normalizeStock(data.warehouse), WAREHOUSE_CATALOG, removed), ...(Array.isArray(data.rooms) && data.rooms.length ? {} : { rooms: DEFAULT_ROOMS }), ...(Array.isArray(data.calls) ? {} : { calls: [] }), ...(Array.isArray(data.movements) ? {} : { movements: [] }), ...(Array.isArray(data.requests) ? {} : { requests: [] }), ...(Array.isArray(data.ambSpecialties) && data.ambSpecialties.length ? {} : { ambSpecialties: DEFAULT_SPECIALTIES }), ...(Array.isArray(data.appointments) ? {} : { appointments: [] }), ...(Array.isArray(data.doctors) ? {} : { doctors: [] }), ...(Array.isArray(data.cidGroups) && data.cidGroups.length ? {} : { cidGroups: DEFAULT_CID_GROUPS }), ...(Array.isArray(data.cidAreas) ? {} : { cidAreas: DEFAULT_CID_AREAS }) }) as never);
  applying = false;
}

async function pull() {
  if (saving) return;
  // Cheap version check first; only download the full snapshot when it changed.
  if (version >= 0) {
    const { data: head, error } = await supabase.from("clinical_state").select("version").eq("id", "main").maybeSingle();
    setSyncStatus(error ? "offline" : dirty ? "pending" : "synced");
    if (!head || head.version === version) return;
  }
  const { data, error } = await supabase.from("clinical_state").select("data, version").eq("id", "main").maybeSingle();
  setSyncStatus(error ? "offline" : dirty ? "pending" : "synced");
  if (data && data.version !== version) {
    const remote = (data.data ?? {}) as Partial<Snapshot>;
    if (dirty) {
      // Mantém alterações locais pendentes e incorpora o que outros computadores salvaram.
      const merged = mergeSnapshots(base, pick(), remote);
      apply(merged, data.version);
      base = JSON.parse(JSON.stringify(remote));
      void push();
    } else {
      apply(remote, data.version);
    }
  }
  if (!data && version === -1) version = 0;
  if (dirty && version >= 0) void push();
}

async function push() {
  if (saving || !dirty || version < 0) return;
  saving = true; dirty = false; setSyncStatus("saving");
  try {
    const { data: u } = await supabase.auth.getUser();
    let lastError = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const local = pick();
      const next = version + 1;
      const row = { data: local as never, version: next, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() };
      // Grava só se ninguém salvou desde a última leitura; senão mescla e tenta de novo.
      const res = version === 0
        ? await supabase.from("clinical_state").insert({ id: "main", ...row }).select("version")
        : await supabase.from("clinical_state").update(row).eq("id", "main").eq("version", version).select("version");
      if (!res.error && res.data?.length) { version = next; base = JSON.parse(JSON.stringify(local)); if (!dirty) clearPending(); setSyncStatus("synced"); tabs?.postMessage("saved"); return; }
      if (res.error) lastError = true;
      const { data: remote } = await supabase.from("clinical_state").select("data, version").eq("id", "main").maybeSingle();
      if (!remote) { dirty = true; savePending(); setSyncStatus("offline"); return; }
      const merged = mergeSnapshots(base, local, remote.data as Partial<Snapshot>);
      apply(merged, remote.version);
      base = JSON.parse(JSON.stringify(remote.data ?? {}));
    }
    dirty = true; savePending(); setSyncStatus(lastError ? "offline" : "pending");
  } catch { dirty = true; savePending(); setSyncStatus("offline"); } finally {
    saving = false;
    if (dirty && version >= 0) void push();
  }
}

export async function forceSync() {
  await pull();
  if (dirty && version >= 0) await push();
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const idOf = (x: unknown) => (x && typeof x === "object" && "id" in x ? String((x as { id: unknown }).id) : null);
const keyOf = (x: unknown) => idOf(x) ?? JSON.stringify(x);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Mescla de três vias recursiva: campos e listas internas (evoluções, sinais, prescrições) se somam. */
export function merge3(b: unknown, l: unknown, r: unknown, sum = false): unknown {
  if (same(l, b)) return r;
  if (same(r, b) || same(l, r)) return l;
  if (sum && typeof l === "number" && typeof r === "number" && typeof b === "number") return l + r - b; // saldos: soma as duas baixas
  if (Array.isArray(l) && Array.isArray(r)) {
    const bm = new Map((Array.isArray(b) ? b : []).map((x) => [keyOf(x), x]));
    const lm = new Map(l.map((x) => [keyOf(x), x]));
    const result: unknown[] = [];
    const seen = new Set<string>();
    for (const rv of r) {
      const k = keyOf(rv); seen.add(k);
      const lv = lm.get(k), bv = bm.get(k);
      if (lv === undefined) { if (bv === undefined || !same(rv, bv)) result.push(rv); continue; } // apagado aqui e intacto lá
      result.push(bv === undefined ? lv : merge3(bv, lv, rv, sum));
    }
    // novos neste computador, mantendo a posição relativa (início ou fim da lista)
    l.forEach((lv, i) => { const k = keyOf(lv); if (seen.has(k) || bm.has(k)) return; if (i < l.length / 2) result.unshift(lv); else result.push(lv); });
    return result;
  }
  if (isObj(l) && isObj(r)) {
    const bo = isObj(b) ? b : {};
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      if (!(k in l) && k in bo) continue; // removido aqui
      if (!(k in r) && k in bo && same(l[k], bo[k])) continue; // removido lá
      out[k] = k in l && k in r ? merge3(bo[k], l[k], r[k], sum) : k in l ? l[k] : r[k];
    }
    return out;
  }
  return l;
}

/** Mescla de três vias: mantém o que este computador alterou e o que os outros salvaram. */
export function mergeSnapshots(baseS: Partial<Snapshot>, local: Partial<Snapshot>, remote: Partial<Snapshot>): Partial<Snapshot> {
  const out: Record<string, unknown> = { ...remote };
  for (const key of KEYS) {
    const l = local[key], r = remote[key];
    out[key] = typeof l === "number" && typeof r === "number" ? Math.max(l, r) : merge3(baseS[key], l, r, key === "stock" || key === "warehouse" || key === "milkBank"); // sequências BAA/FIA; só saldos somam baixas
  }
  return out as Partial<Snapshot>;
}

// Rascunho local: alterações ainda não confirmadas pelo servidor sobrevivem a F5, queda de rede ou fechar a aba.
const PENDING = "hmisc-clinical-pending";
function savePending() {
  try { localStorage.setItem(PENDING, JSON.stringify({ base, local: pick(), at: Date.now() })); } catch { /* cota cheia: segue só em memória */ }
}
function clearPending() { try { localStorage.removeItem(PENDING); } catch { /* ignore */ } }
function restorePending() {
  try {
    const raw = localStorage.getItem(PENDING); if (!raw) return;
    const p = JSON.parse(raw) as { base: Partial<Snapshot>; local: Partial<Snapshot> };
    const merged = mergeSnapshots(p.base ?? {}, p.local ?? {}, base);
    const remoteBase = base;
    apply(merged, version);
    base = remoteBase;
    dirty = true; void push();
  } catch { clearPending(); }
}
let tabs: BroadcastChannel | null = null;

export function useClinicalSync() {
  useEffect(() => {
    let alive = true;
    registerSyncRetry(() => { void forceSync(); });
    void pull().then(() => { if (alive) restorePending(); });
    // Outras abas do mesmo computador recarregam na hora em vez de disputar a versão.
    tabs = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("hmisc-clinical") : null;
    if (tabs) tabs.onmessage = () => { if (dirty) void push(); else void pull(); };
    const onUnload = () => { if (dirty || saving) savePending(); };
    window.addEventListener("beforeunload", onUnload);
    void refillSequence("baa"); void refillSequence("fia");
    // Aviso instantâneo quando outro computador salva; o intervalo fica como reserva.
    const channel = supabase.channel(`clinical-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clinical_state" }, () => { if (dirty) void push(); else void pull(); })
      .subscribe();
    const onOff = () => setSyncStatus("offline");
    const onOn = () => { void pull(); if (dirty) void push(); };
    window.addEventListener("offline", onOff); window.addEventListener("online", onOn);
    // Só grava quando um dado clínico mudou de fato (login/perfil não disparam gravação).
    let last = pick();
    const unsub = subscribeState(() => {
      const now = pick();
      const changed = KEYS.some((k) => now[k] !== last[k]);
      last = now;
      if (changed && !applying) {
        dirty = true; savePending(); setSyncStatus("pending");
        if (version >= 0) void push();
      }
    });
    const t = setInterval(() => { if (!alive) return; if (dirty) void push(); else if (!document.hidden) void pull(); }, 3000);
    const onVis = () => { if (!document.hidden) void pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; registerSyncRetry(null); window.removeEventListener("beforeunload", onUnload); tabs?.close(); tabs = null; clearInterval(t); void supabase.removeChannel(channel); window.removeEventListener("offline", onOff); window.removeEventListener("online", onOn); unsub(); document.removeEventListener("visibilitychange", onVis); };
  }, []);
}
