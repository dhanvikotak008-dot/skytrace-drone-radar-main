// Pure simulation math — no React, no three.js. All values are SYNTHETIC.

export type TargetClass = "drone" | "bird" | "other" | "unknown";
export type Behavior = "approach" | "depart" | "loiter" | "wander" | "hover";

export const CLASS_LABEL: Record<TargetClass, string> = {
  drone: "Drone-like",
  bird: "Bird-like",
  other: "Other moving",
  unknown: "Unknown",
};

// ---- Assumed radar parameters (illustrative, not a real system spec) ----
export const RADAR = {
  fc: 10e9, // carrier Hz (X-band, assumed)
  c: 3e8,
  Pt: 200, // W
  gainDb: 38,
  noiseFigDb: 5,
  bandwidth: 1e6, // receiver noise bandwidth Hz
  T0: 290,
  k: 1.380649e-23,
  snrMinDb: 13,
  pulsesIntegrated: 4096,
  chirpBw: 150e6, // FMCW sweep bandwidth
  chirpT: 1e-3,
};
export const LAMBDA = RADAR.c / RADAR.fc;
export const DISPLAY_RANGE_M = 8000; // display scale of the simulated scope
export const ZONE_RESTRICTED_M = 1500;
export const ZONE_BUFFER_M = 3000;

export const RCS: Record<TargetClass, number> = { drone: 0.01, bird: 0.005, other: 1, unknown: 0.05 };

const db = (x: number) => 10 * Math.log10(x);
const undb = (x: number) => Math.pow(10, x / 10);

/** Radar range equation: R_max = [Pt G² λ² σ N / ((4π)³ k T B F SNRmin)]^(1/4) */
export function maxRange(rcs: number, rxPenaltyDb = 0) {
  const G = undb(RADAR.gainDb);
  const num = RADAR.Pt * G * G * LAMBDA * LAMBDA * rcs * RADAR.pulsesIntegrated;
  const den =
    Math.pow(4 * Math.PI, 3) * RADAR.k * RADAR.T0 * RADAR.bandwidth * undb(RADAR.noiseFigDb + rxPenaltyDb) * undb(RADAR.snrMinDb);
  return Math.pow(num / den, 0.25);
}
/** SNR (dB) at range R — scales with R^-4. */
export function snrAt(range: number, rcs: number, rxPenaltyDb = 0) {
  const r = Math.max(range, 50);
  return RADAR.snrMinDb + 40 * Math.log10(maxRange(rcs, rxPenaltyDb) / r);
}
/** Doppler shift f_d = 2 v_r / λ (v_r > 0 approaching). */
export const dopplerHz = (vr: number) => (2 * vr) / LAMBDA;
/** FMCW beat frequency f_b = 2 R S / c with slope S = B/T. */
export const beatHz = (R: number) => (2 * R * (RADAR.chirpBw / RADAR.chirpT)) / RADAR.c;

// ---- Targets ----
export interface Vec3 { x: number; y: number; z: number }
export interface Track {
  pos: Vec3; vel: Vec3; sigma: number; // estimated state + 1σ position uncertainty (m)
  history: Vec3[];
}
export interface Classification {
  probs: Record<TargetClass, number>;
  predicted: TargetClass;
  confidence: number;
  features: Features;
  at: number;
}
export interface Target {
  id: string;
  truth: TargetClass; // ground-truth type of the synthetic target
  pos: Vec3; // m, radar at origin; x east, y north, z altitude
  speed: number; heading: number; // rad, 0 = north, clockwise
  vz: number;
  behavior: Behavior; behaviorTimer: number;
  rotorHz: number; flapHz: number;
  firstSeen: number | null; // sim-epoch ms
  detected: boolean; snrDb: number;
  track: Track | null;
  cls: Classification | null;
  prevHeading: number;
  unusual: string | null;
}

export const range3 = (p: Vec3) => Math.hypot(p.x, p.y, p.z);
export const range2 = (p: Vec3) => Math.hypot(p.x, p.y);
export const bearingDeg = (p: Vec3) => ((Math.atan2(p.x, p.y) * 180) / Math.PI + 360) % 360;
export const headingDeg = (h: number) => (((h * 180) / Math.PI) % 360 + 360) % 360;
export function compass(deg: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}
export function velocity(t: Target): Vec3 {
  return { x: t.speed * Math.sin(t.heading), y: t.speed * Math.cos(t.heading), z: t.vz };
}
/** Radial velocity, positive when closing on the radar. */
export function radialVel(p: Vec3, v: Vec3) {
  const r = range3(p) || 1;
  return -(p.x * v.x + p.y * v.y + p.z * v.z) / r;
}

