import { supabase } from "@/integrations/supabase/client";
import { getState, setState } from "./hospital-store";
import { pushCall, type PanelCall } from "./panel-calls";

// Instant TV call delivery: broadcast on a shared room; the 3s snapshot sync stays as fallback.
const ROOM = "hmisc-panel-calls";
let ch: ReturnType<typeof supabase.channel> | null = null;
function channel() {
  if (!ch) { ch = supabase.channel(ROOM); ch.subscribe(); }
  return ch;
}
export function broadcastCall(call: PanelCall) {
  void channel().send({ type: "broadcast", event: "call", payload: call });
}
export function listenCalls() {
  const c = supabase.channel(ROOM).on("broadcast", { event: "call" }, ({ payload }) => {
    const call = payload as PanelCall;
    if (!call?.id || getState().calls.some((x) => x.id === call.id)) return;
    setState((s) => ({ calls: pushCall(s.calls, call) }));
  });
  ch = c; c.subscribe();
  return () => { void supabase.removeChannel(c); ch = null; };
}
