import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { announcePatient, useStore } from "@/lib/hospital-store";

const KEY = "hmisc-call-room";
/** Room selector (remembered per computer) + button that announces the patient on the waiting-room TV. */
/** fixedRoom locks the call location (e.g. "Triagem" on the acolhimento screen). */
export function CallPanelButton({ patientId, fixedRoom }: { patientId: string; fixedRoom?: string }) {
  const rooms = useStore((s) => s.rooms);
  const [room, setRoom] = useState("");
  useEffect(() => { setRoom(localStorage.getItem(KEY) ?? ""); }, []);
  const current = fixedRoom ?? (rooms.includes(room) ? room : rooms[0] ?? "");
  return (
    <div className="flex items-center gap-1">
      {fixedRoom ? <span className="rounded-md border px-2 py-1.5 text-sm">{fixedRoom}</span> : <select aria-label="Local da chamada" value={current} onChange={(e) => { setRoom(e.target.value); localStorage.setItem(KEY, e.target.value); }} className="h-9 rounded-md border bg-background px-2 text-sm">
        {rooms.map((r) => <option key={r}>{r}</option>)}
      </select>}
      <Button variant="secondary" onClick={() => { try { announcePatient(patientId, current); toast.success(`Chamada enviada ao painel – ${current}`); } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível chamar"); } }}>
        <Megaphone className="mr-1 h-4 w-4" />Chamar no painel
      </Button>
    </div>
  );
}
