import { create } from "zustand";
import {
  type Behavior, type Classification, type Priority, type Target, type TargetClass,
  RCS, ZONE_BUFFER_M, ZONE_RESTRICTED_M, classify, extractFeatures, gauss, makeTarget, moveTarget,
  priorityOf, radialVel, range2, range3, snrAt, stft, synthSignal, updateTrack, velocity, CLASS_LABEL, FS,
} from "./model";

export type SensorKey = "radar" | "receiver" | "camera" | "rf" | "iot";
export interface SimEvent { id: number; at: number; level: Priority | "INFO"; targetId?: string; msg: string }
export interface HistoryEntry extends Classification { targetId: string; truth: TargetClass }

export interface SimState {
  running: boolean; seeded: boolean;
  simTime: number; epoch: number; timeScale: number;
  noise: number; // 0..1
  failures: Record<SensorKey, boolean>;
  targets: Target[]; nextId: number; selectedId: string | null;
  events: SimEvent[]; eventId: number;
  history: HistoryEntry[];
  sensor: { radarTemp: number; latencyMs: number; packetLoss: number; battery: number; fps: number };
  zoneState: Record<string, "out" | "buffer" | "restricted">;
  lastHist: number; lastCls: Record<string, number>;
  start: () => void; pause: () => void; reset: () => void; seed: () => void;
  tick: (dtReal: number) => void;
  select: (id: string | null) => void;
  addTarget: (cls: TargetClass, o: { distance: number; altitude: number; speed: number; headingDeg: number; bearingDeg: number; behavior: Behavior }) => void;
  removeTarget: (id: string) => void;
  setNoise: (n: number) => void; setTimeScale: (n: number) => void;
  toggleFailure: (k: SensorKey) => void;
}

const fmtId = (n: number) => `TGT-${String(n).padStart(3, "0")}`;
export const SENSOR_NAME: Record<SensorKey, string> = {
  radar: "FMCW radar transmitter", receiver: "Radar receiver", camera: "EO camera", rf: "RF detection", iot: "IoT monitoring link",
};

function initial() {
  return {
    running: false, seeded: false, simTime: 0, epoch: 0, timeScale: 5, noise: 0.2,
    failures: { radar: false, receiver: false, camera: false, rf: false, iot: false },
    targets: [] as Target[], nextId: 1, selectedId: null as string | null,
    events: [] as SimEvent[], eventId: 1, history: [] as HistoryEntry[],
    sensor: { radarTemp: 41, latencyMs: 38, packetLoss: 0.4, battery: 96, fps: 30 },
    zoneState: {} as Record<string, "out" | "buffer" | "restricted">, lastHist: 0, lastCls: {} as Record<string, number>,
  };
}

