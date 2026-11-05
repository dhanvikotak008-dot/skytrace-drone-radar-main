import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AudioWaveform, BookOpen, Waves } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Spectrogram } from "@/components/Spectrogram";
import { PageHeader, Panel, Stat, TargetPicker, ClassBadge, useSelected, cssVar } from "@/components/hud";
import { useSim } from "@/sim/store";
import { FS, LAMBDA, RADAR, dopplerHz, radialVel, stft, synthSignal, velocity, type TargetClass } from "@/sim/model";

export const Route = createFileRoute("/micro-doppler")({
  head: () => ({
    meta: [
      { title: "Micro-Doppler Analysis — SkyWatch-MD" },
      { name: "description", content: "Synthetic radar echo, Doppler spectrum and STFT micro-Doppler spectrogram comparing rotor and wing-flap signatures." },
      { property: "og:title", content: "Micro-Doppler Analysis — SkyWatch-MD" },
      { property: "og:description", content: "Interactive STFT spectrogram of simulated drone and bird radar echoes." },
    ],
  }),
  component: MicroDoppler,
});

const N = 4096; // 0.512 s at 8 kHz

export function useSignature(cls: TargetClass, vr: number, rotorHz: number, flapHz: number, snrDb: number, noise: number, t0: number, win: number) {
  return useMemo(() => {
    const sig = synthSignal({ cls, vr, rotorHz, flapHz, snrDb, noise }, t0, N, Math.random);
    return { sig, spec: stft(sig, win, win / 4) };
  }, [cls, Math.round(vr), Math.round(rotorHz), Math.round(flapHz), Math.round(snrDb / 2), noise, Math.floor(t0 * 2), win]);
}

