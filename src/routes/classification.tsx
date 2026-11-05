import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BrainCircuit, History, ListChecks } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Spectrogram } from "@/components/Spectrogram";
import { CLASS_TOKEN, ClassBadge, PageHeader, Panel, Stat, TargetPicker, cssVar, fmtTime, useSelected } from "@/components/hud";
import { useSim } from "@/sim/store";
import { CLASS_LABEL, radialVel, velocity, type TargetClass } from "@/sim/model";
import { useSignature } from "./micro-doppler";

export const Route = createFileRoute("/classification")({
  head: () => ({
    meta: [
      { title: "Object Classification — SkyWatch-MD" },
      { name: "description", content: "Simulated AI classification of radar targets into drone-like, bird-like, other and unknown classes." },
      { property: "og:title", content: "Object Classification — SkyWatch-MD" },
      { property: "og:description", content: "Simulated micro-Doppler feature classifier with history." },
    ],
  }),
  component: Classification,
});

const CLASSES: TargetClass[] = ["drone", "bird", "other", "unknown"];

function Classification() {
  const t = useSelected();
  const history = useSim((s) => s.history);
  const simTime = useSim((s) => s.simTime);
  const noise = useSim((s) => s.noise);
  const c = t?.cls;
  const sig = useSignature(t?.truth ?? "drone", t ? radialVel(t.pos, velocity(t)) : 0, t?.rotorHz ?? 90, t?.flapHz ?? 5, t?.snrDb ?? 5, noise, simTime, 128);
  const refPred = useSignature(c?.predicted ?? "unknown", 4, 95, 5, 25, 0.1, simTime, 128);
  const probs = CLASSES.map((k) => ({ name: CLASS_LABEL[k], p: +((c?.probs[k] ?? 0) * 100).toFixed(1), k }));
  const recent = history.slice(0, 60);
  const agree = recent.length ? recent.filter((h) => h.predicted === h.truth).length / recent.length : 0;

  return (
    <>
      <PageHeader code="MODULE 04 / CLS" title="Object Classification" desc="Features are extracted from each target's simulated spectrogram (occupied Doppler bandwidth, modulation periodicity) plus kinematics, then scored by a heuristic softmax model." />
      <div className="mb-4 flex items-start gap-3 rounded-sm border border-amber/50 bg-amber/10 p-3 text-sm text-amber">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>This is a <b>simulated, rule-based classification model</b> running on synthetic data for demonstration. It is not a trained or validated real-world detector and its outputs make no claim about real detection accuracy.</p>
      </div>
      <div className="mb-4"><TargetPicker /></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={`Prediction — ${t?.id ?? ""}`} icon={<BrainCircuit className="h-3.5 w-3.5" />}>
          <div className="mb-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Predicted class</div>
            <div className="text-2xl"><ClassBadge c={c?.predicted} /></div>
            <div className="font-mono text-4xl font-bold text-radar text-glow">{c ? (c.confidence * 100).toFixed(0) : "--"}<span className="text-lg">%</span></div>
            <div className="text-[10px] text-muted-foreground">model confidence · updated {fmtTime(c?.at ?? null)}</div>
          </div>
          <div className="h-44"><ResponsiveContainer><BarChart data={probs} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" domain={[0, 100]} fontSize={10} stroke="currentColor" unit="%" /><YAxis type="category" dataKey="name" fontSize={10} stroke="currentColor" width={90} />
            <Tooltip contentStyle={{ background: cssVar("popover"), border: `1px solid ${cssVar("border")}`, fontSize: 11 }} />
            <Bar dataKey="p" isAnimationActive={false}>{probs.map((p) => <Cell key={p.k} fill={cssVar(CLASS_TOKEN[p.k])} />)}</Bar>
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Signal characteristics (extracted)" icon={<ListChecks className="h-3.5 w-3.5" />}>
          {c ? (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Doppler bandwidth" value={c.features.bandwidthHz.toFixed(0)} unit="Hz" tone="warn" sub="occupied above −25% level" />
              <Stat label="Modulation rate" value={c.features.modRateHz.toFixed(1)} unit="Hz" tone="cyan" sub="autocorr. of spread" />
              <Stat label="Body Doppler" value={c.features.bodyDopplerHz.toFixed(0)} unit="Hz" />
              <Stat label="Speed" value={c.features.speed.toFixed(1)} unit="m/s" />
              <Stat label="SNR" value={c.features.snrDb.toFixed(1)} unit="dB" tone="radar" />
              <Stat label="Altitude" value={c.features.altitude.toFixed(0)} unit="m" />
            </div>
          ) : <p className="text-sm text-muted-foreground">Target not yet detected — no features.</p>}
        </Panel>
        <Panel title="Signature comparison" icon={<BrainCircuit className="h-3.5 w-3.5" />}>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">OBSERVED (simulated) — {t?.id}</div>
          <Spectrogram frames={sig.spec.frames} frameDt={sig.spec.frameDt} height={120} />
          <div className="mb-1 mt-3 font-mono text-[10px] text-muted-foreground">REFERENCE TEMPLATE — {c ? CLASS_LABEL[c.predicted] : "—"}</div>
          <Spectrogram frames={refPred.spec.frames} frameDt={refPred.spec.frameDt} height={120} />
        </Panel>
        <Panel className="lg:col-span-3" title="Classification history" icon={<History className="h-3.5 w-3.5" />} right={<span className="font-mono text-[10px] text-muted-foreground">agreement with simulation ground truth (last {recent.length}): {(agree * 100).toFixed(0)}% — synthetic only</span>}>
          <div className="max-h-80 overflow-auto">
            <table className="w-full font-mono text-xs">
              <thead className="sticky top-0 bg-card text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>{["Time", "Target", "Predicted", "Conf.", "Bandwidth Hz", "Mod Hz", "Sim. truth"].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {recent.map((h, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="px-2 py-1 text-muted-foreground">{fmtTime(h.at)}</td><td className="px-2 text-radar">{h.targetId}</td>
                    <td className="px-2"><ClassBadge c={h.predicted} /></td><td className="px-2">{(h.confidence * 100).toFixed(0)}%</td>
                    <td className="px-2">{h.features.bandwidthHz.toFixed(0)}</td><td className="px-2">{h.features.modRateHz.toFixed(1)}</td>
                    <td className="px-2"><ClassBadge c={h.truth} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
