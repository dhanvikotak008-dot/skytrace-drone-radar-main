import { useEffect, useRef } from "react";
import { FS } from "@/sim/model";

// Perceptual-ish "inferno-like" ramp for heatmap (dark navy -> cyan -> green -> yellow -> red)
const STOPS: [number, [number, number, number]][] = [
  [0, [6, 10, 26]], [0.3, [10, 60, 120]], [0.5, [0, 190, 200]], [0.7, [80, 240, 120]], [0.85, [250, 220, 60]], [1, [255, 70, 40]],
];
function ramp(v: number): [number, number, number] {
  v = Math.max(0, Math.min(1, v));
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
      const t = (v - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/** Heatmap: time on x axis, Doppler frequency on y axis. */
export function Spectrogram({ frames, frameDt, height = 260, dynRange = 45 }: { frames: number[][]; frameDt: number; height?: number; dynRange?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || !frames.length) return;
    const nT = frames.length, nF = frames[0].length;
    const off = document.createElement("canvas"); off.width = nT; off.height = nF;
    const octx = off.getContext("2d")!; const img = octx.createImageData(nT, nF);
    let max = -Infinity; frames.forEach((f) => f.forEach((v) => (max = Math.max(max, v))));
    for (let t = 0; t < nT; t++) for (let f = 0; f < nF; f++) {
      const v = (frames[t][f] - (max - dynRange)) / dynRange;
      const [r, g, b] = ramp(v); const y = nF - 1 - f; const i = (y * nT + t) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    const w = cv.clientWidth, h = height, dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = 48, B = 22;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, L, 0, w - L, h - B);
    ctx.fillStyle = "rgba(180,220,230,0.8)"; ctx.font = "10px JetBrains Mono, monospace";
    for (let i = 0; i <= 4; i++) {
      const fHz = FS / 2 - (i * FS) / 4; const y = (i * (h - B)) / 4;
      ctx.fillText(`${(fHz / 1000).toFixed(1)}k`, 2, Math.min(h - B - 2, y + 10));
      ctx.fillRect(L - 4, y, 4, 1);
    }
    const total = nT * frameDt;
    for (let i = 0; i <= 5; i++) {
      const x = L + (i * (w - L)) / 5;
      ctx.fillText(`${((i * total) / 5 * 1000).toFixed(0)}`, Math.min(x - 6, w - 24), h - 6);
    }
    ctx.fillText("ms", w - 16, h - 6);
  }, [frames, frameDt, height, dynRange]);
  return (
    <div className="relative">
      <canvas ref={ref} style={{ height }} className="w-full rounded-sm border border-border" />
      <span className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 origin-left font-mono text-[9px] text-muted-foreground" />
    </div>
  );
}
