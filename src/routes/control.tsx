import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Pause, Play, Plus, RotateCcw, Settings2, Trash2, Zap } from "lucide-react";
import { ClassBadge, PageHeader, Panel, km } from "@/components/hud";
import { SENSOR_NAME, useSim, type SensorKey } from "@/sim/store";
import { CLASS_LABEL, range3, type Behavior, type TargetClass } from "@/sim/model";

export const Route = createFileRoute("/control")({
  head: () => ({
    meta: [
      { title: "Simulation Control Center — SkyWatch-MD" },
      { name: "description", content: "Start, pause, reset the radar simulation, inject targets, tune noise and simulate sensor failures." },
      { property: "og:title", content: "Simulation Control Center — SkyWatch-MD" },
      { property: "og:description", content: "Interactive controls for the drone detection simulation." },
    ],
  }),
  component: Control,
});

function Slider({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wider text-muted-foreground"><span>{label}</span><span className="font-mono text-cyan">{value}{unit}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-current text-radar" />
    </label>
  );
}
function Btn({ onClick, children, tone = "radar" }: { onClick: () => void; children: ReactNode; tone?: string }) {
  return <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-sm border border-${tone}/70 px-3 py-2 text-sm font-semibold text-${tone} hover:bg-${tone}/10`}>{children}</button>;
}

function Control() {
  const s = useSim();
  const [cls, setCls] = useState<TargetClass>("drone");
  const [distance, setDistance] = useState(5000);
  const [altitude, setAltitude] = useState(150);
  const [speed, setSpeed] = useState(12);
  const [heading, setHeading] = useState(180);
  const [bearing, setBearing] = useState(0);
  const [behavior, setBehavior] = useState<Behavior>("wander");

  return (
    <>
      <PageHeader code="MODULE 08 / CTL" title="Simulation Control Center" desc="All controls act on the shared simulation state — changes are reflected immediately on every module." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Simulation" icon={<Settings2 className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-3 gap-2">
            <Btn onClick={s.start}><Play className="h-4 w-4" />Start</Btn>
            <Btn onClick={s.pause} tone="warn"><Pause className="h-4 w-4" />Pause</Btn>
            <Btn onClick={s.reset} tone="cyan"><RotateCcw className="h-4 w-4" />Reset</Btn>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Time scale</div>
              <div className="flex gap-1">{[1, 2, 5, 10, 20].map((x) => <button key={x} onClick={() => s.setTimeScale(x)} className={`flex-1 rounded-sm border py-1 font-mono text-xs ${s.timeScale === x ? "border-cyan text-cyan" : "border-border text-muted-foreground"}`}>{x}×</button>)}</div>
            </div>
            <Slider label="Sensor noise" value={Math.round(s.noise * 100)} min={0} max={100} unit="%" onChange={(v) => s.setNoise(v / 100)} />
            <p className="text-[11px] text-muted-foreground">Noise lowers SNR (up to −8 dB), increases position measurement error and reduces classifier confidence.</p>
          </div>
        </Panel>
        <Panel title="Add simulated target" icon={<Plus className="h-3.5 w-3.5" />}>
          <div className="mb-3 grid grid-cols-2 gap-1">
            {(["drone", "bird", "other", "unknown"] as TargetClass[]).map((c) => <button key={c} onClick={() => setCls(c)} className={`rounded-sm border py-1.5 text-xs ${cls === c ? "border-radar bg-radar/10 text-radar" : "border-border text-muted-foreground"}`}>{CLASS_LABEL[c]}</button>)}
          </div>
          <div className="space-y-3">
            <Slider label="Initial distance" value={distance} min={300} max={8000} step={100} unit=" m" onChange={setDistance} />
            <Slider label="Bearing from radar" value={bearing} min={0} max={359} unit="°" onChange={setBearing} />
            <Slider label="Altitude" value={altitude} min={10} max={2000} step={10} unit=" m" onChange={setAltitude} />
            <Slider label="Speed" value={speed} min={0} max={80} unit=" m/s" onChange={setSpeed} />
            <Slider label="Direction (heading)" value={heading} min={0} max={359} unit="°" onChange={setHeading} />
            <select value={behavior} onChange={(e) => setBehavior(e.target.value as Behavior)} className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm">
              {["wander", "approach", "depart", "loiter", "hover"].map((b) => <option key={b} value={b}>Behaviour: {b}</option>)}
            </select>
            <Btn onClick={() => s.addTarget(cls, { distance, altitude, speed, headingDeg: heading, bearingDeg: bearing, behavior })}><Plus className="h-4 w-4" />Inject target</Btn>
          </div>
        </Panel>
        <Panel title="Sensor failure simulation" icon={<Zap className="h-3.5 w-3.5" />}>
          <div className="space-y-2">
            {(Object.keys(SENSOR_NAME) as SensorKey[]).map((k) => (
              <label key={k} className="flex cursor-pointer items-center justify-between rounded-sm border border-border px-3 py-2 text-sm">
                <span>{SENSOR_NAME[k]}<span className="block text-[10px] text-muted-foreground">{k === "receiver" ? "Degrade: +10 dB noise figure" : "Take offline"}</span></span>
                <span className={`font-mono text-xs ${s.failures[k] ? "text-danger" : "text-radar"}`}>{s.failures[k] ? "FAILED" : "NOMINAL"}</span>
                <input type="checkbox" className="sr-only" checked={s.failures[k]} onChange={() => s.toggleFailure(k)} />
                <span className={`relative h-5 w-9 rounded-full transition-colors ${s.failures[k] ? "bg-danger" : "bg-muted"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${s.failures[k] ? "left-4.5" : "left-0.5"}`} /></span>
              </label>
            ))}
          </div>
        </Panel>
        <Panel className="lg:col-span-3" title="Active synthetic objects">
          <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
            <thead className="text-left text-[10px] uppercase text-muted-foreground"><tr>{["ID", "Sim type", "Predicted", "True range", "Alt", "Speed", "Behaviour", ""].map((h) => <th key={h} className="px-2 py-1.5">{h}</th>)}</tr></thead>
            <tbody>{s.targets.map((t) => (
              <tr key={t.id} className="border-t border-border/40">
                <td className="px-2 py-1 text-radar">{t.id}</td><td className="px-2"><ClassBadge c={t.truth} /></td><td className="px-2"><ClassBadge c={t.cls?.predicted} /></td>
                <td className="px-2">{km(range3(t.pos))} km</td><td className="px-2">{t.pos.z.toFixed(0)} m</td><td className="px-2">{t.speed.toFixed(1)} m/s</td><td className="px-2">{t.behavior}</td>
                <td className="px-2 text-right"><button onClick={() => s.removeTarget(t.id)} className="text-muted-foreground hover:text-danger" aria-label={`Remove ${t.id}`}><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>))}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