export const useSim = create<SimState>((set, get) => {
  const log = (s: SimState, level: SimEvent["level"], msg: string, targetId?: string) => {
    s.events = [{ id: s.eventId++, at: s.epoch + s.simTime * 1000, level, msg, targetId }, ...s.events].slice(0, 300);
  };
  const seedTargets = (s: SimState) => {
    const kinds: TargetClass[] = ["drone", "drone", "drone", "bird", "bird", "other", "unknown"];
    const behaviors: Behavior[] = ["approach", "depart", "loiter", "approach", "wander", "wander", "approach"];
    s.targets = kinds.map((k, i) => makeTarget(fmtId(i + 1), k, Math.random, { behavior: behaviors[i] }));
    s.nextId = kinds.length + 1;
    s.selectedId = s.targets[0].id;
  };
  return {
    ...initial(),
    seed: () => {
      if (get().seeded) return;
      const s = { ...get(), ...initial(), seeded: true, epoch: Date.now(), running: true } as SimState;
      seedTargets(s);
      log(s, "INFO", "Simulation initialised with synthetic targets");
      set(s);
    },
    start: () => { const s = { ...get() }; s.running = true; log(s, "INFO", "Simulation started"); set(s); },
    pause: () => { const s = { ...get() }; s.running = false; log(s, "INFO", "Simulation paused"); set(s); },
    reset: () => {
      const s = { ...get(), ...initial(), seeded: true, epoch: Date.now(), running: false } as SimState;
      seedTargets(s);
      log(s, "INFO", "Simulation reset");
      set(s);
    },
    select: (id) => set({ selectedId: id }),
    addTarget: (cls, o) => {
      const s = { ...get() };
      const id = fmtId(s.nextId++);
      s.targets = [...s.targets, makeTarget(id, cls, Math.random, o)];
      s.selectedId = id;
      log(s, "INFO", `Injected synthetic ${CLASS_LABEL[cls].toLowerCase()} target at ${(o.distance / 1000).toFixed(1)} km`, id);
      set(s);
    },
    removeTarget: (id) => {
      const s = { ...get() };
      s.targets = s.targets.filter((t) => t.id !== id);
      if (s.selectedId === id) s.selectedId = s.targets[0]?.id ?? null;
      log(s, "INFO", `Removed ${id}`, id);
      set(s);
    },
    setNoise: (n) => set({ noise: n }),
    setTimeScale: (n) => set({ timeScale: n }),
    toggleFailure: (k) => {
      const s = { ...get(), failures: { ...get().failures, [k]: !get().failures[k] } };
      log(s, s.failures[k] ? "HIGH" : "INFO", `${SENSOR_NAME[k]} ${s.failures[k] ? "FAILURE simulated" : "restored"}`);
      set(s);
    },
    tick: (dtReal) => {
      const prev = get();
      if (!prev.running || !prev.seeded) return;
      const s: SimState = { ...prev, sensor: { ...prev.sensor }, zoneState: { ...prev.zoneState }, lastCls: { ...prev.lastCls } };
      const dt = Math.min(dtReal, 0.25) * s.timeScale;
      s.simTime += dt;
      const rxPenalty = (s.failures.receiver ? 10 : 0) + s.noise * 8;
      const sampleHist = s.simTime - s.lastHist >= 2;
      if (sampleHist) s.lastHist = s.simTime;

      s.targets = s.targets.map((orig) => {
        const t: Target = { ...orig, pos: { ...orig.pos }, track: orig.track ? { ...orig.track, pos: { ...orig.track.pos }, vel: { ...orig.track.vel } } : null };
        const oldHeading = t.heading;
        moveTarget(t, dt, Math.random);
        const R = range3(t.pos);
        t.snrDb = s.failures.radar ? -99 : snrAt(R, RCS[t.truth], rxPenalty) + gauss(Math.random) * 1.5;
        const wasDetected = t.detected;
        t.detected = t.snrDb > 13;
        const measSigma = 5 + (R / 200) * (1 + s.noise * 4);
        const meas = t.detected
          ? { x: t.pos.x + gauss(Math.random) * measSigma, y: t.pos.y + gauss(Math.random) * measSigma, z: t.pos.z + gauss(Math.random) * measSigma * 0.5 }
          : null;
        if (t.detected || t.track) updateTrack(t, meas, dt, measSigma);
        if (t.track && t.track.sigma > 600) { t.track = null; log(s, "INFO", `Track lost for ${t.id}`, t.id); }
        if (t.detected && !wasDetected) {
          if (t.firstSeen === null) t.firstSeen = s.epoch + s.simTime * 1000;
          log(s, "LOW", `New radar detection ${t.id} at ${(R / 1000).toFixed(2)} km (SNR ${t.snrDb.toFixed(1)} dB)`, t.id);
        }
        if (t.track && sampleHist) t.track.history = [...t.track.history, { ...t.track.pos }].slice(-60);

        // unusual movement indicators
        const turn = Math.abs(Math.atan2(Math.sin(t.heading - oldHeading), Math.cos(t.heading - oldHeading))) / Math.max(dt, 1e-3);
        const u = t.behavior === "hover" && t.truth === "drone" ? "Hovering / stationary" : Math.abs(t.vz) > 1.8 ? "Rapid altitude change" : turn > 0.25 ? "Sharp direction change" : t.behavior === "loiter" ? "Loitering pattern" : null;
        if (u && u !== t.unusual && t.detected) log(s, t.cls?.predicted === "drone" ? "MEDIUM" : "LOW", `${t.id}: ${u}`, t.id);
        t.unusual = u;

        // periodic classification from synthetic micro-Doppler
        if (t.detected && s.simTime - (s.lastCls[t.id] ?? -99) > 1.5) {
          s.lastCls[t.id] = s.simTime;
          const sig = synthSignal({ cls: t.truth, vr: radialVel(t.pos, velocity(t)), rotorHz: t.rotorHz, flapHz: t.flapHz, snrDb: t.snrDb, noise: s.noise }, s.simTime, 4096, Math.random);
          const spec = stft(sig, 128, 64);
          const f = extractFeatures(spec, { speed: t.speed, snrDb: t.snrDb, altitude: t.pos.z });
          const r2 = range2(t.pos);
          let fusion = 0;
          if (!s.failures.camera && r2 < 2000 && t.truth === "drone") fusion += 0.4;
          if (!s.failures.rf && r2 < 3000 && t.truth === "drone") fusion += 0.6;
          const c = classify(f, s.noise, s.epoch + s.simTime * 1000, fusion);
          if (t.cls && t.cls.predicted !== c.predicted) log(s, "INFO", `${t.id} reclassified: ${CLASS_LABEL[t.cls.predicted]} → ${CLASS_LABEL[c.predicted]}`, t.id);
          t.cls = c;
          s.history = [{ ...c, targetId: t.id, truth: t.truth }, ...s.history].slice(0, 200);
        }

        // zone monitoring
        const rz = range2(t.track?.pos ?? t.pos);
        const zone = !t.track ? "out" : rz < ZONE_RESTRICTED_M ? "restricted" : rz < ZONE_BUFFER_M ? "buffer" : "out";
        const pz = s.zoneState[t.id] ?? "out";
        if (zone !== pz) {
          if (zone === "restricted") log(s, priorityOf(t), `${t.id} ENTERED restricted zone (${(rz / 1000).toFixed(2)} km)`, t.id);
          else if (zone === "buffer" && pz === "out") log(s, priorityOf(t) === "HIGH" ? "HIGH" : "MEDIUM", `${t.id} entered buffer zone`, t.id);
          else if (pz === "restricted") log(s, "LOW", `${t.id} exited restricted zone`, t.id);
          s.zoneState[t.id] = zone;
        }
        return t;
      });

      const j = (v: number, a: number) => v + (Math.random() - 0.5) * a;
      s.sensor.radarTemp = Math.max(30, Math.min(70, j(s.sensor.radarTemp, 0.3) + (s.failures.radar ? -0.2 : 0.01)));
      s.sensor.latencyMs = s.failures.iot ? 0 : Math.max(10, j(s.sensor.latencyMs, 4) * 0.98 + 0.8);
      s.sensor.packetLoss = s.failures.iot ? 100 : Math.max(0, Math.min(5, j(s.sensor.packetLoss, 0.2) + s.noise * 0.02));
      s.sensor.battery = Math.max(5, s.sensor.battery - dt * 0.002);
      s.sensor.fps = s.failures.camera ? 0 : Math.round(j(29.5, 1.5));
      set(s);
    },
  };
});

export const nowMs = (s: Pick<SimState, "epoch" | "simTime">) => s.epoch + s.simTime * 1000;
export { FS };
