// Trellis logo mark: a compact trellis lattice. Color rides currentColor.

import type { IconProps } from './icons/props.ts'

/**
 * Render the Trellis logo mark.
 * @param props.size - width in px (default 24; height keeps a 1:1 ratio).
 * @param props.className - extra class for layout placement.
 * @returns the logo svg (aria-hidden decorative mark).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 4L20 20" />
        <path d="M20 4L4 20" />
        <path d="M12 2V22" />
        <path d="M2 12H22" />
      </g>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  )
}
