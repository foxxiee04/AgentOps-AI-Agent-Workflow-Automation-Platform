Icons in this folder are copied from https://github.com/itshover/itshover (Apache-2.0, see LICENSE).
They import from "motion/react" and expose startAnimation/stopAnimation through a ref (see types.ts).
Local change: the icons no longer start themselves on hover/tap. Animation is driven by the parent button or link through `useIconHover` (apps/web/src/components/motion/use-icon-hover.ts), which also respects prefers-reduced-motion.
