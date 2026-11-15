// Pure rules for the waiting-room TV panel: call rooms and announcements.
export interface PanelCall { id: string; patientName: string; room: string; risk?: string; at: string }
export const DEFAULT_ROOMS = ["Triagem", "Consultório 01", "Consultório 02"];
export function addRoomName(rooms: string[], name: string) {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) throw new Error("Informe o nome do consultório.");
  if (rooms.some((r) => r.toLowerCase() === n.toLowerCase())) throw new Error("Esse consultório já existe.");
  return [...rooms, n];
}
export function removeRoomName(rooms: string[], name: string) {
  if (rooms.length <= 1) throw new Error("Mantenha pelo menos um local de chamada.");
  return rooms.filter((r) => r !== name);
}
export const announcement = (c: Pick<PanelCall, "patientName" | "room">) => `${c.patientName}, dirigir-se ao ${c.room}.`;
/** Keeps the newest calls first, limited to the history size shown on TV. */
export const pushCall = (calls: PanelCall[], c: PanelCall, max = 20) => [c, ...calls].slice(0, max);
