import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* The scene is a distributed compute network, not an abstract sculpture:
   nodes are compute units, lines are the interconnect, and pulses are data
   moving across it. That maps directly onto what the lab actually studies
   (HPC / distributed systems / data / AI) instead of leaving the viewer
   asking what the object is meant to be. */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface NetworkGeometry {
  nodes: Float32Array;
  edges: Float32Array;
  edgePairs: { a: THREE.Vector3; b: THREE.Vector3 }[];
}

/* Nodes are spread over a sphere via the Fibonacci lattice (even coverage,
   no clustering at the poles), then linked to their nearest neighbours. */
function buildNetwork(nodeCount: number, neighbours: number): NetworkGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const y = 1 - (i / (nodeCount - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    const jitter = 0.88 + ((i * 37) % 17) / 70;
    const r = 2.6 * jitter;
    points.push(new THREE.Vector3(Math.cos(theta) * ring * r, y * r, Math.sin(theta) * ring * r));
  }

  const seen = new Set<string>();
  const edgePairs: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
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
      edgePairs.push({ a: points[i], b: points[j] });
    });
  });

  const nodes = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    nodes[i * 3] = p.x;
    nodes[i * 3 + 1] = p.y;
    nodes[i * 3 + 2] = p.z;
  });

  const edges = new Float32Array(edgePairs.length * 6);
  edgePairs.forEach((e, i) => {
    edges[i * 6] = e.a.x;
    edges[i * 6 + 1] = e.a.y;
    edges[i * 6 + 2] = e.a.z;
    edges[i * 6 + 3] = e.b.x;
    edges[i * 6 + 4] = e.b.y;
    edges[i * 6 + 5] = e.b.z;
  });

  return { nodes, edges, edgePairs };
}

/* Points that travel along the interconnect — the "data" in the system. */
function DataPulses({ edgePairs, count }: { edgePairs: NetworkGeometry["edgePairs"]; count: number }) {
  const attrRef = useRef<THREE.BufferAttribute>(null);
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const { positions, travellers } = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const list = Array.from({ length: count }, (_, i) => ({
      edge: (i * 7919) % Math.max(1, edgePairs.length),
      t: ((i * 13) % 100) / 100,
      speed: 0.12 + ((i * 31) % 23) / 120,
    }));
    return { positions: arr, travellers: list };
  }, [count, edgePairs.length]);

  useFrame((_, delta) => {
    const attr = attrRef.current;
    if (!attr || !edgePairs.length) return;
    travellers.forEach((tr, i) => {
      if (!reduceMotion) {
        tr.t += delta * tr.speed;
        if (tr.t > 1) {
          tr.t -= 1;
          tr.edge = (tr.edge + 17) % edgePairs.length;
        }
      }
      const { a, b } = edgePairs[tr.edge];
      positions[i * 3] = a.x + (b.x - a.x) * tr.t;
      positions[i * 3 + 1] = a.y + (b.y - a.y) * tr.t;
      positions[i * 3 + 2] = a.z + (b.z - a.z) * tr.t;
    });
    attr.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute ref={attrRef} attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.075} color="#e8d5b7" transparent opacity={0.95} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function ComputeNetwork({ nodeCount, neighbours, pulseCount }: { nodeCount: number; neighbours: number; pulseCount: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const network = useMemo(() => buildNetwork(nodeCount, neighbours), [nodeCount, neighbours]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    if (reduceMotion) return;
    group.rotation.y += delta * 0.07;
    const targetX = state.pointer.y * 0.22;
    const targetZ = state.pointer.x * 0.12;
    group.rotation.x += (targetX - group.rotation.x) * 0.03;
    group.rotation.z += (targetZ - group.rotation.z) * 0.03;
  });

  return (
    <group ref={groupRef}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={network.edges.length / 3}
            array={network.edges}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#a78b71" transparent opacity={0.28} depthWrite={false} />
      </lineSegments>

      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={network.nodes.length / 3}
            array={network.nodes}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.13} color="#c9b8a0" transparent opacity={0.9} sizeAttenuation depthWrite={false} />
      </points>

      <DataPulses edgePairs={network.edgePairs} count={pulseCount} />
    </group>
  );
}

/* Ambient dust well outside the network, for depth. */
function DepthField({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (pointsRef.current && !reduceMotion) {
      pointsRef.current.rotation.y += delta * 0.012;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#c9b8a0" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Scene({ quality }: { quality: "high" | "low" }) {
  const high = quality === "high";
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={35} color="#e8d5b7" />
      <ComputeNetwork
        nodeCount={high ? 90 : 40}
        neighbours={high ? 3 : 2}
        pulseCount={high ? 70 : 24}
      />
      <DepthField count={high ? 1200 : 400} />
    </>
  );
}

/* Public entry point. Caps DPR and scene complexity on coarse-pointer
   (touch) devices, and stops the render loop entirely when the tab is
   hidden — a WebGL context left spinning in a background tab is pure
   wasted GPU/battery. */
export function HeroScene3D() {
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768) {
      setQuality("low");
    }
    const onVisibility = () => setRunning(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <Canvas
      dpr={quality === "high" ? [1, 2] : [1, 1]}
      camera={{ position: [0, 0, 7], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={running ? "always" : "never"}
      className="absolute inset-0"
    >
      <Scene quality={quality} />
    </Canvas>
  );
}
