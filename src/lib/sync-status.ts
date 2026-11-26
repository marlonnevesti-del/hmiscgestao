import { useSyncExternalStore } from "react";

export type SyncStatus = "synced" | "saving" | "pending" | "offline";
let status: SyncStatus = "synced";
let initialSynced = false;
let retryFn: (() => void) | null = null;
const ls = new Set<() => void>();
export function setSyncStatus(s: SyncStatus) { if (s !== status) { status = s; ls.forEach((l) => l()); } }
export function setInitialSynced(v: boolean) { if (v !== initialSynced) { initialSynced = v; ls.forEach((l) => l()); } }
export function registerSyncRetry(fn: (() => void) | null) { retryFn = fn; }
export function triggerSyncRetry() { retryFn?.(); }
export function useSyncStatus() {
  return useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => status, () => "synced" as SyncStatus);
}
export function useInitialSynced() {
  return useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => initialSynced, () => false);
}
