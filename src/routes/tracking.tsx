import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Activity, Box, MapPin } from "lucide-react";
import { RadarScope } from "@/components/RadarScope";
import { ClassBadge, PageHeader, Panel, Stat, TargetPicker, km, useSelected } from "@/components/hud";
import { useSim } from "@/sim/store";
import { compass, headingDeg, predictPath, range3 } from "@/sim/model";
import { cn } from "@/lib/utils";

const Airspace3D = lazy(() => import("@/components/Airspace3D"));

export const Route = createFileRoute("/tracking")({
  head: () => ({
    meta: [
      { title: "Drone Tracking — SkyWatch-MD" },
      { name: "description", content: "2D and interactive 3D tracking of simulated targets with trajectory history, prediction and uncertainty." },
      { property: "og:title", content: "Drone Tracking — SkyWatch-MD" },
      { property: "og:description", content: "Interactive 3D airspace visualisation of simulated tracks." },
    ],
  }),
  component: Tracking,
});

function Tracking() {
  const targets = useSim((s) => s.targets);
  const select = useSim((s) => s.select);
  const t = useSelected();
  const tr = t?.track;
  const pred = tr ? predictPath(tr, 30, 30)[0] : null;
  const hdg = tr ? headingDeg(Math.atan2(tr.vel.x, tr.vel.y)) : 0;
  return (
    <>
      <PageHeader code="MODULE 05 / TRK" title="Drone Tracking" desc="Alpha-beta filtered tracks. Solid lines: estimated past trajectory. Dashed: constant-velocity prediction (60 s). Shaded discs/spheres: 1σ–2σ position uncertainty, growing with range, noise and coasting." />
      <div className="mb-4"><TargetPicker /></div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,460px)_1fr]">
        <Panel title="2D track picture" icon={<Activity className="h-3.5 w-3.5" />}><RadarScope showTracks /></Panel>
        <Panel title="3D airspace (drag to orbit, scroll to zoom, click a target)" icon={<Box className="h-3.5 w-3.5" />} right={<span className="font-mono text-[10px] text-muted-foreground">altitude ×3 · 1 grid = 500 m</span>}>
          <ClientOnly fallback={<div className="h-[480px] animate-pulse rounded-sm bg-muted" />}>
            <Suspense fallback={<div className="h-[480px] animate-pulse rounded-sm bg-muted" />}><Airspace3D /></Suspense>
          </ClientOnly>
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Panel title={`Track state — ${t?.id ?? ""}`} icon={<MapPin className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="X (east)" value={tr ? tr.pos.x.toFixed(0) : "—"} unit="m" />
            <Stat label="Y (north)" value={tr ? tr.pos.y.toFixed(0) : "—"} unit="m" />
            <Stat label="Altitude" value={tr ? tr.pos.z.toFixed(0) : "—"} unit="m" />
            <Stat label="Distance" value={tr ? km(range3(tr.pos)) : "—"} unit="km" tone="radar" />
            <Stat label="Speed" value={tr ? Math.hypot(tr.vel.x, tr.vel.y, tr.vel.z).toFixed(1) : "—"} unit="m/s" />
            <Stat label="Direction" value={tr ? `${hdg.toFixed(0)}° ${compass(hdg)}` : "—"} />
            <Stat label="Uncertainty 1σ" value={tr ? `±${tr.sigma.toFixed(0)}` : "—"} unit="m" tone="amber" />
            <Stat label="Predicted (+30 s)" value={pred ? `${km(range3(pred))} km` : "—"} sub={pred ? `±${pred.sigma.toFixed(0)} m` : undefined} tone="cyan" />
          </div>
        </Panel>
        <Panel title="All tracks" icon={<Activity className="h-3.5 w-3.5" />}>
          <div className="overflow-x-auto"><table className="w-full font-mono text-xs">
            <thead className="text-left text-[10px] uppercase text-muted-foreground"><tr>{["ID", "Class", "X m", "Y m", "Z m", "Vx", "Vy", "Vz", "σ m", "Points"].map((h) => <th key={h} className="px-2 py-1.5">{h}</th>)}</tr></thead>
            <tbody>{targets.map((x) => (
              <tr key={x.id} onClick={() => select(x.id)} className={cn("cursor-pointer border-t border-border/40 hover:bg-accent/40", t?.id === x.id && "bg-radar/10")}>
                <td className="px-2 py-1 text-radar">{x.id}</td><td className="px-2"><ClassBadge c={x.cls?.predicted} /></td>
                {x.track ? <>
                  <td className="px-2">{x.track.pos.x.toFixed(0)}</td><td className="px-2">{x.track.pos.y.toFixed(0)}</td><td className="px-2">{x.track.pos.z.toFixed(0)}</td>
                  <td className="px-2">{x.track.vel.x.toFixed(1)}</td><td className="px-2">{x.track.vel.y.toFixed(1)}</td><td className="px-2">{x.track.vel.z.toFixed(1)}</td>
                  <td className="px-2 text-amber">{x.track.sigma.toFixed(0)}</td><td className="px-2">{x.track.history.length}</td>
                </> : <td colSpan={8} className="px-2 text-muted-foreground">no track (below detection threshold)</td>}
              </tr>))}</tbody>
          </table></div>
        </Panel>
      </div>
    </>
  );
}
