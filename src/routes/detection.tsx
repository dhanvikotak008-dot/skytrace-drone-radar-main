import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crosshair, LineChart as LC, Signal } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RadarScope } from "@/components/RadarScope";
import { PageHeader, Panel, Stat, TargetPicker, km, useSelected, cssVar } from "@/components/hud";
import { useSim } from "@/sim/store";
import { RCS, compass, dopplerHz, headingDeg, maxRange, radialVel, range3, type Target } from "@/sim/model";

export const Route = createFileRoute("/detection")({
  head: () => ({
    meta: [
      { title: "Drone Detection — SkyWatch-MD" },
      { name: "description", content: "Simulated drone detection status, range, velocity, signal strength and confidence." },
      { property: "og:title", content: "Drone Detection — SkyWatch-MD" },
      { property: "og:description", content: "Simulated drone detection telemetry." },
    ],
  }),
  component: Detection,
});

const isDroneish = (t: Target) => t.truth === "drone" || t.cls?.predicted === "drone";

function Detection() {
  const targets = useSim((s) => s.targets);
  const simTime = useSim((s) => s.simTime);
  const failures = useSim((s) => s.failures);
  const noise = useSim((s) => s.noise);
  const sel0 = useSelected();
  const drones = targets.filter(isDroneish);
  const sel = sel0 && isDroneish(sel0) ? sel0 : drones[0];
  const [series, setSeries] = useState<Record<string, number | string>[]>([]);

  useEffect(() => {
    const row: Record<string, number | string> = { t: simTime.toFixed(0) };
    drones.forEach((d) => { if (d.track) row[d.id] = +(range3(d.track.pos) / 1000).toFixed(2); });
    setSeries((s) => (s.length && s[s.length - 1]["t"] === row["t"] ? s : [...s, row].slice(-90)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(simTime)]);

  const rmax = maxRange(RCS.drone, (failures.receiver ? 10 : 0) + noise * 8);
  const tr = sel?.track;
  const vr = tr ? radialVel(tr.pos, tr.vel) : 0;
  const hv = tr ? Math.hypot(tr.vel.x, tr.vel.y) : 0;
  const motion = !tr ? "—" : hv < 1.5 ? "HOVERING" : vr > 1 ? "APPROACHING" : vr < -1 ? "MOVING AWAY" : "CROSSING";
  const hdg = tr ? headingDeg(Math.atan2(tr.vel.x, tr.vel.y)) : 0;
  const palette = ["warn", "radar", "cyan", "amber", "sky", "danger"].map(cssVar);
  const snrPct = sel ? Math.max(0, Math.min(100, ((sel.snrDb + 5) / 45) * 100)) : 0;

  return (
    <>
      <PageHeader code="MODULE 02 / DET" title="Drone Detection" desc="Focus view on drone-like targets. Detection occurs when the simulated SNR exceeds the 13 dB threshold of the range equation model." />
      <div className="mb-4"><TargetPicker filter={isDroneish} /></div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Panel title="Drone-filtered scope" icon={<Crosshair className="h-3.5 w-3.5" />}><RadarScope filterDrones showTracks /></Panel>
        <div className="space-y-4">
          <Panel title={`Telemetry — ${sel?.id ?? "none"}`} icon={<Signal className="h-3.5 w-3.5" />} right={<span className={`rounded-sm border px-2 py-0.5 font-mono text-xs font-bold ${sel?.detected ? "border-danger text-danger animate-pulse" : "border-muted-foreground text-muted-foreground"}`}>{sel?.detected ? "DRONE DETECTED" : "NO DETECTION"}</span>}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Model detection range" value={km(rmax)} unit="km" tone="cyan" sub="σ=0.01 m², assumed params" />
              <Stat label="Target distance" value={tr ? km(range3(tr.pos)) : "—"} unit="km" tone="radar" />
              <Stat label="Est. altitude" value={tr ? tr.pos.z.toFixed(0) : "—"} unit="m" />
              <Stat label="Motion" value={motion} tone={motion === "APPROACHING" ? "danger" : "radar"} />
              <Stat label="Horizontal velocity" value={hv.toFixed(1)} unit="m/s" />
              <Stat label="Vertical velocity" value={tr ? tr.vel.z.toFixed(2) : "—"} unit="m/s" />
              <Stat label="Direction" value={tr ? `${hdg.toFixed(0)}° ${compass(hdg)}` : "—"} />
              <Stat label="Doppler shift" value={tr ? dopplerHz(vr).toFixed(0) : "—"} unit="Hz" sub={`v_r = ${vr.toFixed(1)} m/s`} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Meter label="Signal strength (SNR)" value={snrPct} text={sel?.detected ? `${sel.snrDb.toFixed(1)} dB` : "below threshold"} tone="radar" />
              <Meter label="Detection confidence (simulated)" value={(sel?.cls?.probs.drone ?? 0) * 100} text={`${((sel?.cls?.probs.drone ?? 0) * 100).toFixed(0)} % drone-like`} tone="warn" />
            </div>
          </Panel>
          <Panel title="Range history (drone-like targets)" icon={<LC className="h-3.5 w-3.5" />}>
            <div className="h-60">
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.08} />
                  <XAxis dataKey="t" stroke="currentColor" fontSize={10} unit="s" />
                  <YAxis stroke="currentColor" fontSize={10} unit=" km" />
                  <Tooltip contentStyle={{ background: cssVar("popover"), border: `1px solid ${cssVar("border")}`, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {drones.map((d, i) => <Line key={d.id} dataKey={d.id} dot={false} stroke={palette[i % palette.length]} strokeWidth={d.id === sel?.id ? 2.5 : 1.2} isAnimationActive={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground">Falling lines = approaching, rising = moving away. Targets change behaviour (approach / depart / loiter / hover) at random intervals.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Meter({ label, value, text, tone }: { label: string; value: number; text: string; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground"><span>{label}</span><span className="font-mono">{text}</span></div>
      <div className="flex h-3 gap-0.5">
        {Array.from({ length: 30 }, (_, i) => <div key={i} className={`flex-1 rounded-[1px] ${i < (value / 100) * 30 ? `bg-${tone}` : "bg-muted"}`} />)}
      </div>
    </div>
  );
}
