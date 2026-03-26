import type { Account } from '../../types'
import { AccountFixedDepositsPanel } from './AccountFixedDepositsPanel'

export function AccountFixedDepositsModal({
  open,
  onClose,
  account,
  onError,
}: {
  open: boolean
  onClose: () => void
  account: Account
  onError: (msg: string | null) => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fd-modal-title"
    >
      <div className="flex max-h-[min(90vh,48rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <AccountFixedDepositsPanel
          account={account}
          onError={onError}
          active={open}
          showCloseInHeader
          onClose={onClose}
          headingId="fd-modal-title"
          scrollableBody
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        />
      </div>
    </div>
  )
}
