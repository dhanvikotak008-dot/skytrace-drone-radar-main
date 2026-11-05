import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ListOrdered, ScrollText, ShieldAlert } from "lucide-react";
import { RadarScope } from "@/components/RadarScope";
import { ClassBadge, PageHeader, Panel, PriorityBadge, Stat, fmtTime, km } from "@/components/hud";
import { useSim } from "@/sim/store";
import { ZONE_BUFFER_M, ZONE_RESTRICTED_M, priorityOf, range2, type Priority } from "@/sim/model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Risk & Alert Monitoring — SkyWatch-MD" },
      { name: "description", content: "Defensive monitoring of protected airspace with restricted-zone alerts, priorities and event log." },
      { property: "og:title", content: "Risk & Alert Monitoring — SkyWatch-MD" },
      { property: "og:description", content: "Simulated protected-airspace alerting with LOW/MEDIUM/HIGH priority." },
    ],
  }),
  component: Alerts,
});

const RANK: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function Alerts() {
  const targets = useSim((s) => s.targets);
  const events = useSim((s) => s.events);
  const select = useSim((s) => s.select);
  const [filter, setFilter] = useState<"ALL" | Priority | "INFO">("ALL");
  const tracked = targets.filter((t) => t.track).map((t) => ({ t, p: priorityOf(t), r: range2(t.track!.pos) })).sort((a, b) => RANK[a.p] - RANK[b.p] || a.r - b.r);
  const count = (p: Priority) => tracked.filter((x) => x.p === p).length;
  const shown = filter === "ALL" ? events : events.filter((e) => e.level === filter);
  return (
    <>
      <PageHeader code="MODULE 07 / RSK" title="Risk & Alert Monitoring" desc={`Passive, defensive monitoring only. Protected airspace: restricted zone < ${ZONE_RESTRICTED_M / 1000} km, buffer zone < ${ZONE_BUFFER_M / 1000} km. This system observes and alerts — no interception, jamming or countermeasures.`} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="HIGH priority" value={count("HIGH")} tone="danger" />
        <Stat label="MEDIUM priority" value={count("MEDIUM")} tone="warn" />
        <Stat label="LOW priority" value={count("LOW")} tone="radar" />
        <Stat label="In restricted zone" value={tracked.filter((x) => x.r < ZONE_RESTRICTED_M).length} tone="danger" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_1fr]">
        <Panel title="Protected airspace" icon={<ShieldAlert className="h-3.5 w-3.5" />}><RadarScope /></Panel>
        <Panel title="Monitoring priority queue" icon={<ListOrdered className="h-3.5 w-3.5" />}>
          <div className="space-y-2">
            {tracked.map(({ t, p, r }) => (
              <button key={t.id} onClick={() => select(t.id)} className={cn("flex w-full flex-wrap items-center gap-3 rounded-sm border px-3 py-2 text-left font-mono text-xs hover:bg-accent/40", p === "HIGH" ? "border-danger/70 bg-danger/5" : p === "MEDIUM" ? "border-warn/50" : "border-border")}>
                <PriorityBadge p={p} />
                <span className="w-16 text-radar">{t.id}</span>
                <ClassBadge c={t.cls?.predicted} />
                <span>{km(r)} km</span>
                <span className="text-muted-foreground">{r < ZONE_RESTRICTED_M ? "RESTRICTED ZONE" : r < ZONE_BUFFER_M ? "buffer zone" : "outside"}</span>
                <span className="text-muted-foreground">conf {t.cls ? (t.cls.confidence * 100).toFixed(0) : "--"}%</span>
                {t.unusual && <span className="ml-auto rounded-sm bg-warn/15 px-1.5 text-warn">⚠ {t.unusual}</span>}
              </button>
            ))}
            {!tracked.length && <p className="text-sm text-muted-foreground">No active tracks.</p>}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Rule: HIGH = drone-like/unknown inside restricted zone · MEDIUM = drone-like in buffer, any object in restricted zone, or drone with unusual movement · LOW = everything else.</p>
        </Panel>
      </div>
      <Panel className="mt-4" title="Event log" icon={<ScrollText className="h-3.5 w-3.5" />} right={
        <div className="flex gap-1">{(["ALL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] ${filter === f ? "border-cyan text-cyan" : "border-border text-muted-foreground"}`}>{f}</button>)}</div>
      }>
        <div className="max-h-96 overflow-auto font-mono text-xs">
          {shown.map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-t border-border/40 py-1.5">
              <span className="text-muted-foreground">{fmtTime(e.at)}</span><PriorityBadge p={e.level} />
              {e.targetId && <span className="text-radar">{e.targetId}</span>}<span>{e.msg}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
