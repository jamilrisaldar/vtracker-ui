import type { LandPlot } from '../types'

/** Displayable square feet: override, or irregular (W1×L1 + W2×L2), or primary W×L. */
export function plotEffectiveSqFt(p: LandPlot): number | null {
  if (p.totalSquareFeetOverride != null && !Number.isNaN(p.totalSquareFeetOverride)) {
    return p.totalSquareFeetOverride
  }
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
      w1 > 0 &&
      l1 > 0 &&
      w2 > 0 &&
      l2 > 0
    ) {
      return w1 * l1 + w2 * l2
    }
    return null
  }
  const w = p.widthFeet
  const l = p.lengthFeet
  if (w != null && l != null && w > 0 && l > 0) return w * l
  return null
}

export function plotDimensionsLabel(p: LandPlot): string {
  if (p.isIrregular) {
    const w1 = p.widthFeet
    const l1 = p.lengthFeet
    const w2 = p.widthFeet2
    const l2 = p.lengthFeet2
    if (w1 != null && l1 != null && w2 != null && l2 != null) {
      return `${w1}×${l1} + ${w2}×${l2} (irr.)`
    }
    return '—'
  }
  if (p.widthFeet != null && p.lengthFeet != null) {
    return `${p.widthFeet} × ${p.lengthFeet}`
  }
  return '—'
}
