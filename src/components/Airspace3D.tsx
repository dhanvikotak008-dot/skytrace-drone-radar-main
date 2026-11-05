import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Line, OrbitControls, Text } from "@react-three/drei";
import { useSim } from "@/sim/store";
import { DISPLAY_RANGE_M, ZONE_BUFFER_M, ZONE_RESTRICTED_M, predictPath } from "@/sim/model";
import { CLASS_TOKEN, cssVar } from "./hud";

const S = 1 / 100; // 1 unit = 100 m
const ALT = 3; // altitude exaggeration
const toV = (p: { x: number; y: number; z: number }): [number, number, number] => [p.x * S, p.z * S * ALT, -p.y * S];

function Targets() {
  const targets = useSim((s) => s.targets);
  const selectedId = useSim((s) => s.selectedId);
  const select = useSim((s) => s.select);
  return (
    <>
      {targets.map((t) => {
        if (!t.track) return null;
        const col = cssVar(CLASS_TOKEN[t.cls?.predicted ?? "unknown"]);
        const p = toV(t.track.pos);
        const hist = [...t.track.history.map(toV), p];
        const pred = [p, ...predictPath(t.track).map(toV)];
        const sel = selectedId === t.id;
        return (
          <group key={t.id}>
            <mesh position={p} onClick={(e) => { e.stopPropagation(); select(t.id); }}>
              <sphereGeometry args={[sel ? 0.9 : 0.6, 16, 16]} />
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.8} />
            </mesh>
            <mesh position={p}><sphereGeometry args={[Math.max(0.8, t.track.sigma * S * 2), 12, 12]} /><meshBasicMaterial color={col} transparent opacity={0.12} /></mesh>
            <Line points={[p, [p[0], 0, p[2]]]} color={col} transparent opacity={0.3} lineWidth={1} />
            {hist.length > 1 && <Line points={hist} color={col} lineWidth={2} />}
            <Line points={pred} color={col} lineWidth={1.5} dashed dashSize={0.8} gapSize={0.6} />
            <Text position={[p[0], p[1] + 2, p[2]]} fontSize={1.4} color={sel ? cssVar("cyan") : col}>{t.id}</Text>
          </group>
        );
      })}
    </>
  );
}

export default function Airspace3D() {
  const R = DISPLAY_RANGE_M * S;
  return (
    <Canvas camera={{ position: [60, 55, 80], fov: 45 }} style={{ height: 480 }} data-scene-ready>
      <color attach="background" args={[cssVar("background")]} />
      <fog attach="fog" args={[cssVar("background"), 120, 260]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[30, 60, 20]} intensity={1} />
      <Environment><Lightformer intensity={1.5} position={[0, 20, 0]} scale={[40, 40, 1]} /></Environment>
      <gridHelper args={[R * 2, 32, cssVar("radar"), cssVar("border")]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]}><circleGeometry args={[R, 64]} /><meshStandardMaterial color={cssVar("card")} /></mesh>
      <mesh position={[0, 8, 0]}><cylinderGeometry args={[ZONE_RESTRICTED_M * S, ZONE_RESTRICTED_M * S, 16, 48, 1, true]} /><meshBasicMaterial color={cssVar("danger")} transparent opacity={0.12} side={2} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><ringGeometry args={[ZONE_BUFFER_M * S - 0.2, ZONE_BUFFER_M * S, 64]} /><meshBasicMaterial color={cssVar("warn")} /></mesh>
      <mesh position={[0, 1, 0]}><sphereGeometry args={[1.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={cssVar("cyan")} metalness={0.6} roughness={0.3} /></mesh>
      <Text position={[0, 0.1, -R - 3]} rotation-x={-Math.PI / 2} fontSize={3} color={cssVar("radar")}>N</Text>
      <Targets />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  );
}