export const DEFAULTS: Record<TargetClass, { speed: [number, number]; alt: [number, number] }> = {
  drone: { speed: [6, 18], alt: [60, 400] },
  bird: { speed: [8, 15], alt: [30, 250] },
  other: { speed: [35, 60], alt: [400, 1500] },
  unknown: { speed: [12, 30], alt: [100, 800] },
};

export function makeTarget(
  id: string, truth: TargetClass, rnd: () => number,
  opts: Partial<{ distance: number; altitude: number; speed: number; headingDeg: number; behavior: Behavior; bearingDeg: number }> = {},
): Target {
  const d = DEFAULTS[truth];
  const dist = opts.distance ?? 2500 + rnd() * 4500;
  const brg = ((opts.bearingDeg ?? rnd() * 360) * Math.PI) / 180;
  const pos = { x: dist * Math.sin(brg), y: dist * Math.cos(brg), z: opts.altitude ?? d.alt[0] + rnd() * (d.alt[1] - d.alt[0]) };
  const behaviors: Behavior[] = ["approach", "depart", "loiter", "wander"];
  const behavior = opts.behavior ?? behaviors[Math.floor(rnd() * behaviors.length)];
  const heading = opts.headingDeg !== undefined ? (opts.headingDeg * Math.PI) / 180 : behavior === "approach" ? brg + Math.PI : rnd() * Math.PI * 2;
  return {
    id, truth, pos,
    speed: opts.speed ?? d.speed[0] + rnd() * (d.speed[1] - d.speed[0]),
    heading, vz: 0, behavior, behaviorTimer: 20 + rnd() * 30,
    rotorHz: 70 + rnd() * 40, flapHz: 3 + rnd() * 5,
    firstSeen: null, detected: false, snrDb: -99, track: null, cls: null,
    prevHeading: heading, unusual: null,
  };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Advance true kinematics by dt seconds. */
export function moveTarget(t: Target, dt: number, rnd: () => number) {
  t.behaviorTimer -= dt;
  if (t.behaviorTimer <= 0) {
    const opts: Behavior[] = t.truth === "drone" ? ["approach", "depart", "loiter", "wander", "hover"] : ["approach", "depart", "loiter", "wander"];
    t.behavior = opts[Math.floor(rnd() * opts.length)];
    t.behaviorTimer = 15 + rnd() * 35;
  }
  const toRadar = Math.atan2(-t.pos.x, -t.pos.y);
  let desired = t.heading;
  let spd = t.speed;
  switch (t.behavior) {
    case "approach": desired = toRadar; break;
    case "depart": desired = toRadar + Math.PI; break;
    case "loiter": desired = t.heading + 0.25 * dt * 4; break;
    case "wander": desired = t.heading + (rnd() - 0.5) * 0.6; break;
    case "hover": spd = 0; break;
  }
  const turnRate = t.truth === "other" ? 0.08 : 0.35;
  t.prevHeading = t.heading;
  t.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, wrap(desired - t.heading)));
  const effSpeed = t.behavior === "hover" ? Math.max(0, t.speed * 0.02) : spd;
  const d = DEFAULTS[t.truth];
  t.vz += (rnd() - 0.5) * (t.truth === "drone" ? 1.2 : 0.4) * dt;
  t.vz *= Math.exp(-0.3 * dt);
  if (t.pos.z < d.alt[0] * 0.6) t.vz += 0.5 * dt;
  if (t.pos.z > d.alt[1] * 1.3) t.vz -= 0.5 * dt;
  t.pos.x += effSpeed * Math.sin(t.heading) * dt;
  t.pos.y += effSpeed * Math.cos(t.heading) * dt;
  t.pos.z = Math.max(5, t.pos.z + t.vz * dt);
  // Keep within scope: bounce back if far away
  if (range2(t.pos) > DISPLAY_RANGE_M * 1.05) { t.behavior = "approach"; t.behaviorTimer = 30; }
  if (range2(t.pos) < 150 && t.behavior === "approach") { t.behavior = "depart"; t.behaviorTimer = 30; }
  return effSpeed;
}

