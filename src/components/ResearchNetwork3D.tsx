import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { researchAreas } from "../data/research";
import { useControllableState } from "../lib/useControllableState";

/* Extends the same visual language as HeroScene3D's distributed compute
   network: a dense ambient node/pulse field for "this is a living system"
   atmosphere, with six larger glass/metal landmark nodes — one per real
   research area — layered on top as the actual interactive surface.
   Camera stays on-axis (default orientation already looks at the origin);
   drag-to-rotate is user-driven (OrbitControls), not automatic, so the
   label layout never rotates through an overlapping configuration —
   labels only render on the active node in the first place (see
   research-network-redesign.md). */

const LANDMARK_RADIUS = 3.0;
const AMBIENT_RADIUS = 3.8;

// Six hand-picked metallic hues, all within the site's warm gold/bronze
// family (per research-network-redesign.md) — never rainbow saturated
// colors, which would clash with the rest of the site's palette. Order
// matches data/research.ts (hpc, cloud, big-data, ai, aiot, smart-apps).
const NODE_COLORS = [
  "#d4af37", // liquid gold — High Performance Computing
  "#9c6b3f", // bronze — Cloud & Distributed Systems
  "#f3e1b8", // champagne — Big Data & Data Platforms
  "#b7695b", // rose gold — Artificial Intelligence
  "#cfc7b8", // warm platinum — AIoT & Edge Computing
  "#c9a24b", // champagne gold — Smart Applications
];

function brighten(hex: string, amount: number): string {
  return `#${new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), amount).getHexString()}`;
}

// Six points on the axes of an octahedron — evenly spread in real 3D space
// (not a flat circle foreshortened by perspective), so all six read at a
// readable size and the group looks intentional from any small tilt.
function landmarkPosition(i: number): THREE.Vector3 {
  const axes: [number, number, number][] = [
    [1, 0, 0], [-1, 0.3, 0], [0, 1, 0.2],
    [0, -1, -0.2], [0, 0.2, 1], [-0.3, -0.2, -1],
  ];
  const [x, y, z] = axes[i % axes.length];
  return new THREE.Vector3(x, y, z).normalize().multiplyScalar(LANDMARK_RADIUS);
}

function buildAmbientNetwork(nodeCount: number, neighbours: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const y = 1 - (i / (nodeCount - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push(
      new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring).multiplyScalar(AMBIENT_RADIUS)
    );
  }
  const seen = new Set<string>();
  const edges: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
  points.forEach((p, i) => {
    const ranked = points
      .map((q, j) => ({ j, d: p.distanceToSquared(q) }))
      .filter((e) => e.j !== i)
      .sort((m, n) => m.d - n.d)
      .slice(0, neighbours);
    ranked.forEach(({ j }) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ a: points[i], b: points[j] });
    });
  });
  return { points, edges };
}

function AmbientNetwork({ reduceMotion, busyRatio }: { reduceMotion: boolean; busyRatio: number | null }) {
  const { points, edges } = useMemo(() => buildAmbientNetwork(120, 3), []);
  // Real Prometheus data, not decoration: when the GPU fleet is actually
  // busy, the data pulses travel faster and the edges glow slightly
  // brighter. null (data not loaded yet, e.g. this sandbox can't reach the
  // lab's internal Prometheus) falls back to the original calm baseline.
  const speedMultiplier = busyRatio != null ? 0.6 + busyRatio * 1.4 : 1;
  const edgeOpacity = busyRatio != null ? 0.3 + busyRatio * 0.35 : 0.3;
  const nodePositions = useMemo(() => {
    const arr = new Float32Array(points.length * 3);
    points.forEach((p, i) => arr.set([p.x, p.y, p.z], i * 3));
    return arr;
  }, [points]);
  const edgePositions = useMemo(() => {
    const arr = new Float32Array(edges.length * 6);
    edges.forEach((e, i) => arr.set([e.a.x, e.a.y, e.a.z, e.b.x, e.b.y, e.b.z], i * 6));
    return arr;
  }, [edges]);

  const pulseRef = useRef<THREE.BufferAttribute>(null);
  const pulseCount = 64;
  const { pulsePositions, travellers } = useMemo(() => {
    const arr = new Float32Array(pulseCount * 3);
    const list = Array.from({ length: pulseCount }, (_, i) => ({
      edge: (i * 37) % Math.max(1, edges.length),
      t: ((i * 13) % 100) / 100,
      speed: 0.1 + ((i * 23) % 17) / 100,
    }));
    return { pulsePositions: arr, travellers: list };
  }, [edges.length]);

  useFrame((_, delta) => {
    const attr = pulseRef.current;
    if (!attr || !edges.length || reduceMotion) return;
    travellers.forEach((tr, i) => {
      tr.t += delta * tr.speed * speedMultiplier;
      if (tr.t > 1) {
        tr.t -= 1;
        tr.edge = (tr.edge + 11) % edges.length;
      }
      const { a, b } = edges[tr.edge];
      pulsePositions[i * 3] = a.x + (b.x - a.x) * tr.t;
      pulsePositions[i * 3 + 1] = a.y + (b.y - a.y) * tr.t;
      pulsePositions[i * 3 + 2] = a.z + (b.z - a.z) * tr.t;
    });
    attr.needsUpdate = true;
  });

  return (
    <>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={edges.length * 2} array={edgePositions} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#a78b71" transparent opacity={edgeOpacity} depthWrite={false} />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={points.length} array={nodePositions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.1} color="#c9b8a0" transparent opacity={0.8} sizeAttenuation depthWrite={false} />
      </points>
      <points>
        <bufferGeometry>
          <bufferAttribute ref={pulseRef} attach="attributes-position" count={pulseCount} array={pulsePositions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.14} color="#f0e6d2" transparent opacity={1} sizeAttenuation depthWrite={false} toneMapped={false} />
      </points>
    </>
  );
}

