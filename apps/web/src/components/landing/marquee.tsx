import { landingCopy, type Locale } from "../../lib/i18n";

/**
 * Mono proof strip: a slow marquee of node types / integrations.
 * Pure CSS animation — pauses on hover, fully off for reduced motion.
 */
export function Marquee({ locale }: { locale: Locale }) {
  const t = landingCopy[locale];
  const items = t.moss.marquee;

  return (
    <section aria-label={t.stackLabel} className="border-y border-[var(--hairline)] py-6">
      <div className="group/marquee relative overflow-hidden">
        <style>{`@keyframes moss-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
        <div className="flex w-max items-center [animation:moss-marquee_36s_linear_infinite] group-hover/marquee:[animation-play-state:paused] motion-reduce:[animation:none]">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              aria-hidden={copy === 1 ? "true" : undefined}
              className="flex shrink-0 items-center"
            >
              {items.map((item) => (
                <li key={`${copy}-${item}`} className="flex items-center">
                  <span className="mono-label px-6">{item}</span>
                  <span aria-hidden="true" className="text-[var(--accent)]">
                    ·
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[linear-gradient(to_right,var(--canvas),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-[linear-gradient(to_left,var(--canvas),transparent)]"
        />
      </div>
    </section>
  );
}
