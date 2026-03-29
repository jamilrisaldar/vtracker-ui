import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../../api/dataApi'
import type { GeneralLedgerEntry, GlAccount, GlCategory, GlSubcategory } from '../../types'
import { formatDate, formatMoney } from '../../utils/format'

const iconBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

function CopyDuplicateIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

type GlSidePanel =
  | null
  | { instanceId: string; kind: 'category'; mode: 'create' | 'edit'; row?: GlCategory }
  | { instanceId: string; kind: 'subcategory'; mode: 'create' | 'edit'; row?: GlSubcategory }
  | { instanceId: string; kind: 'account'; mode: 'create' | 'edit'; row?: GlAccount }

const GL_EPS = 0.01

function newGlPanelInstance(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
}

type MjLine = {
  key: string
  glAccountId: string
  debitStr: string
  creditStr: string
  memoStr: string
}

function trimGlCode(s: string, max = 32) {
  const t = s.trim()
  return t.length <= max ? t : t.slice(0, max)
}

export function GlTab({
  projectId,
  onError,
  readOnly = false,
  canEditGlChart = false,
}: {
  projectId: string
  onError: (msg: string | null) => void
  readOnly?: boolean
  /** Only Administrators may change GL categories, subcategories, and accounts (API-enforced). */
  canEditGlChart?: boolean
}) {
  const allowChartEdits = canEditGlChart && !readOnly
  const allowLedgerEdits = !readOnly

  const [categories, setCategories] = useState<GlCategory[]>([])
  const [subcategories, setSubcategories] = useState<GlSubcategory[]>([])
  const [accounts, setAccounts] = useState<GlAccount[]>([])
  const [glEntries, setGlEntries] = useState<GeneralLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [glLoading, setGlLoading] = useState(false)
  const [glStart, setGlStart] = useState('')
  const [glEnd, setGlEnd] = useState('')
  const [panel, setPanel] = useState<GlSidePanel>(null)
  const [saving, setSaving] = useState(false)
  const [topTab, setTopTab] = useState<'chart' | 'ledger'>('chart')
  const [mjDate, setMjDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mjLines, setMjLines] = useState<MjLine[]>(() => [
    { key: newGlPanelInstance(), glAccountId: '', debitStr: '', creditStr: '', memoStr: '' },
    { key: newGlPanelInstance(), glAccountId: '', debitStr: '', creditStr: '', memoStr: '' },
  ])
  const [mjSaving, setMjSaving] = useState(false)
  const [manualJournalPanelOpen, setManualJournalPanelOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null)

  const [catCode, setCatCode] = useState('')
  const [catName, setCatName] = useState('')
  const [catSort, setCatSort] = useState('0')

  const [subCatId, setSubCatId] = useState('')
  const [subCode, setSubCode] = useState('')
  const [subName, setSubName] = useState('')
  const [subSort, setSubSort] = useState('0')

  const [accCat, setAccCat] = useState('')
  const [accSub, setAccSub] = useState('')
  const [accCode, setAccCode] = useState('')
  const [accName, setAccName] = useState('')
  const [accActive, setAccActive] = useState(true)

  const reloadMasters = useCallback(async () => {
    onError(null)
    try {
      const [c, s, a] = await Promise.all([
        api.listGlCategories(),
        api.listGlSubcategories(),
        api.listGlAccounts({ includeInactive: true }),
      ])
      setCategories(c)
      setSubcategories(s)
      setAccounts(a)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not load GL master data.')
    }
  }, [onError])

  const reloadAll = useCallback(async () => {
    setLoading(true)
    await reloadMasters()
    setLoading(false)
  }, [reloadMasters])

  useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  const loadGl = useCallback(async () => {
    setGlLoading(true)
    onError(null)
    try {
      const rows = await api.listGeneralLedgerEntries(projectId, {
        startDate: glStart || undefined,
        endDate: glEnd || undefined,
      })
      setGlEntries(rows)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not load ledger.')
    } finally {
      setGlLoading(false)
    }
  }, [projectId, glStart, glEnd, onError])

  useEffect(() => {
    if (topTab !== 'ledger') return
    void loadGl()
  }, [topTab, loadGl])

  useEffect(() => {
    const m: Record<string, string> = {}
    for (const e of glEntries) {
      m[e.id] = e.userNotes ?? ''
    }
    setNoteDraft(m)
  }, [glEntries])

  useEffect(() => {
    if (!panel) return
    if (panel.kind === 'category') {
      if (panel.mode === 'edit' && panel.row) {
        setCatCode(panel.row.code)
        setCatName(panel.row.name)
        setCatSort(String(panel.row.sortOrder))
      } else if (panel.mode === 'create' && panel.row) {
        setCatCode(panel.row.code)
        setCatName(panel.row.name)
        setCatSort(String(panel.row.sortOrder))
      } else {
        setCatCode('')
        setCatName('')
        setCatSort('100')
      }
    }
    if (panel.kind === 'subcategory') {
      if (panel.mode === 'edit' && panel.row) {
        setSubCatId(panel.row.glCategoryId)
        setSubCode(panel.row.code)
        setSubName(panel.row.name)
        setSubSort(String(panel.row.sortOrder))
      } else if (panel.mode === 'create' && panel.row) {
        setSubCatId(panel.row.glCategoryId)
        setSubCode(panel.row.code)
        setSubName(panel.row.name)
        setSubSort(String(panel.row.sortOrder))
      } else {
        setSubCatId(categories[0]?.id ?? '')
        setSubCode('')
        setSubName('')
        setSubSort('10')
      }
    }
    if (panel.kind === 'account') {
      if (panel.mode === 'edit' && panel.row) {
        setAccCat(panel.row.glCategoryId)
        setAccSub(panel.row.glSubcategoryId ?? '')
        setAccCode(panel.row.code)
        setAccName(panel.row.name)
        setAccActive(panel.row.isActive !== false)
      } else if (panel.mode === 'create' && panel.row) {
        setAccCat(panel.row.glCategoryId)
        setAccSub(panel.row.glSubcategoryId ?? '')
        setAccCode(trimGlCode(`${panel.row.code}-COPY`))
        setAccName(panel.row.name)
        setAccActive(true)
      } else {
        setAccCat(categories[0]?.id ?? '')
        setAccSub('')
        setAccCode('')
        setAccName('')
        setAccActive(true)
      }
    }
  }, [panel])

  const closePanel = () => setPanel(null)

  const displayGlEntries = useMemo(() => {
    return [...glEntries].sort((a, b) => {
      const dc = b.entryDate.localeCompare(a.entryDate)
      if (dc !== 0) return dc
      const sc = (a.sourceId ?? '').localeCompare(b.sourceId ?? '')
      if (sc !== 0) return sc
      return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    })
  }, [glEntries])

  const manualJournalDeleteAnchorIds = useMemo(() => {
    const seen = new Set<string>()
    const anchors = new Set<string>()
    for (const r of displayGlEntries) {
      if (!r.isManual) continue
      if (seen.has(r.sourceId)) continue
      seen.add(r.sourceId)
      anchors.add(r.id)
    }
    return anchors
  }, [displayGlEntries])

  const activeGlAccounts = useMemo(
    () => accounts.filter((a) => a.isActive !== false).sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')),
    [accounts],
  )

  const mjTotals = useMemo(() => {
    let dr = 0
    let cr = 0
    for (const l of mjLines) {
      const d = parseFloat(l.debitStr) || 0
      const c = parseFloat(l.creditStr) || 0
      if (d > GL_EPS) dr += d
      if (c > GL_EPS) cr += c
    }
    return { dr, cr, diff: dr - cr }
  }, [mjLines])

  const addMjLine = () => {
    setMjLines((prev) => [
      ...prev,
      { key: newGlPanelInstance(), glAccountId: '', debitStr: '', creditStr: '', memoStr: '' },
    ])
  }

  const removeMjLine = (key: string) => {
    setMjLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.key !== key)))
  }

  const updateMjLine = (key: string, patch: Partial<MjLine>) => {
    setMjLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const submitManualJournal = async () => {
    const built: { glAccountId: string; debit: number; credit: number; memo?: string | null }[] = []
    for (const l of mjLines) {
      if (!l.glAccountId.trim()) continue
      const d = parseFloat(l.debitStr) || 0
      const c = parseFloat(l.creditStr) || 0
      if (d <= GL_EPS && c <= GL_EPS) continue
      if (d > GL_EPS && c > GL_EPS) {
        onError('Each line must have either a debit or a credit, not both.')
        return
      }
      built.push({
        glAccountId: l.glAccountId,
        debit: d > GL_EPS ? d : 0,
        credit: c > GL_EPS ? c : 0,
        memo: l.memoStr.trim() || null,
      })
    }
    if (built.length < 2) {
      onError('Add at least two lines with an account and a debit or credit amount.')
      return
    }
    const sumDr = built.reduce((s, x) => s + x.debit, 0)
    const sumCr = built.reduce((s, x) => s + x.credit, 0)
    if (Math.abs(sumDr - sumCr) > GL_EPS) {
      onError(`Debits (${sumDr.toFixed(2)}) must equal credits (${sumCr.toFixed(2)}).`)
      return
    }
    setMjSaving(true)
    onError(null)
    try {
      await api.createManualJournal(projectId, { entryDate: mjDate, lines: built })
      await loadGl()
      setMjLines([
        { key: newGlPanelInstance(), glAccountId: '', debitStr: '', creditStr: '', memoStr: '' },
        { key: newGlPanelInstance(), glAccountId: '', debitStr: '', creditStr: '', memoStr: '' },
      ])
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not post journal.')
    } finally {
      setMjSaving(false)
    }
  }

  const saveEntryNotes = async (entryId: string) => {
    setNoteSavingId(entryId)
    onError(null)
    try {
      const raw = noteDraft[entryId] ?? ''
      const userNotes = raw.trim() === '' ? null : raw.trim()
      const updated = await api.updateGeneralLedgerEntryNotes(projectId, entryId, userNotes)
      setGlEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)))
      setNoteDraft((d) => ({ ...d, [entryId]: updated.userNotes ?? '' }))
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save notes.')
    } finally {
      setNoteSavingId(null)
    }
  }

  const deleteManualJournal = async (entryId: string) => {
    if (!confirm('Delete this entire manual journal (all lines)?')) return
    onError(null)
    try {
      await api.deleteManualJournalEntry(projectId, entryId)
      await loadGl()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not delete journal.')
    }
  }

  const exportGlCsv = () => {
    const headers = [
      'entryDate',
      'accountCode',
      'accountName',
      'debit',
      'credit',
      'memo',
      'userNotes',
      'sourceKind',
      'sourceId',
      'isManual',
    ]
    const lines = [headers.join(',')]
    for (const r of glEntries) {
      lines.push(
        [
          r.entryDate,
          r.accountCode ?? '',
          `"${(r.accountName ?? '').replace(/"/g, '""')}"`,
          String(r.debit),
          String(r.credit),
          `"${(r.memo ?? '').replace(/"/g, '""')}"`,
          `"${(r.userNotes ?? '').replace(/"/g, '""')}"`,
          r.sourceKind,
          r.sourceId,
          r.isManual ? 'true' : 'false',
        ].join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gl-${projectId.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const submitCategory = async () => {
    if (!panel || panel.kind !== 'category') return
    if (!catCode.trim() || !catName.trim()) return
    setSaving(true)
    onError(null)
    try {
      if (panel.mode === 'edit' && panel.row) {
        await api.updateGlCategory(panel.row.id, {
          code: catCode.trim(),
          name: catName.trim(),
          sortOrder: parseInt(catSort, 10) || 0,
        })
      } else {
        await api.createGlCategory({
          code: catCode.trim(),
          name: catName.trim(),
          sortOrder: parseInt(catSort, 10) || 0,
        })
      }
      await reloadMasters()
      closePanel()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save category.')
    } finally {
      setSaving(false)
    }
  }

  const submitSubcategory = async () => {
    if (!panel || panel.kind !== 'subcategory') return
    if (!subCatId || !subCode.trim() || !subName.trim()) return
    setSaving(true)
    onError(null)
    try {
      if (panel.mode === 'edit' && panel.row) {
        await api.updateGlSubcategory(panel.row.id, {
          code: subCode.trim(),
          name: subName.trim(),
          sortOrder: parseInt(subSort, 10) || 0,
        })
      } else {
        await api.createGlSubcategory({
          glCategoryId: subCatId,
          code: subCode.trim(),
          name: subName.trim(),
          sortOrder: parseInt(subSort, 10) || 0,
        })
      }
      await reloadMasters()
      closePanel()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save subcategory.')
    } finally {
      setSaving(false)
    }
  }

  const submitAccount = async () => {
    if (!panel || panel.kind !== 'account') return
    if (!accCat || !accCode.trim() || !accName.trim()) return
    setSaving(true)
    onError(null)
    try {
      if (panel.mode === 'edit' && panel.row) {
        await api.updateGlAccount(panel.row.id, {
          glCategoryId: accCat,
          glSubcategoryId: accSub.trim() ? accSub : null,
          code: accCode.trim(),
          name: accName.trim(),
          isActive: accActive,
        })
      } else {
        await api.createGlAccount({
          glCategoryId: accCat,
          ...(accSub ? { glSubcategoryId: accSub } : {}),
          code: accCode.trim(),
          name: accName.trim(),
          isActive: accActive,
        })
      }
      await reloadMasters()
      closePanel()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save account.')
    } finally {
      setSaving(false)
    }
  }

  const panelTitle =
    panel?.kind === 'category'
      ? panel.mode === 'edit'
        ? 'Edit GL category'
        : 'Add GL category'
      : panel?.kind === 'subcategory'
        ? panel.mode === 'edit'
          ? 'Edit GL subcategory'
          : 'Add GL subcategory'
        : panel?.kind === 'account'
          ? panel.mode === 'edit'
            ? 'Edit GL account'
            : 'Add GL account'
          : ''

  const tabBtn = (id: 'chart' | 'ledger', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={topTab === id}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        topTab === id ? 'border-teal-600 text-teal-900' : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
      onClick={() => setTopTab(id)}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200" role="tablist">
        {tabBtn('chart', 'Chart of Accounts')}
        {tabBtn('ledger', 'General ledger')}
      </div>
      {allowChartEdits && panel ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-900/40"
            aria-hidden
            onClick={closePanel}
          />
          <aside className="fixed inset-y-0 right-0 z-[51] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-medium text-slate-900">{panelTitle}</h2>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {panel.kind === 'category' ? (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submitCategory()
                  }}
                >
                  <label className="block text-xs font-medium text-slate-600">
                    Code
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={catCode}
                      onChange={(e) => setCatCode(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Name
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Sort order
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={catSort}
                      onChange={(e) => setCatSort(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : panel.mode === 'edit' ? 'Save' : 'Create'}
                    </button>
                  </div>
                </form>
              ) : null}

              {panel.kind === 'subcategory' ? (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submitSubcategory()
                  }}
                >
                  <label className="block text-xs font-medium text-slate-600">
                    Category
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={subCatId}
                      onChange={(e) => setSubCatId(e.target.value)}
                      disabled={panel.mode === 'edit'}
                      required
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Code
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={subCode}
                      onChange={(e) => setSubCode(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Name
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Sort order
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={subSort}
                      onChange={(e) => setSubSort(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : panel.mode === 'edit' ? 'Save' : 'Create'}
                    </button>
                  </div>
                </form>
              ) : null}

              {panel.kind === 'account' ? (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submitAccount()
                  }}
                >
                  <label className="block text-xs font-medium text-slate-600">
                    Category
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={accCat}
                      onChange={(e) => {
                        setAccCat(e.target.value)
                        setAccSub('')
                      }}
                      required
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Subcategory
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={accSub}
                      onChange={(e) => setAccSub(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {subcategories
                        .filter((s) => s.glCategoryId === accCat)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Code
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                      value={accCode}
                      onChange={(e) => setAccCode(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Name
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                      required
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={accActive}
                      onChange={(e) => setAccActive(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Active
                  </label>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : panel.mode === 'edit' ? 'Save' : 'Create'}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}

      {topTab === 'chart' && loading ? <p className="text-sm text-slate-600">Loading…</p> : null}

      {topTab === 'chart' && !loading ? (
        <>
          <p className="text-sm text-slate-600">
            Global chart of accounts (categories, subcategories, and accounts). Run migrations{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">027</code>,{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">028</code>,{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">029</code>, and{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">035</code> on PostgreSQL for full behaviour.
            {!allowChartEdits ? (
              <>
                {' '}
                <span className="font-medium text-slate-700">
                  Only Administrators can add or change GL categories, subcategories, and accounts.
                </span>
              </>
            ) : null}
          </p>

          <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">GL categories</h2>
          {allowChartEdits ? (
            <button
              type="button"
              onClick={() => setPanel({ instanceId: newGlPanelInstance(), kind: 'category', mode: 'create' })}
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Add category
            </button>
          ) : null}
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="min-w-[6rem] px-2 py-3">Actions</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Sort</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="whitespace-nowrap px-2 py-2">
                    {allowChartEdits ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Duplicate as new"
                          aria-label="Duplicate as new"
                          className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                          onClick={() =>
                            setPanel({ instanceId: newGlPanelInstance(), kind: 'category', mode: 'create', row: { ...c } })
                          }
                        >
                          <CopyDuplicateIcon />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          aria-label="Edit category"
                          className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                          onClick={() =>
                            setPanel({ instanceId: newGlPanelInstance(), kind: 'category', mode: 'edit', row: c })
                          }
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          title="Delete category"
                          aria-label="Delete category"
                          className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
                          onClick={() => {
                            if (!confirm('Delete this GL category? Fails if accounts still use it.')) return
                            void (async () => {
                              try {
                                await api.deleteGlCategory(c.id)
                                await reloadMasters()
                              } catch (err) {
                                onError(err instanceof Error ? err.message : 'Delete failed.')
                              }
                            })()
                          }}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-slate-600">{c.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-900">GL subcategories</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Optional finer groupings under each top-level category. Accounts can reference a subcategory in the same
              category.
            </p>
          </div>
          {allowChartEdits ? (
            <button
              type="button"
              onClick={() =>
                setPanel({ instanceId: newGlPanelInstance(), kind: 'subcategory', mode: 'create' })
              }
              className="shrink-0 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Add subcategory
            </button>
          ) : null}
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="min-w-[6rem] px-2 py-3">Actions</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Sort</th>
              </tr>
            </thead>
            <tbody>
              {subcategories.map((s) => {
                const cat = categories.find((c) => c.id === s.glCategoryId)
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-2 py-2">
                      {allowChartEdits ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Duplicate as new"
                            aria-label="Duplicate as new"
                            className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                            onClick={() =>
                              setPanel({
                                instanceId: newGlPanelInstance(),
                                kind: 'subcategory',
                                mode: 'create',
                                row: { ...s },
                              })
                            }
                          >
                            <CopyDuplicateIcon />
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            aria-label="Edit subcategory"
                            className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                            onClick={() =>
                              setPanel({ instanceId: newGlPanelInstance(), kind: 'subcategory', mode: 'edit', row: s })
                            }
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            title="Delete subcategory"
                            aria-label="Delete subcategory"
                            className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
                            onClick={() => {
                              if (!confirm('Delete this GL subcategory? Accounts using it will have it cleared.'))
                                return
                              void (async () => {
                                try {
                                  await api.deleteGlSubcategory(s.id)
                                  await reloadMasters()
                                } catch (err) {
                                  onError(err instanceof Error ? err.message : 'Delete failed.')
                                }
                              })()
                            }}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {cat ? `${cat.code} — ${cat.name}` : s.glCategoryId}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{s.code}</td>
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-slate-600">{s.sortOrder}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {subcategories.length === 0 ? (
            <p className="border-t border-slate-100 p-3 text-sm text-slate-500">No subcategories yet.</p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-900">GL accounts</h2>
          {allowChartEdits ? (
            <button
              type="button"
              onClick={() => setPanel({ instanceId: newGlPanelInstance(), kind: 'account', mode: 'create' })}
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Add account
            </button>
          ) : null}
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="min-w-[6rem] px-2 py-3">Actions</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Subcategory</th>
                <th className="px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="whitespace-nowrap px-2 py-2">
                    {allowChartEdits ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Duplicate as new"
                          aria-label="Duplicate as new"
                          className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                          onClick={() =>
                            setPanel({ instanceId: newGlPanelInstance(), kind: 'account', mode: 'create', row: { ...a } })
                          }
                        >
                          <CopyDuplicateIcon />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          aria-label="Edit account"
                          className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                          onClick={() =>
                            setPanel({ instanceId: newGlPanelInstance(), kind: 'account', mode: 'edit', row: a })
                          }
                        >
                          <PencilIcon />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{a.code}</td>
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {a.categoryCode ?? '—'} — {a.categoryName ?? ''}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {a.subcategoryCode
                      ? `${a.subcategoryCode} — ${a.subcategoryName ?? ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{a.isActive ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
        </>
      ) : null}

      {topTab === 'ledger' ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium text-slate-900">General ledger (this project)</h2>
            <p className="mt-1 text-sm text-slate-600">
              System postings and manual journals. Notes can be edited on any line. Manual journals require matching
              debits and credits (at least two lines). Only manual journals can be deleted.
            </p>
          </div>

          {allowLedgerEdits ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                id="manual-journal-toggle"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                aria-expanded={manualJournalPanelOpen}
                aria-controls="manual-journal-panel"
                onClick={() => setManualJournalPanelOpen((o) => !o)}
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-slate-900">Post manual journal</h3>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {manualJournalPanelOpen
                      ? 'Each line: one account and either a debit or a credit. Totals must balance before posting.'
                      : 'Expand to add a balanced double-entry journal.'}
                  </p>
                </div>
                <svg
                  className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${manualJournalPanelOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {manualJournalPanelOpen ? (
                <div
                  id="manual-journal-panel"
                  role="region"
                  aria-labelledby="manual-journal-toggle"
                  className="border-t border-slate-100 px-4 pb-4 pt-3"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs font-medium text-slate-600">
                      Entry date
                      <input
                        type="date"
                        className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        value={mjDate}
                        onChange={(e) => setMjDate(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addMjLine}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Add line
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {mjLines.map((line) => (
                      <div
                        key={line.key}
                        className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2"
                      >
                        <label className="min-w-[12rem] flex-1 text-xs font-medium text-slate-600">
                          GL account
                          <select
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                            value={line.glAccountId}
                            onChange={(e) => updateMjLine(line.key, { glAccountId: e.target.value })}
                          >
                            <option value="">— Select —</option>
                            {activeGlAccounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} — {a.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="w-24 text-xs font-medium text-slate-600">
                          Debit
                          <input
                            inputMode="decimal"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
                            value={line.debitStr}
                            onChange={(e) => updateMjLine(line.key, { debitStr: e.target.value })}
                            placeholder="0"
                          />
                        </label>
                        <label className="w-24 text-xs font-medium text-slate-600">
                          Credit
                          <input
                            inputMode="decimal"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
                            value={line.creditStr}
                            onChange={(e) => updateMjLine(line.key, { creditStr: e.target.value })}
                            placeholder="0"
                          />
                        </label>
                        <label className="min-w-[8rem] flex-1 text-xs font-medium text-slate-600">
                          Line memo
                          <input
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                            value={line.memoStr}
                            onChange={(e) => updateMjLine(line.key, { memoStr: e.target.value })}
                            placeholder="Optional"
                          />
                        </label>
                        {mjLines.length > 2 ? (
                          <button
                            type="button"
                            title="Remove line"
                            aria-label="Remove line"
                            className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
                            onClick={() => removeMjLine(line.key)}
                          >
                            <TrashIcon />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span
                      className={Math.abs(mjTotals.diff) <= GL_EPS ? 'text-slate-600' : 'font-medium text-amber-800'}
                    >
                      Debits {mjTotals.dr.toFixed(2)} · Credits {mjTotals.cr.toFixed(2)}
                      {Math.abs(mjTotals.diff) > GL_EPS
                        ? ` · Out of balance by ${mjTotals.diff.toFixed(2)}`
                        : ' · Balanced'}
                    </span>
                    <button
                      type="button"
                      disabled={mjSaving || Math.abs(mjTotals.diff) > GL_EPS || mjTotals.dr <= GL_EPS}
                      onClick={() => void submitManualJournal()}
                      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40"
                    >
                      {mjSaving ? 'Posting…' : 'Post journal'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-100 bg-white p-3">
            <label className="text-xs font-medium text-slate-600">
              From
              <input
                type="date"
                className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={glStart}
                onChange={(e) => setGlStart(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              To
              <input
                type="date"
                className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={glEnd}
                onChange={(e) => setGlEnd(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => void loadGl()}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={exportGlCsv}
              disabled={glEntries.length === 0}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Download CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {glLoading ? <p className="p-4 text-sm text-slate-600">Loading…</p> : null}
            {!glLoading && glEntries.length === 0 ? (
              <p className="p-4 text-sm text-slate-600">No lines for this range.</p>
            ) : null}
            {!glLoading && glEntries.length > 0 ? (
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Account</th>
                    <th className="px-2 py-2">Debit</th>
                    <th className="px-2 py-2">Credit</th>
                    <th className="px-2 py-2">Memo</th>
                    <th className="min-w-[10rem] px-2 py-2">Notes</th>
                    <th className="px-2 py-2">Source</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayGlEntries.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="whitespace-nowrap px-2 py-1.5">{formatDate(r.entryDate)}</td>
                      <td className="px-2 py-1.5">
                        <span className="font-mono text-xs">{r.accountCode}</span> {r.accountName}
                      </td>
                      <td className="px-2 py-1.5">{r.debit > 0 ? formatMoney(r.debit) : '—'}</td>
                      <td className="px-2 py-1.5">{r.credit > 0 ? formatMoney(r.credit) : '—'}</td>
                      <td className="max-w-[12rem] px-2 py-1.5 text-xs text-slate-600">{r.memo ?? '—'}</td>
                      <td className="px-2 py-1.5 align-top">
                        {allowLedgerEdits ? (
                          <textarea
                            rows={2}
                            className="w-full min-w-[8rem] rounded border border-slate-200 px-2 py-1 text-xs"
                            value={noteDraft[r.id] ?? ''}
                            onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                            placeholder="Your notes"
                          />
                        ) : (
                          <span className="text-xs text-slate-600">{r.userNotes?.trim() ? r.userNotes : '—'}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-600">
                        {r.sourceKind}
                        <br />
                        <span className="font-mono">{r.sourceId.slice(0, 8)}…</span>
                        {r.isManual ? (
                          <>
                            <br />
                            <span className="text-teal-700">Manual</span>
                          </>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {allowLedgerEdits ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={
                                noteSavingId === r.id ||
                                (noteDraft[r.id] ?? '') === (r.userNotes ?? '')
                              }
                              onClick={() => void saveEntryNotes(r.id)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              {noteSavingId === r.id ? 'Saving…' : 'Save notes'}
                            </button>
                            {manualJournalDeleteAnchorIds.has(r.id) ? (
                              <button
                                type="button"
                                title="Delete entire manual journal"
                                aria-label="Delete entire manual journal"
                                className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
                                onClick={() => void deleteManualJournal(r.id)}
                              >
                                <TrashIcon />
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