export function gauss(rnd: () => number) {
  const u = Math.max(rnd(), 1e-9), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Alpha-beta tracker update with noisy measurement. */
export function updateTrack(t: Target, meas: Vec3 | null, dt: number, measSigma: number) {
  if (!t.track) {
    if (!meas) return;
    t.track = { pos: { ...meas }, vel: { x: 0, y: 0, z: 0 }, sigma: measSigma, history: [] };
    return;
  }
  const tr = t.track;
  const pred = { x: tr.pos.x + tr.vel.x * dt, y: tr.pos.y + tr.vel.y * dt, z: tr.pos.z + tr.vel.z * dt };
  if (meas) {
    const a = 0.35, b = 0.06;
    (["x", "y", "z"] as const).forEach((k) => {
      const r = meas[k] - pred[k];
      tr.pos[k] = pred[k] + a * r;
      tr.vel[k] = tr.vel[k] + (b / dt) * r;
    });
    tr.sigma = 0.85 * tr.sigma + 0.15 * measSigma * 0.6;
  } else {
    tr.pos = pred;
    tr.sigma += 8 * dt; // coasting: uncertainty grows
  }
}

/** Constant-velocity prediction with growing uncertainty. */
export function predictPath(tr: Track, horizon = 60, step = 5) {
  const out: (Vec3 & { sigma: number; t: number })[] = [];
  for (let s = step; s <= horizon; s += step) {
    out.push({ x: tr.pos.x + tr.vel.x * s, y: tr.pos.y + tr.vel.y * s, z: Math.max(0, tr.pos.z + tr.vel.z * s), sigma: tr.sigma + 2.5 * s, t: s });
  }
  return out;
}

// ---- Micro-Doppler signal synthesis ----
export const FS = 8000; // complex sample rate (Hz) of the synthetic baseband

export interface SigParams { cls: TargetClass; vr: number; rotorHz: number; flapHz: number; snrDb: number; noise: number }

/** Complex baseband echo s(t) = A_body e^{j2πf_d t} + Σ_k A_k e^{j(2πf_d t + β sin(2πΩt+φ_k))} + n(t) */
export function synthSignal(p: SigParams, t0: number, n: number, rnd: () => number) {
  const re = new Float64Array(n), im = new Float64Array(n);
  const fd = dopplerHz(p.vr);
  const snrLin = undb(Math.max(-10, Math.min(40, p.snrDb)));
  const noiseAmp = Math.sqrt(1 / snrLin) * (0.3 + p.noise * 1.5);
  for (let i = 0; i < n; i++) {
    const t = t0 + i / FS;
    let ph = 2 * Math.PI * fd * t;
    let r = Math.cos(ph), q = Math.sin(ph);
    if (p.cls === "drone") {
      // 4 rotors x 2 blades, blade-centre radius 0.06 m
      const beta = (4 * Math.PI * 0.06) / LAMBDA;
      for (let rot = 0; rot < 4; rot++) {
        const om = p.rotorHz * (1 + rot * 0.035);
        for (let b = 0; b < 2; b++) {
          const phi = rot * 1.3 + b * Math.PI;
          const ang = 2 * Math.PI * om * t + phi;
          // blade flash: amplitude peaks when blade is broadside
          const flash = 0.08 + 0.35 * Math.pow(Math.abs(Math.cos(ang)), 6);
          const p2 = ph + beta * Math.sin(ang);
          r += flash * Math.cos(p2); q += flash * Math.sin(p2);
        }
      }
    } else if (p.cls === "bird") {
      const beta = (4 * Math.PI * 0.15) / LAMBDA / 3;
      const ang = 2 * Math.PI * p.flapHz * t;
      const p2 = ph + beta * Math.sin(ang);
      r += 0.7 * Math.cos(p2); q += 0.7 * Math.sin(p2);
      r *= 1 + 0.25 * Math.sin(ang * 2); q *= 1 + 0.25 * Math.sin(ang * 2);
    } else if (p.cls === "unknown") {
      const p2 = ph + 6 * Math.sin(2 * Math.PI * 17 * t) + 2 * gauss(rnd) * 0.2;
      r += 0.4 * Math.cos(p2); q += 0.4 * Math.sin(p2);
    } else {
      // rigid body, slight engine modulation
      const p2 = ph + 0.8 * Math.sin(2 * Math.PI * 40 * t);
      r += 0.2 * Math.cos(p2); q += 0.2 * Math.sin(p2);
    }
    re[i] = r + noiseAmp * gauss(rnd); im[i] = q + noiseAmp * gauss(rnd);
  }
  return { re, im };
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/** STFT with Hann window. Returns frames[time][freq] magnitude in dB, freq axis centred (−FS/2..FS/2). */
export function stft(sig: { re: Float64Array; im: Float64Array }, win = 128, hop = 32) {
  const frames: number[][] = [];
  const w = Array.from({ length: win }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1)));
  for (let s = 0; s + win <= sig.re.length; s += hop) {
    const re = new Float64Array(win), im = new Float64Array(win);
    for (let i = 0; i < win; i++) { re[i] = sig.re[s + i] * w[i]; im[i] = sig.im[s + i] * w[i]; }
    fft(re, im);
    const col: number[] = new Array(win);
    for (let k = 0; k < win; k++) {
      const src = (k + win / 2) % win; // fftshift
      col[k] = 20 * Math.log10(Math.hypot(re[src], im[src]) / win + 1e-9);
    }
    frames.push(col);
  }
  return { frames, win, hop, binHz: FS / win, frameDt: hop / FS };
}

