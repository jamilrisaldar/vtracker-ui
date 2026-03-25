import type { LandPlot } from '../types'

function toFiniteNumber(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return undefined
  return n
}

function dimFt(v: unknown): number | undefined {
  const n = toFiniteNumber(v)
  if (n === undefined || n <= 0) return undefined
  return n
}

/** Consecutive sides W1→L1→W2→L2 (feet); Brahmagupta cyclic quadrilateral (matches server). */
function areaCyclicQuadrilateralFourSides(a: number, b: number, c: number, d: number): number | null {
  if (!(a > 0 && b > 0 && c > 0 && d > 0)) return null
  const s = (a + b + c + d) / 2
  const inner = (s - a) * (s - b) * (s - c) * (s - d)
  if (!(inner > 0) || !Number.isFinite(inner)) return null
  return Math.sqrt(inner)
}

/** Area from dimensions only (matches server `calculatedSquareFeet` formula). */
export function plotCalculatedSqFtFromDimensions(p: {
  isIrregular: boolean
  widthFeet?: number
  lengthFeet?: number
  widthFeet2?: number
  lengthFeet2?: number
}): number | null {
  if (p.isIrregular) {
    const w1 = dimFt(p.widthFeet)
    const l1 = dimFt(p.lengthFeet)
    const w2 = dimFt(p.widthFeet2)
    const l2 = dimFt(p.lengthFeet2)
    if (w1 != null && l1 != null && w2 != null && l2 != null) {
      return areaCyclicQuadrilateralFourSides(w1, l1, w2, l2)
    }
    return null
  }
  const w = dimFt(p.widthFeet)
  const l = dimFt(p.lengthFeet)
  if (w != null && l != null) return w * l
  return null
}

/**
 * Displayable square feet: meaningful override (> 0), then stored calculated (> 0),
 * then live compute from dims. Values of 0 are ignored so bad/migrated data still recomputes.
 */
export function plotEffectiveSqFt(p: LandPlot): number | null {
  const override = toFiniteNumber(p.totalSquareFeetOverride)
  if (override != null && override > 0) {
    return override
  }
  const stored = toFiniteNumber(p.calculatedSquareFeet)
  if (stored != null && stored > 0) {
    return stored
  }
  return plotCalculatedSqFtFromDimensions(p)
}

export function plotDimensionsLabel(p: LandPlot): string {
  if (p.isIrregular) {
    const w1 = p.widthFeet
    const l1 = p.lengthFeet
    const w2 = p.widthFeet2
    const l2 = p.lengthFeet2
    if (
      w1 != null &&
      l1 != null &&
      w2 != null &&
      l2 != null &&
      dimFt(w1) != null &&
      dimFt(l1) != null &&
      dimFt(w2) != null &&
      dimFt(l2) != null
    ) {
      return `${w1} → ${l1} → ${w2} → ${l2} ft (irr.)`
    }
    return '—'
  }
  if (p.widthFeet != null && p.lengthFeet != null) {
    return `${p.widthFeet} × ${p.lengthFeet}`
  }
  return '—'
}
