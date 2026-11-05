import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, AudioWaveform, BrainCircuit, Crosshair, Cpu, Gauge, Pause, Play, Radar, RotateCcw, ShieldAlert, SlidersHorizontal } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { useSim } from "@/sim/store";
import { SimDriver } from "./SimDriver";

const NAV = [
  { to: "/", label: "Radar Dashboard", icon: Radar },
  { to: "/detection", label: "Drone Detection", icon: Crosshair },
  { to: "/micro-doppler", label: "Micro-Doppler", icon: AudioWaveform },
  { to: "/classification", label: "Classification", icon: BrainCircuit },
  { to: "/tracking", label: "Tracking", icon: Activity },
  { to: "/sensors", label: "Sensors", icon: Cpu },
  { to: "/alerts", label: "Risk & Alerts", icon: ShieldAlert },
  { to: "/control", label: "Control Center", icon: SlidersHorizontal },
] as const;

function Nav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-radar/60 text-radar glow-radar"><Gauge className="h-4 w-4" /></div>
          {state === "expanded" && (
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-widest text-radar">SKYWATCH-MD</div>
              <div className="font-mono text-[9px] text-muted-foreground">RADAR · µDOPPLER · RESEARCH SIM</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((n, i) => (
                <SidebarMenuItem key={n.to}>
                  <SidebarMenuButton asChild isActive={path === n.to} tooltip={n.label}>
                    <Link to={n.to}>
                      <n.icon className="h-4 w-4" />
                      <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span>{n.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {state === "expanded" && <p className="px-2 pb-2 font-mono text-[9px] leading-relaxed text-muted-foreground">Engineering demonstration. All targets, signals and sensor readings are synthetic. No physical hardware connected.</p>}
      </SidebarFooter>
    </Sidebar>
  );
}

function StatusBar() {
  const running = useSim((s) => s.running);
  const simTime = useSim((s) => s.simTime);
  const n = useSim((s) => s.targets.filter((t) => t.detected).length);
  const total = useSim((s) => s.targets.length);
  const { start, pause, reset } = useSim.getState();
  const t = Math.floor(simTime);
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur">
      <SidebarTrigger />
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-radar" : "bg-warn"}`} />
        <span className={running ? "text-radar" : "text-warn"}>{running ? "SIM RUNNING" : "SIM PAUSED"}</span>
        <span className="hidden text-muted-foreground sm:inline">T+{String(Math.floor(t / 60)).padStart(2, "0")}:{String(t % 60).padStart(2, "0")}</span>
        <span className="hidden text-muted-foreground sm:inline">TRACKS {n}/{total}</span>
      </div>
      <div className="ml-auto flex gap-1.5">
        <button onClick={running ? pause : start} className="flex items-center gap-1 rounded-sm border border-radar/60 px-2.5 py-1 text-xs text-radar hover:bg-radar/10">
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{running ? "Stop" : "Start"}
        </button>
        <button onClick={reset} className="flex items-center gap-1 rounded-sm border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-cyan hover:text-cyan">
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </button>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <SimDriver />
      <div className="flex min-h-screen w-full">
        <Nav />
        <div className="flex min-w-0 flex-1 flex-col">
          <StatusBar />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
