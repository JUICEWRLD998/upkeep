/** The envelope glyph used as the wordmark and favicon source: kraft body, flap line, a mint corner. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="2" y="6" width="28" height="20" rx="4" fill="var(--kraft-deep)" stroke="var(--kraft)" strokeWidth="2" />
      <path d="M3 8 L16 18 L29 8" fill="none" stroke="var(--kraft)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="25" cy="22" r="3.2" fill="var(--accent)" />
    </svg>
  )
}
