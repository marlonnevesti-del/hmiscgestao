import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PHARMACY_CATALOG, WAREHOUSE_CATALOG, getState, setState, subscribeState } from "./hospital-store";
import { DEFAULT_CID_AREAS, DEFAULT_CID_GROUPS } from "./cid-access";
import { DEFAULT_ROOMS } from "./panel-calls";
import { mergeCatalog, normalizeStock } from "./pharmacy-stock";

// Shared clinical data persisted as one snapshot row; keys below are the durable part of the store.
const KEYS = ["encounters", "beSequence", "stock", "patients", "queue", "surgeries", "admins", "rooms", "calls", "warehouse", "cidGroups", "cidAreas", "removedStock"] as const;
type Snapshot = Record<(typeof KEYS)[number], unknown>;
const pick = () => Object.fromEntries(KEYS.map((k) => [k, getState()[k]])) as Snapshot;

let version = -1;
let applying = false;
let dirty = false;
let saving = false;

function apply(data: Partial<Snapshot>, v: number) {
  version = v;
  if (!data || !Object.keys(data).length) return;
  const removed = Array.isArray(data.removedStock) ? (data.removedStock as string[]) : [];
  applying = true;
  const clinical = Object.fromEntries(KEYS.filter((key) => key in data).map((key) => [key, data[key]]));
  setState(() => ({ ...clinical, stock: mergeCatalog(normalizeStock(data.stock), PHARMACY_CATALOG, removed), warehouse: mergeCatalog(normalizeStock(data.warehouse), WAREHOUSE_CATALOG, removed), ...(Array.isArray(data.rooms) && data.rooms.length ? {} : { rooms: DEFAULT_ROOMS }), ...(Array.isArray(data.calls) ? {} : { calls: [] }), ...(Array.isArray(data.cidGroups) && data.cidGroups.length ? {} : { cidGroups: DEFAULT_CID_GROUPS }), ...(Array.isArray(data.cidAreas) ? {} : { cidAreas: DEFAULT_CID_AREAS }) }) as never);
  applying = false;
}

async function pull() {
  if (dirty || saving) return;
  const { data } = await supabase.from("clinical_state").select("data, version").eq("id", "main").maybeSingle();
  if (data && data.version !== version) apply(data.data as Partial<Snapshot>, data.version);
  if (!data && version === -1) version = 0;
}

async function push() {
  if (saving || !dirty || version < 0) return;
  saving = true; dirty = false;
  const next = version + 1;
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("clinical_state").upsert({ id: "main", data: pick() as never, version: next, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() });
  if (error) dirty = true; else version = next;
  saving = false;
}

export function useClinicalSync() {
  useEffect(() => {
    let alive = true;
    void pull();
    const unsub = subscribeState(() => { if (!applying && version >= 0) { dirty = true; void push(); } });
    const t = setInterval(() => { if (alive) { if (dirty) void push(); else void pull(); } }, 3000);
    return () => { alive = false; clearInterval(t); unsub(); };
  }, []);
}
