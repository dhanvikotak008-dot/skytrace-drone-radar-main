import { createFileRoute } from "@tanstack/react-router";
import { Radar, Table2 } from "lucide-react";
import { RadarScope } from "@/components/RadarScope";
import { ClassBadge, PageHeader, Panel, Stat, fmtTime, km } from "@/components/hud";
import { useSim } from "@/sim/store";
import { bearingDeg, compass, headingDeg, range3 } from "@/sim/model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radar Dashboard — SkyWatch-MD Drone Detection Simulator" },
      { name: "description", content: "Live simulated radar scope with moving aerial targets, range, altitude, speed and classification." },
      { property: "og:title", content: "Radar Dashboard — SkyWatch-MD" },
      { property: "og:description", content: "Live simulated radar scope for drone detection research." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const targets = useSim((s) => s.targets);
  const selectedId = useSim((s) => s.selectedId);
  const select = useSim((s) => s.select);
  const detected = targets.filter((t) => t.detected);
  return (
    <>
      <PageHeader code="MODULE 01 / PPI" title="Main Radar Dashboard" desc="Plan-position indicator of a simulated surveillance radar. Click a blip to select it — the selection is shared by every module." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,560px)_1fr]">
        <Panel title="Live radar scan" icon={<Radar className="h-3.5 w-3.5" />}>
          <RadarScope />
          <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
            <span><span className="text-warn">●</span> drone-like</span><span><span className="text-cyan">●</span> bird-like</span>
            <span><span className="text-sky">●</span> other</span><span><span className="text-amber">●</span> unknown</span>
            <span className="text-danger">◯ restricted 1.5 km</span><span className="text-warn">◌ buffer 3 km</span>
          </div>
        </Panel>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Active tracks" value={detected.length} tone="radar" sub={`${targets.length} synthetic objects`} labelClassName="text-xs font-semibold text-foreground" />
            <Stat label="Drone-like" value={detected.filter((t) => t.cls?.predicted === "drone").length} tone="warn" labelClassName="text-xs font-semibold text-foreground" />
            <Stat label="Bird-like" value={detected.filter((t) => t.cls?.predicted === "bird").length} tone="cyan" labelClassName="text-xs font-semibold text-foreground" />
            <Stat label="Closest" value={detected.length ? km(Math.min(...detected.map((t) => range3(t.track?.pos ?? t.pos)))) : "—"} unit="km" tone="amber" labelClassName="text-xs font-semibold text-foreground" />
          </div>
          <Panel title="Target table" icon={<Table2 className="h-3.5 w-3.5" />} titleClassName="text-sm text-foreground">
            <div className="overflow-x-auto">
              <table className="w-full bg-background font-mono text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>{["ID", "Class", "Range km", "Bearing", "Alt m", "Speed m/s", "Heading", "SNR dB", "First detected"].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {targets.map((t) => {
                    const p = t.track?.pos;
                    const v = t.track?.vel;
                    return (
                      <tr key={t.id} onClick={() => select(t.id)} className={cn("cursor-pointer border-t border-border/50 hover:bg-accent/40", selectedId === t.id && "bg-radar/10", !t.detected && "opacity-45")}>
                        <td className="px-2 py-1.5 text-radar">{t.id}</td>
                        <td className="px-2"><ClassBadge c={t.cls?.predicted} /></td>
                        <td className="px-2">{p ? km(range3(p)) : "—"}</td>
                        <td className="px-2">{p ? `${bearingDeg(p).toFixed(0)}°` : "—"}</td>
                        <td className="px-2">{p ? p.z.toFixed(0) : "—"}</td>
                        <td className="px-2">{v ? Math.hypot(v.x, v.y).toFixed(1) : "—"}</td>
                        <td className="px-2">{v ? `${headingDeg(Math.atan2(v.x, v.y)).toFixed(0)}° ${compass(headingDeg(Math.atan2(v.x, v.y)))}` : "—"}</td>
                        <td className="px-2">{t.detected ? t.snrDb.toFixed(1) : "—"}</td>
                        <td className="px-2 text-muted-foreground">{fmtTime(t.firstSeen)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Values are tracker estimates (alpha-beta filter on noisy simulated measurements), not ground truth. Faded rows are below detection threshold.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
