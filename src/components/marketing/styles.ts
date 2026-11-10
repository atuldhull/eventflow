/**
 * Class strings shared by the public marketing pages (pricing, organizers, about,
 * contact, developers, profiles, legal). Plain strings, so server pages can use them.
 */

/** Lemon fill call to action; charcoal on lemon in both themes. */
export const ctaLemon =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lemon px-6 text-[15px] font-semibold text-lemon-ink transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_var(--lemon)] active:translate-y-0 active:scale-[0.98]"

/** Outline call to action that follows the theme. */
export const ctaGhost =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-foreground/15 px-6 text-[15px] font-medium transition-colors duration-300 hover:border-lavender hover:bg-lavender/10"

/** Outline call to action on an always-dark (charcoal) field. */
export const ctaGhostDark =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-6 text-[15px] font-medium text-white transition-colors duration-300 hover:border-lavender hover:bg-lavender/15"

/** Charcoal call to action on a lemon or lavender field. */
export const ctaInk =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-charcoal px-7 text-[15px] font-semibold text-lemon transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.98]"

/** The big display headline of a public page. */
export const heroTitle = "font-display text-[40px] leading-[1.02] font-extrabold tracking-[-0.045em] text-balance sm:text-[60px] lg:text-[72px]"

/** A section headline. */
export const sectionTitle = "font-display text-[32px] leading-[1.02] font-extrabold tracking-[-0.04em] text-balance sm:text-[48px]"
