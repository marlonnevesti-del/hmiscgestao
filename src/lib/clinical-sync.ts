import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PHARMACY_CATALOG, WAREHOUSE_CATALOG, getState, setState, subscribeState } from "./hospital-store";
import { DEFAULT_CID_AREAS, DEFAULT_CID_GROUPS } from "./cid-access";
import { DEFAULT_ROOMS } from "./panel-calls";
import { DEFAULT_SPECIALTIES } from "./ambulatorio";
import { setSyncStatus } from "./sync-status";
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
  if (dirty || saving) return;
  // Cheap version check first; only download the full snapshot when it changed.
  if (version >= 0) {
    const { data: head, error } = await supabase.from("clinical_state").select("version").eq("id", "main").maybeSingle();
    setSyncStatus(error ? "offline" : "synced");
    if (!head || head.version === version) return;
  }
  const { data, error } = await supabase.from("clinical_state").select("data, version").eq("id", "main").maybeSingle();
  setSyncStatus(error ? "offline" : dirty ? "saving" : "synced");
  if (data && data.version !== version) apply(data.data as Partial<Snapshot>, data.version);
  if (!data && version === -1) version = 0;
}

async function push() {
  if (saving || !dirty || version < 0) return;
  saving = true; dirty = false; setSyncStatus("saving");
  try {
    const { data: u } = await supabase.auth.getUser();
    for (let attempt = 0; attempt < 5; attempt++) {
      const local = pick();
      const next = version + 1;
      const row = { data: local as never, version: next, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() };
      // Grava só se ninguém salvou desde a última leitura; senão mescla e tenta de novo.
      const res = version === 0
        ? await supabase.from("clinical_state").insert({ id: "main", ...row }).select("version")
        : await supabase.from("clinical_state").update(row).eq("id", "main").eq("version", version).select("version");
      if (!res.error && res.data?.length) { version = next; base = JSON.parse(JSON.stringify(local)); setSyncStatus("synced"); return; }
      const { data: remote } = await supabase.from("clinical_state").select("data, version").eq("id", "main").maybeSingle();
      if (!remote) { dirty = true; return; }
      const merged = mergeSnapshots(base, local, remote.data as Partial<Snapshot>);
      apply(merged, remote.version);
      base = JSON.parse(JSON.stringify(remote.data ?? {}));
    }
    dirty = true;
  } catch { dirty = true; setSyncStatus("offline"); } finally { saving = false; }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const idOf = (x: unknown) => (x && typeof x === "object" && "id" in x ? String((x as { id: unknown }).id) : null);
/** Mescla de três vias: mantém o que este computador alterou e o que os outros salvaram. */
export function mergeSnapshots(baseS: Partial<Snapshot>, local: Partial<Snapshot>, remote: Partial<Snapshot>): Partial<Snapshot> {
  const out: Record<string, unknown> = { ...remote };
  for (const key of KEYS) {
    const b = baseS[key], l = local[key], r = remote[key];
    if (same(l, b)) { out[key] = r; continue; }
    if (same(r, b)) { out[key] = l; continue; }
    if (Array.isArray(l) && Array.isArray(r) && [...l, ...r].every((x) => idOf(x) !== null)) {
      const bm = new Map((Array.isArray(b) ? b : []).map((x) => [idOf(x)!, x]));
      const lm = new Map(l.map((x) => [idOf(x)!, x]));
      const rm = new Map(r.map((x) => [idOf(x)!, x]));
      const result: unknown[] = [];
      for (const [id, rv] of rm) {
        const lv = lm.get(id), bv = bm.get(id);
        if (lv === undefined) { if (bv === undefined || !same(rv, bv)) result.push(rv); continue; } // apagado aqui e intacto lá
        result.push(bv !== undefined && same(lv, bv) ? rv : lv);
      }
      for (const [id, lv] of lm) if (!rm.has(id) && !bm.has(id)) result.unshift(lv); // novo neste computador
      out[key] = result;
    } else if (typeof l === "number" && typeof r === "number") out[key] = Math.max(l, r); // sequências BAA/FIA
    else out[key] = l;
  }
  return out as Partial<Snapshot>;
}

export function useClinicalSync() {
  useEffect(() => {
    let alive = true;
    void pull();
    void refillSequence("baa"); void refillSequence("fia");
    // Aviso instantâneo quando outro computador salva; o intervalo fica como reserva.
    const channel = supabase.channel(`clinical-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clinical_state" }, () => { if (dirty) void push(); else void pull(); })
      .subscribe();
    const onOff = () => setSyncStatus("offline");
    const onOn = () => { void pull(); if (dirty) void push(); };
    window.addEventListener("offline", onOff); window.addEventListener("online", onOn);
    const unsub = subscribeState(() => { if (!applying && version >= 0) { dirty = true; void push(); } });
    const t = setInterval(() => { if (!alive) return; if (dirty) void push(); else if (!document.hidden) void pull(); }, 3000);
    const onVis = () => { if (!document.hidden) void pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(t); void supabase.removeChannel(channel); window.removeEventListener("offline", onOff); window.removeEventListener("online", onOn); unsub(); document.removeEventListener("visibilitychange", onVis); };
  }, []);
}
