type BrandMarkProps = {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span
      className={`brand-mark${compact ? ' brand-mark-compact' : ''}`}
      aria-hidden="true"
    >
      <span>ORO</span>
    </span>
  )
}
