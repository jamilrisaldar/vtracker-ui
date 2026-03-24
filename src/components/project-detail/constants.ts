import type { DocumentKind, PhaseStatus, PlotStatus, ProjectStatus } from '../../types'

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
