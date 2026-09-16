// Shared glass-style constants for the Kanban board list and board detail
// pages (GitHub issue #17), settled via live iteration against a design
// mockup - see the settled-values comment on mcfx-urs/urs-web#17 for the
// full history. Fixed hex/rgba values, not theme tokens - deliberately the
// same regardless of light/dark theme.

/** Diagonal background behind the whole page: quick green-to-black transition, then holds solid black. */
export const KANBAN_BACKGROUND_GRADIENT_CLASS = '[background:linear-gradient(120deg,#1E5318_0%,#12310E_20%,#000000_60%)]'

/** Column/board-card surface: near-invisible fill, thin light rim, soft inset glow - no backdrop blur. */
export const KANBAN_GLASS_CARD_CLASS = 'border border-[#C0BFBC]/35 bg-black/5 shadow-[inset_0_0_33px_rgba(192,191,188,0.35)]'