// Was a shiny glass/metal icosahedron (meshPhysicalMaterial) — read as an
// "ugly metal ball" rather than part of a neural network. Rebuilt as a
// bright core + soft glow, same flat-emissive language as the landmark
// nodes, plus a slowly rotating wireframe shell around it so it still
// reads as the network's central node, not a decorative sculpture.
function Hub() {
  const wireRef = useRef<THREE.LineSegments>(null);
  const shellGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.4, 1), []);
  useFrame((_, delta) => {
    if (wireRef.current) wireRef.current.rotation.y += delta * 0.12;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.15, 20, 20]} />
        <meshBasicMaterial color="#fdf3df" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshBasicMaterial color="#e8d5b7" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
      </mesh>
      <lineSegments ref={wireRef}>
        <edgesGeometry args={[shellGeometry]} />
        <lineBasicMaterial color="#c9b8a0" transparent opacity={0.55} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

/* Tiny autonomous probes orbit behind the research network. They are
   intentionally silhouette-scale — a moving glint and a short engine
   trail — so the scene feels inhabited without turning into a space game.
   Every path is deterministic, keeping hydration/screenshots stable. */
function FlyingProbe({
  index,
  reduceMotion,
}: {
  index: number;
  reduceMotion: boolean;
}) {
  const probeRef = useRef<THREE.Group>(null);
  const radius = 4.9 + (index % 3) * 0.65;
  const speed = 0.075 + (index % 4) * 0.018;
  const phase = index * 1.73;
  const height = -1.9 + (index % 5) * 0.82;
  const direction = index % 2 === 0 ? 1 : -1;

  useFrame(({ clock }) => {
    const probe = probeRef.current;
    if (!probe || reduceMotion) return;
    const t = clock.elapsedTime * speed * direction + phase;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius * 0.7 - 1.3;
    const y = height + Math.sin(t * 1.7 + phase) * 0.38;
    probe.position.set(x, y, z);
    // Point the nose along the next point on the orbit.
    const next = t + 0.025 * direction;
    probe.lookAt(
      Math.cos(next) * radius,
      height + Math.sin(next * 1.7 + phase) * 0.38,
      Math.sin(next) * radius * 0.7 - 1.3
    );
  });

  return (
    <group ref={probeRef} position={[Math.cos(phase) * radius, height, Math.sin(phase) * radius * 0.7 - 1.3]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.055, 0.25, 3]} />
        <meshBasicMaterial color="#e8d5b7" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.13]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.045, 0.38, 8]} />
        <meshBasicMaterial color="#b7695b" transparent opacity={0.42} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ProbeFleet({ reduceMotion }: { reduceMotion: boolean }) {
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  const count = mobile ? 2 : 6;
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <FlyingProbe key={index} index={index} reduceMotion={reduceMotion} />
      ))}
    </>
  );
}

