import type {
  DocumentKind,
  LandPlot,
  PhaseStatus,
  PlotStatus,
  ProjectStatus,
} from '../../types'

const PHASE_STATUS_ROW_BG: Record<PhaseStatus, string> = {
  not_started: 'bg-slate-50/90 hover:bg-slate-100/80',
  in_progress: 'bg-sky-50 hover:bg-sky-100/75',
  done: 'bg-emerald-50 hover:bg-emerald-100/75',
}

/** Table row background by phase / task `status`. */
export function phaseTableRowClassName(status: PhaseStatus): string {
  return [
    'group border-b border-slate-100 transition-colors',
    PHASE_STATUS_ROW_BG[status] ?? PHASE_STATUS_ROW_BG.not_started,
  ].join(' ')
}

export const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'phases', label: 'Phases & tasks' },
  { id: 'plots', label: 'Plots' },
  { id: 'vendors', label: 'Vendors & billing' },
  { id: 'documents', label: 'Documents' },
  { id: 'reports', label: 'Reports' },
] as const

export type TabId = (typeof tabs)[number]['id']

export const projectStatusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
]

export const phaseStatusOptions: { value: PhaseStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

export const plotStatusOptions: { value: PlotStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'conditional_sale', label: 'Conditional sale' },
  { value: 'sold', label: 'Sold' },
]

export const docKindOptions: { value: DocumentKind; label: string }[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'payment_proof', label: 'Payment proof' },
  { value: 'progress_photo', label: 'Progress photo' },
  { value: 'other', label: 'Other' },
]

export function plotStatusLabel(status: PlotStatus): string {
  return plotStatusOptions.find((o) => o.value === status)?.label ?? status
}

const PLOT_STATUS_ROW_BG: Record<PlotStatus, string> = {
  open: 'bg-white hover:bg-slate-50/90',
  negotiating: 'bg-sky-50 hover:bg-sky-100/75',
  conditional_sale: 'bg-violet-50 hover:bg-violet-100/75',
  sold: 'bg-emerald-50 hover:bg-emerald-100/75',
}

/** Matches row tone for sticky Plot # cells (use with `group` on the table row). */
const PLOT_STATUS_STICKY_CELL_BG: Record<PlotStatus, string> = {
  open: 'bg-white group-hover:bg-slate-50/90',
  negotiating: 'bg-sky-50 group-hover:bg-sky-100/75',
  conditional_sale: 'bg-violet-50 group-hover:bg-violet-100/75',
  sold: 'bg-emerald-50 group-hover:bg-emerald-100/75',
}

/** Table row classes: background by `status`, amber left stripe when `isReserved`. */
export function plotTableRowClassName(p: Pick<LandPlot, 'status' | 'isReserved'>): string {
  return [
    'group border-b border-slate-100 transition-colors',
    PLOT_STATUS_ROW_BG[p.status] ?? PLOT_STATUS_ROW_BG.open,
  ].join(' ')
}

/** Sticky first column (row actions): fixed width — keep `left-[5.5rem]` on Plot # column in sync. */
export function plotTableStickyActionsCellClassName(): string {
  return [
    'sticky left-0 z-[6] w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem]',
    'px-2 py-3 text-left align-middle',
    'border-r border-slate-200/90 bg-white shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)]',
  ].join(' ')
}

/** Sticky second column (Plot #): opaque bg + shadow so scrolled content does not show through. */
export function plotTableStickyPlotNumberCellClassName(
  p: Pick<LandPlot, 'status' | 'isReserved'>,
): string {
  return [
    'sticky left-[5.5rem] z-[5] min-w-[7rem] px-4 py-3 font-medium text-slate-900',
    'border-r border-slate-200/90 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)]',
    PLOT_STATUS_STICKY_CELL_BG[p.status] ?? PLOT_STATUS_STICKY_CELL_BG.open,
    p.isReserved ? 'border-l-4 border-l-amber-500' : '',
  ]
    .filter(Boolean)
    .join(' ')
}
