"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue
} from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

/**
 * Pointer and scroll effects for the Moss Atelier look. All of them:
 * - drive transforms through motion values (no React re-render per pointer move),
 * - only react to a fine pointer that can hover (no effect on touch screens),
 * - render their children untouched when the user prefers reduced motion.
 */

const SPRING = { stiffness: 260, damping: 30, mass: 0.6 };

/** True on devices with a mouse/trackpad; false on touch-only devices and during SSR. */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFine(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return fine;
}

function useEffectsEnabled(): boolean {
  const reduce = useReducedMotion() ?? false;
  const fine = useFinePointer();
  return fine && !reduce;
}

/** Card that tilts in 3D towards the pointer, with an optional soft glare. */
export function TiltCard({
  children,
  className,
  maxDeg = 6,
  glare = true
}: {
  children: ReactNode;
  className?: string;
  maxDeg?: number;
  glare?: boolean;
}) {
  const enabled = useEffectsEnabled();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [maxDeg, -maxDeg]), SPRING);
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxDeg, maxDeg]), SPRING);
  const glareX = useTransform(px, (value) => `${value * 100}%`);
  const glareY = useTransform(py, (value) => `${value * 100}%`);
  const glareBackground = useMotionTemplate`radial-gradient(420px circle at ${glareX} ${glareY}, rgba(255,255,255,0.55), transparent 60%)`;

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width);
    py.set((event.clientY - rect.top) / rect.height);
  };
  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <div style={{ perspective: 900 }} className="h-full">
      <motion.div
        className={`relative h-full ${className ?? ""}`}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {children}
        {glare ? (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 mix-blend-soft-light transition-opacity duration-300 [div:hover>&]:opacity-100"
            style={{ background: glareBackground }}
          />
        ) : null}
      </motion.div>
    </div>
  );
}

/** Wrapper whose radial highlight and hairline border follow the pointer (styles: `.spotlight` in globals.css). */
export function Spotlight({ children, className }: { children: ReactNode; className?: string }) {
  const enabled = useEffectsEnabled();
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    element.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      className={`${enabled ? "spotlight" : ""} ${className ?? ""}`}
      onPointerMove={enabled ? onMove : undefined}
    >
      {children}
    </div>
  );
}

/** CTA wrapper that leans towards the pointer (max `strength` px) and springs back. */
export function Magnetic({ children, className, strength = 8 }: { children: ReactNode; className?: string; strength?: number }) {
  const enabled = useEffectsEnabled();
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);

  if (!enabled) {
    return <span className={`inline-flex ${className ?? ""}`}>{children}</span>;
  }

  const onMove = (event: PointerEvent<HTMLSpanElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    x.set(Math.max(-1, Math.min(1, dx)) * strength);
    y.set(Math.max(-1, Math.min(1, dy)) * strength);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span className={`inline-flex ${className ?? ""}`} style={{ x, y }} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </motion.span>
  );
}

/** Children drift vertically while the section scrolls through the viewport. */
export function Parallax({ children, className, distance = 24 }: { children: ReactNode; className?: string; distance?: number }) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y: MotionValue<number> = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : { y }}>
      {children}
    </motion.div>
  );
}

/** 2px moss progress bar fixed to the top of the page. */
export function ScrollProgress({ className, style }: { className?: string; style?: CSSProperties }) {
  const reduce = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-[var(--accent)] ${className ?? ""}`}
      style={{ ...style, scaleX: reduce ? scrollYProgress : scaleX }}
    />
  );
}
