// Trellis brand wordmark: a simple trellis grid glyph plus the TRELLIS name.
// Color rides currentColor so it adapts to light and dark themes.

import type { IconProps } from './icons/props.ts'

/**
 * Render the Trellis brand wordmark.
 * @param props.size - height in px (default 24; width keeps a 5:1 ratio).
 * @param props.className - extra class for layout placement.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size * 5}
      height={size}
      className={className}
      viewBox="0 0 120 24"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M8 4V20" />
        <path d="M16 4V20" />
        <path d="M4 8H20" />
        <path d="M4 12H20" />
        <path d="M4 16H20" />
      </g>
      <text
        x="28"
        y="17"
        fill="currentColor"
        fontSize="15"
        fontWeight="700"
        letterSpacing="2.5"
        style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
      >
        TRELLIS
      </text>
    </svg>
  )
}
