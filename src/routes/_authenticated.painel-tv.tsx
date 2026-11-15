import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Settings, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MANCHESTER, type Manchester } from "@/lib/hospital-data";
import { addRoom, removeRoom, useStore } from "@/lib/hospital-store";
import { announcement, type PanelCall } from "@/lib/panel-calls";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel-tv")({
  head: () => ({ meta: [
    { title: "Painel de Chamadas – HMISC" },
    { name: "description", content: "Painel de TV da sala de espera com chamada de pacientes por voz." },
    { property: "og:title", content: "Painel de Chamadas – HMISC" },
    { property: "og:description", content: "Chamada de pacientes por voz e tela para a sala de espera." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PanelPage,
});

function gong() {
  const ctx = new AudioContext();
  [[659, 0], [523, 0.55]].forEach(([f, t]) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    const s = ctx.currentTime + t; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.5, s + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, s + 1.4);
    o.start(s); o.stop(s + 1.5);
  });
  return new Promise((r) => setTimeout(r, 1700));
}
async function speak(c: PanelCall) {
  await gong();
  const u = new SpeechSynthesisUtterance(announcement(c)); u.lang = "pt-BR"; u.rate = 0.9;
  const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith("pt")); if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
const riskCls = (r?: string) => (r && r in MANCHESTER ? MANCHESTER[r as Manchester].cls : "bg-primary text-primary-foreground");

function PanelPage() {
  const calls = useStore((s) => s.calls); const profile = useStore((s) => s.profile);
  const [sound, setSound] = useState(false); const [open, setOpen] = useState(false);
  const seen = useRef<string | null>(null);
  const [now, setNow] = useState("");
  useEffect(() => { const t = () => setNow(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })); t(); const i = setInterval(t, 10000); return () => clearInterval(i); }, []);
  useEffect(() => {
    const top = calls[0]; if (!top) return;
    if (seen.current === null) { seen.current = top.id; return; } // don't replay old calls on open
    if (seen.current !== top.id) { seen.current = top.id; if (sound) void speak(top); }
  }, [calls, sound]);
  const [cur, ...rest] = calls;
  return (
    <main className="fixed inset-0 z-40 flex flex-col bg-background p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary">HMISC · Chamada de pacientes</h1>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-semibold tabular-nums">{now}</span>
          {!sound && <Button size="lg" onClick={() => { setSound(true); void gong(); }}><Volume2 className="mr-2 h-5 w-5" />Ativar som</Button>}
          {profile === "Administrador" && <Button variant="outline" size="icon" aria-label="Consultórios" onClick={() => setOpen(true)}><Settings className="h-5 w-5" /></Button>}
          <Button variant="ghost" asChild><Link to="/">Sair</Link></Button>
        </div>
      </header>
      <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="flex flex-col items-center justify-center rounded-xl border bg-card p-8 text-center">
          {cur ? <>
            <span className={cn("rounded-full px-6 py-2 text-xl font-semibold", riskCls(cur.risk))}>{cur.risk ? MANCHESTER[cur.risk as Manchester]?.label ?? cur.risk : "Chamada"}</span>
            <p className="mt-8 text-6xl font-extrabold leading-tight lg:text-8xl">{cur.patientName}</p>
            <p className="mt-8 text-4xl font-semibold text-primary lg:text-6xl">{cur.room}</p>
            <p className="mt-4 text-2xl text-muted-foreground">{new Date(cur.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          </> : <p className="text-3xl text-muted-foreground">Aguardando chamadas…</p>}
        </section>
        <aside className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-2xl font-semibold">Últimas chamadas</h2>
          <ul className="space-y-3">{rest.slice(0, 5).map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b pb-3"><span className={cn("h-10 w-2 rounded", riskCls(c.risk))} /><div><p className="text-2xl font-semibold">{c.patientName}</p><p className="text-lg text-muted-foreground">{c.room} · {new Date(c.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></div></li>
          ))}</ul>
        </aside>
      </div>
      <RoomsDialog open={open} onOpenChange={setOpen} />
    </main>
  );
}

function RoomsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rooms = useStore((s) => s.rooms); const [name, setName] = useState("");
  const run = (fn: () => void) => { try { fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Consultórios e locais de chamada</DialogTitle></DialogHeader>
        <ul className="space-y-2">{rooms.map((r) => <li key={r} className="flex items-center justify-between border-b pb-2"><span>{r}</span><Button size="icon" variant="ghost" aria-label={`Remover ${r}`} onClick={() => run(() => removeRoom(r))}><Trash2 className="h-4 w-4" /></Button></li>)}</ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => { addRoom(name); setName(""); toast.success("Consultório adicionado"); }); }}>
          <Input aria-label="Novo consultório" placeholder="Ex.: Consultório 03" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit">Adicionar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
