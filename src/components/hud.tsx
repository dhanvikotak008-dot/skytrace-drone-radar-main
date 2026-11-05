import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASS_LABEL, type Priority, type TargetClass, type Target } from "@/sim/model";
import { useSim } from "@/sim/store";

export const CLASS_TOKEN: Record<TargetClass, string> = { drone: "warn", bird: "cyan", other: "sky", unknown: "amber" };
export const CLASS_TEXT: Record<TargetClass, string> = { drone: "text-warn", bird: "text-cyan", other: "text-sky", unknown: "text-amber" };

export function cssVar(name: string) {
  if (typeof window === "undefined") return "#0f0";
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || "#0f0";
}

export function Panel({ title, icon, children, className, right, titleClassName }: { title?: string; icon?: ReactNode; children: ReactNode; className?: string; right?: ReactNode; titleClassName?: string }) {
  return (
    <section className={cn("hud-panel p-4", className)}>
      <span className="pointer-events-none absolute left-0 top-0 h-2 w-2 border-l-2 border-t-2 border-cyan" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-cyan" />
      {title && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary", titleClassName)}>
            {icon}
            {title}
          </h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, tone = "foreground", sub, labelClassName }: { label: string; value: ReactNode; unit?: string; tone?: string; sub?: ReactNode; labelClassName?: string }) {
  return (
    <div className="rounded-sm border border-border/70 bg-background/40 px-3 py-2">
      <div className={cn("text-[10px] uppercase tracking-[0.16em] text-muted-foreground", labelClassName)}>{label}</div>
      <div className={cn("font-mono text-lg font-semibold", `text-${tone}`)}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function SimTag({ text = "SIMULATED DATA" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-amber/50 bg-amber/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber">
      <FlaskConical className="h-3 w-3" /> {text}
    </span>
  );
}

export function PageHeader({ code, title, desc, children }: { code: string; title: string; desc: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="font-mono text-[11px] tracking-[0.3em] text-radar">{code}</div>
        <h1 className="text-2xl font-bold uppercase tracking-wide text-primary md:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{desc}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SimTag />
        {children}
      </div>
    </div>
  );
}

export function PriorityBadge({ p }: { p: Priority | "INFO" }) {
  const c = p === "HIGH" ? "border-danger text-danger bg-danger/10" : p === "MEDIUM" ? "border-warn text-warn bg-warn/10" : p === "LOW" ? "border-radar text-radar bg-radar/10" : "border-cyan/60 text-cyan bg-cyan/5";
  return <span className={cn("inline-block min-w-14 rounded-sm border px-1.5 py-0.5 text-center font-mono text-[10px] font-bold", c)}>{p}</span>;
}

export function ClassBadge({ c }: { c: TargetClass | undefined | null }) {
  if (!c) return <span className="font-mono text-xs text-muted-foreground">PENDING</span>;
  return <span className={cn("font-mono text-xs font-semibold uppercase", CLASS_TEXT[c])}>{CLASS_LABEL[c]}</span>;
}

export function useSelected(): Target | null {
  const targets = useSim((s) => s.targets);
  const id = useSim((s) => s.selectedId);
  return targets.find((t) => t.id === id) ?? targets[0] ?? null;
}

export function TargetPicker({ filter }: { filter?: (t: Target) => boolean }) {
  const targets = useSim((s) => s.targets);
  const sel = useSelected();
  const select = useSim((s) => s.select);
  const list = filter ? targets.filter(filter) : targets;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((t) => (
        <button
          key={t.id}
          onClick={() => select(t.id)}
          className={cn(
            "rounded-sm border px-2 py-1 font-mono text-xs transition-colors",
            sel?.id === t.id ? "border-radar bg-radar/15 text-radar glow-radar" : "border-border text-muted-foreground hover:border-cyan hover:text-cyan",
          )}
        >
          {t.id}
          <span className={cn("ml-1", t.detected ? "text-radar" : "text-muted-foreground/60")}>●</span>
        </button>
      ))}
      {list.length === 0 && <span className="text-xs text-muted-foreground">No targets</span>}
    </div>
  );
}

export const fmtTime = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString([], { hour12: false }) : "—");
export const km = (m: number) => (m / 1000).toFixed(2);