export interface Features { bandwidthHz: number; modRateHz: number; bodyDopplerHz: number; speed: number; snrDb: number; altitude: number }

/** Extract features from the spectrogram: occupied bandwidth and modulation periodicity. */
export function extractFeatures(spec: ReturnType<typeof stft>, extra: { speed: number; snrDb: number; altitude: number }): Features {
  const { frames, win, binHz, frameDt } = spec;
  const mean = new Array(win).fill(0);
  frames.forEach((f) => f.forEach((v, k) => (mean[k] += v / frames.length)));
  const peak = Math.max(...mean);
  const peakBin = mean.indexOf(peak);
  const floor = [...mean].sort((a, b) => a - b)[Math.floor(win * 0.3)];
  const thr = floor + (peak - floor) * 0.25;
  const occupied = mean.filter((v) => v > thr).length;
  // per-frame spread series -> autocorrelation peak gives modulation rate
  const spread = frames.map((f) => f.filter((v) => v > thr).length);
  const m = spread.reduce((a, b) => a + b, 0) / spread.length;
  const x = spread.map((v) => v - m);
  let best = 0, bestLag = 0;
  for (let lag = 2; lag < x.length / 2; lag++) {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += x[i] * x[i + lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  const modRateHz = bestLag ? 1 / (bestLag * frameDt) : 0;
  return { bandwidthHz: occupied * binHz, modRateHz, bodyDopplerHz: (peakBin - win / 2) * binHz, ...extra };
}

/** Simulated rule-based "AI" classifier (softmax over heuristic scores). NOT a validated detector. */
export function classify(f: Features, noise: number, at: number, fusionBonus = 0): Classification {
  const sig = (x: number) => 1 / (1 + Math.exp(-x));
  const s: Record<TargetClass, number> = {
    drone: 3 * sig((f.bandwidthHz - 1200) / 300) + 1.2 * sig((25 - f.speed) / 5) + fusionBonus,
    bird: 2.2 * sig((f.bandwidthHz - 120) / 60) * sig((900 - f.bandwidthHz) / 150) + 1.2 * sig((f.modRateHz - 1.5) / 0.5) * sig((14 - f.modRateHz) / 2) + 0.6 * sig((300 - f.altitude) / 80),
    other: 2.5 * sig((f.speed - 30) / 5) + 1.2 * sig((250 - f.bandwidthHz) / 60),
    unknown: 0.9 + 2 * sig((8 - f.snrDb) / 3) + noise * 1.5,
  };
  const temp = 0.55 + noise * 0.8;
  const ex = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.exp(v / temp)])) as Record<TargetClass, number>;
  const tot = Object.values(ex).reduce((a, b) => a + b, 0);
  const probs = Object.fromEntries(Object.entries(ex).map(([k, v]) => [k, v / tot])) as Record<TargetClass, number>;
  const predicted = (Object.keys(probs) as TargetClass[]).reduce((a, b) => (probs[a] >= probs[b] ? a : b));
  return { probs, predicted, confidence: probs[predicted], features: f, at };
}

export type Priority = "LOW" | "MEDIUM" | "HIGH";
export function priorityOf(t: Target): Priority {
  const r = range2(t.track?.pos ?? t.pos);
  const isDrone = t.cls?.predicted === "drone" || t.cls?.predicted === "unknown";
  if (r < ZONE_RESTRICTED_M && isDrone) return "HIGH";
  if ((r < ZONE_BUFFER_M && isDrone) || (r < ZONE_RESTRICTED_M) || (t.unusual && isDrone)) return "MEDIUM";
  return "LOW";
}
