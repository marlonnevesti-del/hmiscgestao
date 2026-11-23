import { useSyncExternalStore } from "react";

export type SyncStatus = "synced" | "saving" | "offline";
let status: SyncStatus = "synced";
const ls = new Set<() => void>();
export function setSyncStatus(s: SyncStatus) { if (s !== status) { status = s; ls.forEach((l) => l()); } }
export function useSyncStatus() {
  return useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => status, () => "synced" as SyncStatus);
}