function LandmarkNode({
  position,
  color,
  active,
  onEnter,
  onLeave,
  onSelect,
}: {
  position: THREE.Vector3;
  color: string;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  // Node identity (its color) never changes — hover only brightens/enlarges/
  // glows it more, so "what color is this node" stays unambiguous.
  const brightColor = useMemo(() => brighten(color, 0.45), [color]);
  useFrame((_, delta) => {
    const s = active ? 1.35 : 1;
    if (ref.current) ref.current.scale.lerp(new THREE.Vector3(s, s, s), Math.min(1, delta * 8));
    if (glowRef.current) {
      const gs = active ? 1.9 : 1.3;
      glowRef.current.scale.lerp(new THREE.Vector3(gs, gs, gs), Math.min(1, delta * 8));
    }
  });
  return (
    <group position={position}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.5 : 0.24} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onEnter();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onLeave();
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.19, 32, 32]} />
        {/* toneMapped={false} bypasses the Canvas's ACES tone mapping, which
            was compressing the emissive gold down to a muddy brown. */}
        <meshBasicMaterial color={active ? brightColor : color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({
  activeId,
  onActiveChange,
  reduceMotion,
  busyRatio,
  onSelect,
}: {
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  reduceMotion: boolean;
  busyRatio: number | null;
  onSelect?: (id: string) => void;
}) {
  // Fixed base tilt so the initial view is intentional; from there the
  // group keeps auto-rotating on its own — until the visitor hovers a node
  // (they're reading, don't spin it out from under them) or grabs it with
  // OrbitControls (their drag should be the only thing moving it while
  // it's in progress). Without the idle auto-rotate, a static scene with
  // OrbitControls looks like a picture, not something you can turn — the
  // constant motion is what tells you it's grabbable.
  const groupRef = useRef<THREE.Group>(null);
  const isDraggingRef = useRef(false);
  const baseRotation = useMemo(() => new THREE.Euler(0.32, 0.55, 0), []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || reduceMotion || isDraggingRef.current || activeId !== null) return;
    group.rotation.y += delta * 0.09;
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 4, 4]} intensity={35} color="#e8d5b7" />
      <pointLight position={[-4, -2, -3]} intensity={15} color="#a78b71" />
      <ProbeFleet reduceMotion={reduceMotion} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableDamping={!reduceMotion}
        dampingFactor={0.08}
        rotateSpeed={0.6}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.85}
        onStart={() => {
          isDraggingRef.current = true;
        }}
        onEnd={() => {
          isDraggingRef.current = false;
        }}
      />
      <group ref={groupRef} rotation={baseRotation}>
        <AmbientNetwork reduceMotion={reduceMotion} busyRatio={busyRatio} />
        <Hub />
        {researchAreas.map((area, i) => {
          const pos = landmarkPosition(i);
          const active = activeId === area.id;
          const color = NODE_COLORS[i % NODE_COLORS.length];
          return (
            <group key={area.id}>
              <Line
                points={[
                  [0, 0, 0],
                  [pos.x, pos.y, pos.z],
                ]}
                color={active ? brighten(color, 0.3) : "#5a4f42"}
                transparent
                opacity={active ? 0.85 : 0.3}
                lineWidth={1}
              />
              <LandmarkNode
                position={pos}
                color={color}
                active={active}
                onEnter={() => onActiveChange(area.id)}
                onLeave={() => onActiveChange(null)}
                onSelect={() => onSelect?.(area.id)}
              />
            </group>
          );
        })}
      </group>
    </>
  );
}

interface ResearchNetwork3DProps {
  /* Pass both to sync this scene with a sibling banner (see
     ResearchAreaBanner) — hovering a node updates the banner's content.
     Omit both to let the scene track its own hover state standalone. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  /* Real GPU fleet utilization (0–1, from /api/gpus via useLiveTelemetry)
     — drives the ambient network's pulse speed/brightness. Pass null (or
     omit) when live data isn't available; the scene falls back to a calm
     baseline rather than looking broken. */
  busyRatio?: number | null;
  onSelect?: (id: string) => void;
}

export function ResearchNetwork3D({ activeId: activeIdProp, onActiveChange, busyRatio = null, onSelect }: ResearchNetwork3DProps = {}) {
  const [activeId, setActiveId] = useControllableState(activeIdProp, onActiveChange, null as string | null);
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  return (
    <div className="research-network-canvas relative mx-auto aspect-square w-full sm:aspect-[4/3.4]">
      <Canvas
        /* Keep a deliberate safe frame around the outer network. At 9.6
           the 3.8-unit ambient sphere plus node glows touched the Canvas
           edge on narrow/tablet layouts and looked visibly cropped. */
        camera={{ position: [0, 0, 11.2], fov: 44 }}
        dpr={typeof window !== "undefined" && (window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches) ? 1 : [1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Scene activeId={activeId} onActiveChange={setActiveId} reduceMotion={reduceMotion} busyRatio={busyRatio} onSelect={onSelect} />
      </Canvas>
    </div>
  );
}
