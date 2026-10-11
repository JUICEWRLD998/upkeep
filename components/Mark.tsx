/** The key glyph used as the wordmark: a mint bow and a flat blade with two teeth. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="10" cy="16" r="6.5" fill="none" stroke="var(--accent)" strokeWidth="3" />
      <path d="M16.5 16 H29 M24 16 V21 M29 16 V20" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
