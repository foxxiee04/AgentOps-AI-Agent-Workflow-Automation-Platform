"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, QuadraticBezierLine, RoundedBox } from "@react-three/drei";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Group } from "three";

/**
 * WebGL hero sculpture: four moss "workflow nodes" (trigger, AI agent, approval, task) joined by
 * thin moss lines, floating and slowly turning, leaning towards the pointer. The AI node carries a
 * glowing lime core (the live step). Loaded with next/dynamic (ssr: false) from the hero, so three.js
 * never reaches the server bundle; the hero shows the HTML workflow object until this is ready and
 * keeps it for reduced motion or missing WebGL.
 */

type NodeSpec = {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  speed: number;
  live?: boolean;
};

const NODES: NodeSpec[] = [
  { key: "trigger", position: [-1.7, 1.05, -0.2], size: [1.15, 0.62, 0.62], color: "#C9D6C6", speed: 1.1 },
  { key: "agent", position: [0.15, 0.35, 0.55], size: [1.35, 0.78, 0.78], color: "#2F5D3A", speed: 1.4, live: true },
  { key: "approval", position: [1.65, -0.45, -0.25], size: [1.1, 0.6, 0.6], color: "#7FA37F", speed: 1.2 },
  { key: "task", position: [-0.55, -1.35, 0.25], size: [1.05, 0.58, 0.58], color: "#E9E6DC", speed: 1 }
];

const LINKS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [1, 3],
  [2, 3]
];

function Node({ spec }: { spec: NodeSpec }) {
  return (
    <Float speed={spec.speed} rotationIntensity={0.35} floatIntensity={0.6} floatingRange={[-0.08, 0.08]}>
      <group position={spec.position}>
        <RoundedBox args={spec.size} radius={0.2} smoothness={5}>
          <meshPhysicalMaterial
            color={spec.color}
            roughness={0.78}
            metalness={0}
            clearcoat={0.18}
            clearcoatRoughness={0.6}
            sheen={0.6}
            sheenRoughness={0.8}
            sheenColor="#C6F35C"
          />
        </RoundedBox>
        {spec.live ? (
          <>
            <mesh position={[spec.size[0] / 2 - 0.22, spec.size[1] / 2 - 0.16, spec.size[2] / 2 + 0.01]}>
              <sphereGeometry args={[0.075, 24, 24]} />
              <meshStandardMaterial color="#C6F35C" emissive="#C6F35C" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
            <pointLight position={[0, 0, 0.9]} color="#C6F35C" intensity={1.6} distance={2.6} />
          </>
        ) : null}
      </group>
    </Float>
  );
}

function Sculpture() {
  const group = useRef<Group>(null);

  useFrame((state, delta) => {
    const node = group.current;
    if (!node) {
      return;
    }
    // Slow turn plus a gentle lean towards the pointer (state.pointer is -1..1).
    node.rotation.y += delta * 0.06;
    const targetX = -state.pointer.y * 0.14;
    const targetZ = state.pointer.x * 0.06;
    node.rotation.x += (targetX - node.rotation.x) * Math.min(1, delta * 3);
    node.rotation.z += (targetZ - node.rotation.z) * Math.min(1, delta * 3);
  });

  return (
    <group ref={group}>
      {LINKS.map(([from, to]) => {
        const start = NODES[from]!.position;
        const end = NODES[to]!.position;
        const mid: [number, number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + 0.35, (start[2] + end[2]) / 2 + 0.3];
        return <QuadraticBezierLine key={`${from}-${to}`} start={start} end={end} mid={mid} color="#2F5D3A" lineWidth={1.4} transparent opacity={0.55} />;
      })}
      {NODES.map((spec) => (
        <Node key={spec.key} spec={spec} />
      ))}
    </group>
  );
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function HeroSculpture({ fallback, className }: { fallback: ReactNode; className?: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    setWebgl(supportsWebGL());
  }, []);

  // Stop rendering frames while the hero is scrolled out of view.
  useEffect(() => {
    const element = wrapper.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (webgl === false) {
    return <>{fallback}</>;
  }

  return (
    <div ref={wrapper} className={className} aria-hidden="true">
      {webgl ? (
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [0, 0, 8.2], fov: 38 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          frameloop={visible ? "always" : "never"}
        >
          <ambientLight intensity={0.55} />
          <hemisphereLight args={["#ffffff", "#C9D6C6", 0.7]} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} />
          <directionalLight position={[-4, -2, -3]} intensity={0.35} color="#C6F35C" />
          <Sculpture />
          <ContactShadows position={[0, -2.15, 0]} opacity={0.28} scale={9} blur={2.6} far={4.2} color="#0F1A14" />
        </Canvas>
      ) : null}
    </div>
  );
}