function MicroDoppler() {
  const t = useSelected();
  const simTime = useSim((s) => s.simTime);
  const noise = useSim((s) => s.noise);
  const [win, setWin] = useState(128);
  const [rotorOverride, setRotor] = useState<number | null>(null);
  const tr = t?.track;
  const vr = t ? radialVel(t.pos, velocity(t)) : 0;
  const rotor = rotorOverride ?? t?.rotorHz ?? 90;
  const snr = t?.detected ? t.snrDb : 5;
  const cur = useSignature(t?.truth ?? "drone", vr, rotor, t?.flapHz ?? 5, snr, noise, simTime, win);
  const drone = useSignature("drone", 4, 95, 5, 25, noise, simTime, win);
  const bird = useSignature("bird", 4, 95, 5, 25, noise, simTime, win);

  const timeData = useMemo(() => Array.from({ length: 240 }, (_, i) => ({ t: +((i / FS) * 1000).toFixed(2), I: +cur.sig.re[i].toFixed(3), Q: +cur.sig.im[i].toFixed(3) })), [cur]);
  const specData = useMemo(() => {
    const { frames, win: w, binHz } = cur.spec;
    return Array.from({ length: w }, (_, k) => ({ f: Math.round((k - w / 2) * binHz), p: +(frames.reduce((a, f) => a + f[k], 0) / frames.length).toFixed(1) }));
  }, [cur]);
  const tip = { background: cssVar("popover"), border: `1px solid ${cssVar("border")}`, fontSize: 11 };
  const bladeTip = (2 * 2 * Math.PI * rotor * 0.12) / LAMBDA;

  return (
    <>
      <PageHeader code="MODULE 03 / µD" title="Micro-Doppler Analysis" desc="Synthetic complex baseband echo of the selected target and its Short-Time Fourier Transform. Spectrogram updates continuously and whenever the selected target changes." />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <TargetPicker />
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">STFT window</span>
          {[64, 128, 256].map((w) => <button key={w} onClick={() => setWin(w)} className={`rounded-sm border px-2 py-0.5 ${w === win ? "border-cyan text-cyan" : "border-border text-muted-foreground"}`}>{w}</button>)}
        </div>
        <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          Rotor rate {rotor.toFixed(0)} rev/s
          <input type="range" min={30} max={160} value={rotor} onChange={(e) => setRotor(+e.target.value)} className="accent-current text-radar" />
          {rotorOverride !== null && <button className="text-cyan" onClick={() => setRotor(null)}>auto</button>}
        </label>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title={`Micro-Doppler spectrogram — ${t?.id ?? ""}`} icon={<AudioWaveform className="h-3.5 w-3.5" />} right={<span className="font-mono text-[10px] text-muted-foreground">freq (Hz) ↕ · time (ms) ↔</span>}>
          <Spectrogram frames={cur.spec.frames} frameDt={cur.spec.frameDt} height={300} />
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="True synthetic type" value={<ClassBadge c={t?.truth} />} />
            <Stat label="Body Doppler f_d" value={dopplerHz(vr).toFixed(0)} unit="Hz" tone="radar" sub={`v_r ${vr.toFixed(1)} m/s`} />
            <Stat label="Freq. resolution" value={(FS / win).toFixed(1)} unit="Hz" sub={`Δt ${((win / FS) * 1000).toFixed(1)} ms`} />
            <Stat label="Est. SNR" value={tr ? snr.toFixed(1) : "—"} unit="dB" tone="cyan" />
          </div>
        </Panel>
        <Panel title="Theory" icon={<BookOpen className="h-3.5 w-3.5" />}>
          <div className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
            <p>The radar transmits at <span className="font-mono text-cyan">f_c = {RADAR.fc / 1e9} GHz</span> (λ = {(LAMBDA * 100).toFixed(1)} cm, assumed). Bulk motion shifts the echo by <span className="font-mono text-radar">f_d = 2v_r/λ</span>.</p>
            <p>Each rotating propeller blade adds a time-varying phase <span className="font-mono text-radar">φ(t) = (4π r/λ)·sin(2πΩt + φ_k)</span>. Its instantaneous frequency oscillates around f_d with amplitude <span className="font-mono">2·(2πΩr)/λ</span> — for 12 cm blades at {rotor.toFixed(0)} rev/s the blade-tip spread is ≈ <span className="font-mono text-warn">±{(bladeTip / 1000).toFixed(1)} kHz</span> (folded by the 8 kHz sample rate).</p>
            <p>Blades reflect strongly when broadside, producing periodic vertical <span className="text-warn">"blade flashes"</span> and wide sidebands. A bird's wings flap at only 3–8 Hz with low tip speed, giving a slow, narrow sinusoidal modulation.</p>
            <p>The STFT, <span className="font-mono">X(m,k)=Σ x[n]w[n−mH]e^(−j2πkn/N)</span>, trades time vs frequency resolution — try the window buttons.</p>
          </div>
        </Panel>
        <Panel title="Synthetic radar signal (I/Q)" icon={<Waves className="h-3.5 w-3.5" />}>
          <div className="h-48"><ResponsiveContainer><LineChart data={timeData}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.08} /><XAxis dataKey="t" fontSize={10} stroke="currentColor" unit="ms" /><YAxis fontSize={10} stroke="currentColor" />
            <Tooltip contentStyle={tip} /><Line dataKey="I" dot={false} stroke={cssVar("radar")} isAnimationActive={false} strokeWidth={1} /><Line dataKey="Q" dot={false} stroke={cssVar("cyan")} isAnimationActive={false} strokeWidth={1} />
          </LineChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Doppler frequency spectrum" icon={<Waves className="h-3.5 w-3.5" />}>
          <div className="h-48"><ResponsiveContainer><AreaChart data={specData}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.08} /><XAxis dataKey="f" fontSize={10} stroke="currentColor" interval={Math.floor(specData.length / 6)} /><YAxis fontSize={10} stroke="currentColor" unit="dB" domain={["auto", "auto"]} />
            <Tooltip contentStyle={tip} /><Area dataKey="p" stroke={cssVar("warn")} fill={cssVar("warn")} fillOpacity={0.2} isAnimationActive={false} />
          </AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Rotor modulation parameters" icon={<AudioWaveform className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Rotors × blades" value="4 × 2" />
            <Stat label="Rotation rate Ω" value={rotor.toFixed(0)} unit="rev/s" tone="warn" />
            <Stat label="Blade flash rate" value={(rotor * 2).toFixed(0)} unit="Hz" sub="2 blades × Ω" />
            <Stat label="Tip velocity" value={(2 * Math.PI * rotor * 0.12).toFixed(0)} unit="m/s" />
          </div>
        </Panel>
        <Panel className="xl:col-span-3" title="Signature comparison — reference synthetic templates" icon={<AudioWaveform className="h-3.5 w-3.5" />}>
          <div className="grid gap-4 md:grid-cols-2">
            <div><div className="mb-1 font-mono text-xs text-warn">DRONE-LIKE · quad-rotor, Ω ≈ 95 rev/s</div><Spectrogram frames={drone.spec.frames} frameDt={drone.spec.frameDt} height={200} /><p className="mt-1 text-[11px] text-muted-foreground">Broad, periodic vertical streaks spanning kHz — rotor blade flashes.</p></div>
            <div><div className="mb-1 font-mono text-xs text-cyan">BIRD-LIKE · wing flap ≈ 5 Hz</div><Spectrogram frames={bird.spec.frames} frameDt={bird.spec.frameDt} height={200} /><p className="mt-1 text-[11px] text-muted-foreground">Narrow body line with slow sinusoidal wobble — wing beats.</p></div>
          </div>
        </Panel>
      </div>
    </>
  );
}
