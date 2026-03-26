export function TrashIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 3h6m-8 4h10m-9 0v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7m-7 4v8m4-8v8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CopyIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="8"
        y="8"
        width="12"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PencilIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function iconBtnClass(tone: 'neutral' | 'danger' = 'neutral') {
  const base =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-teal-500/40'
  return tone === 'danger'
    ? `${base} text-red-700 hover:bg-red-50`
    : `${base} text-slate-700 hover:bg-slate-100`
}
