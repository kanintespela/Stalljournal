// Enkla linjeikoner (ersätter tidigare emoji) för bottennavigeringen.
// Stroke-baserade, currentColor, 24x24 viewBox.

type Props = { className?: string }
const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function AnimalIcon({ className }: Props) {
  return (
    <svg {...common} className={className} aria-hidden>
      <circle cx="12" cy="13" r="6" />
      <circle cx="7" cy="8" r="2.2" />
      <circle cx="17" cy="8" r="2.2" />
      <circle cx="9.5" cy="12.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function GroupIcon({ className }: Props) {
  return (
    <svg {...common} className={className} aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M14.8 14.2c2.4.2 4.2 2 4.2 4.8" />
    </svg>
  )
}

export function JournalIcon({ className }: Props) {
  return (
    <svg {...common} className={className} aria-hidden>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" />
    </svg>
  )
}

export function PlaceIcon({ className }: Props) {
  return (
    <svg {...common} className={className} aria-hidden>
      <path d="M12 21s-6.5-5.9-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.1-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  )
}

export function MoreIcon({ className }: Props) {
  return (
    <svg {...common} className={className} aria-hidden>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
