import { useEffect, useRef } from "react";
import { useSim } from "@/sim/store";
import { DISPLAY_RANGE_M, ZONE_BUFFER_M, ZONE_RESTRICTED_M, predictPath } from "@/sim/model";
import { CLASS_TOKEN, cssVar } from "./hud";

/** Canvas PPI radar scope. Reads store state each animation frame (no React re-render). */
export function RadarScope({ showTracks = false, showZones = true, filterDrones = false, className }: { showTracks?: boolean; showZones?: boolean; filterDrones?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const select = useSim((s) => s.select);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    let sweep = 0;
    let last = performance.now();
    const blips = new Map<string, number>(); // last painted time
    const colors = { radar: cssVar("scope-radar"), cyan: cssVar("scope-cyan"), warn: cssVar("scope-warn"), danger: cssVar("scope-danger"), amber: cssVar("scope-amber"), sky: cssVar("scope-sky"), muted: cssVar("scope-muted"), bg: cssVar("scope-bg") };

    const draw = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const size = cv.clientWidth;
      if (cv.width !== size * dpr) { cv.width = size * dpr; cv.height = size * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = useSim.getState();
      const dt = (now - last) / 1000; last = now;
      if (s.running && !s.failures.radar) sweep = (sweep + dt * Math.PI * 0.9) % (Math.PI * 2);
      const c = size / 2, R = size / 2 - 14, k = R / DISPLAY_RANGE_M;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = colors.bg; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();

      // zones
      if (showZones) {
        ctx.globalAlpha = 0.1; ctx.fillStyle = colors.danger; ctx.beginPath(); ctx.arc(c, c, ZONE_RESTRICTED_M * k, 0, Math.PI * 2); ctx.fill();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = colors.warn; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(c, c, ZONE_BUFFER_M * k, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = colors.danger; ctx.beginPath(); ctx.arc(c, c, ZONE_RESTRICTED_M * k, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      // rings + spokes
      ctx.strokeStyle = colors.radar; ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(c, c, (R * i) / 4, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.6; ctx.fillStyle = colors.radar; ctx.font = "10px JetBrains Mono, monospace";
        ctx.fillText(`${(DISPLAY_RANGE_M * i) / 4000} km`, c + 4, c - (R * i) / 4 + 12);
      }
      for (let a = 0; a < 360; a += 30) {
        const r = (a * Math.PI) / 180;
        ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + R * Math.sin(r), c - R * Math.cos(r)); ctx.stroke();
        ctx.globalAlpha = 0.55; ctx.fillText(`${a}°`, c + (R + 2) * Math.sin(r) - 9, c - (R + 2) * Math.cos(r) + 4);
      }
      ctx.globalAlpha = 1;
      // sweep wedge
      if (!s.failures.radar) {
        for (let i = 0; i < 40; i++) {
          const a0 = sweep - (i * 0.6 * Math.PI) / 180 * 1.5;
          ctx.fillStyle = colors.radar; ctx.globalAlpha = 0.28 * (1 - i / 40);
          ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, a0 - Math.PI / 2 - 0.016, a0 - Math.PI / 2); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.strokeStyle = colors.radar; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + R * Math.sin(sweep), c - R * Math.cos(sweep)); ctx.stroke(); ctx.lineWidth = 1;
      } else {
        ctx.fillStyle = colors.danger; ctx.font = "bold 14px JetBrains Mono, monospace"; ctx.textAlign = "center";
        ctx.fillText("RADAR TX OFFLINE (SIMULATED FAULT)", c, c + 30); ctx.textAlign = "left";
      }

      for (const t of s.targets) {
        if (filterDrones && t.cls?.predicted !== "drone" && t.truth !== "drone") continue;
        const p = t.track?.pos;
        if (!p) continue;
        const ang = (Math.atan2(p.x, p.y) + Math.PI * 2) % (Math.PI * 2);
        const diff = (sweep - ang + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.12 && t.detected) blips.set(t.id, now);
        const age = (now - (blips.get(t.id) ?? now - 99999)) / 1000;
        const fade = s.running ? Math.max(0.25, 1 - age / 7) : 1;
        const col = (colors as Record<string, string>)[CLASS_TOKEN[t.cls?.predicted ?? "unknown"]];
        const x = c + p.x * k, y = c - p.y * k;
        if (showTracks) {
          ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.beginPath();
          t.track!.history.forEach((h, i) => (i ? ctx.lineTo(c + h.x * k, c - h.y * k) : ctx.moveTo(c + h.x * k, c - h.y * k)));
          ctx.lineTo(x, y); ctx.stroke();
          ctx.setLineDash([3, 4]); ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(x, y);
          const pred = predictPath(t.track!);
          pred.forEach((q) => ctx.lineTo(c + q.x * k, c - q.y * k)); ctx.stroke(); ctx.setLineDash([]);
          const end = pred[pred.length - 1];
          ctx.globalAlpha = 0.15; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c + end.x * k, c - end.y * k, Math.max(3, end.sigma * k), 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, Math.max(3, t.track!.sigma * k * 2), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = fade; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(x, y, s.selectedId === t.id ? 5.5 : 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        // velocity vector
        ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + t.track!.vel.x * k * 20, y - t.track!.vel.y * k * 20); ctx.stroke();
        if (s.selectedId === t.id) { ctx.strokeStyle = colors.cyan; ctx.strokeRect(x - 10, y - 10, 20, 20); }
        ctx.fillStyle = col; ctx.font = "10px JetBrains Mono, monospace"; ctx.fillText(t.id, x + 8, y - 6);
        ctx.globalAlpha = 1;
      }
      // station
      ctx.fillStyle = colors.cyan; ctx.beginPath(); ctx.arc(c, c, 4, 0, Math.PI * 2); ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [showTracks, showZones, filterDrones]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ref.current!; const rect = cv.getBoundingClientRect();
    const size = rect.width, c = size / 2, k = (size / 2 - 14) / DISPLAY_RANGE_M;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best: string | null = null, bd = 18;
    for (const t of useSim.getState().targets) {
      if (!t.track) continue;
      const d = Math.hypot(c + t.track.pos.x * k - mx, c - t.track.pos.y * k - my);
      if (d < bd) { bd = d; best = t.id; }
    }
    if (best) select(best);
  };

  return <canvas ref={ref} onClick={onClick} className={className ?? "aspect-square w-full cursor-crosshair"} aria-label="Simulated radar scope" />;
}
