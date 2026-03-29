import { useCallback, useEffect, useState } from 'react'
import * as api from '../../api/dataApi'
import type { GeneralLedgerEntry, GlAccount, GlCategory, GlSubcategory } from '../../types'
import { formatDate, formatMoney } from '../../utils/format'

const iconBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

function CopyIcon() {
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

async function copyJson(data: unknown) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  } catch {
    window.prompt('Copy', JSON.stringify(data))
  }
}

export function GlTab({
  projectId,
  onError,
  readOnly = false,
}: {
  projectId: string
  onError: (msg: string | null) => void
  readOnly?: boolean
}) {
  const [categories, setCategories] = useState<GlCategory[]>([])
  const [subcategories, setSubcategories] = useState<GlSubcategory[]>([])
  const [accounts, setAccounts] = useState<GlAccount[]>([])
  const [glEntries, setGlEntries] = useState<GeneralLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [glLoading, setGlLoading] = useState(false)
  const [glStart, setGlStart] = useState('')
  const [glEnd, setGlEnd] = useState('')

  const [newCatCode, setNewCatCode] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [newCatSort, setNewCatSort] = useState('100')

  const [newAccCat, setNewAccCat] = useState('')
  const [newAccSub, setNewAccSub] = useState('')
  const [newAccCode, setNewAccCode] = useState('')
  const [newAccName, setNewAccName] = useState('')

  const [newSubCat, setNewSubCat] = useState('')
  const [newSubCode, setNewSubCode] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const [newSubSort, setNewSubSort] = useState('10')

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
      setNewAccCat((cur) => cur || c[0]?.id || '')
      setNewSubCat((cur) => cur || c[0]?.id || '')
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
    void loadGl()
  }, [loadGl])

  const exportGlCsv = () => {
    const headers = ['entryDate', 'accountCode', 'accountName', 'debit', 'credit', 'memo', 'sourceKind', 'sourceId']
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
          r.sourceKind,
          r.sourceId,
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

  return (
    <div className="space-y-10">
      <p className="text-sm text-slate-600">
        Chart of accounts (global) and project general ledger. Run migrations{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">027</code>,{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">028</code>, and{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">029</code> on PostgreSQL for full behaviour.
      </p>
      {loading ? <p className="text-sm text-slate-600">Loading…</p> : null}

      <section>
        <h2 className="text-lg font-medium text-slate-900">GL categories</h2>
        {!readOnly ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!newCatCode.trim() || !newCatName.trim()) return
              onError(null)
              try {
                await api.createGlCategory({
                  code: newCatCode.trim(),
                  name: newCatName.trim(),
                  sortOrder: parseInt(newCatSort, 10) || 0,
                })
                setNewCatCode('')
                setNewCatName('')
                await reloadMasters()
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Could not create category.')
              }
            }}
          >
            <label className="text-xs font-medium text-slate-600">
              Code
              <input
                className="mt-1 block w-28 rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newCatCode}
                onChange={(e) => setNewCatCode(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Name
              <input
                className="mt-1 block min-w-[12rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Sort
              <input
                type="number"
                className="mt-1 block w-20 rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newCatSort}
                onChange={(e) => setNewCatSort(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Add category
            </button>
          </form>
        ) : null}
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-11 px-2 py-3">Actions</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Sort</th>
                <th className="w-11 px-2 py-3">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      title="Copy JSON"
                      aria-label="Copy JSON"
                      className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                      onClick={() => void copyJson(c)}
                    >
                      <CopyIcon />
                    </button>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-slate-600">{c.sortOrder}</td>
                  <td className="px-2 py-2">
                    {!readOnly ? (
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
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-900">GL subcategories</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Optional finer groupings under each top-level category (for example current vs fixed assets, or payroll vs
          rent under expenses). Accounts can be tagged with a subcategory that belongs to the same category.
        </p>
        {!readOnly ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!newSubCat || !newSubCode.trim() || !newSubName.trim()) return
              onError(null)
              try {
                await api.createGlSubcategory({
                  glCategoryId: newSubCat,
                  code: newSubCode.trim(),
                  name: newSubName.trim(),
                  sortOrder: parseInt(newSubSort, 10) || 0,
                })
                setNewSubCode('')
                setNewSubName('')
                await reloadMasters()
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Could not create subcategory.')
              }
            }}
          >
            <label className="text-xs font-medium text-slate-600">
              Category
              <select
                className="mt-1 block min-w-[10rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newSubCat}
                onChange={(e) => setNewSubCat(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Code
              <input
                className="mt-1 block w-28 rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newSubCode}
                onChange={(e) => setNewSubCode(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Name
              <input
                className="mt-1 block min-w-[12rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Sort
              <input
                type="number"
                className="mt-1 block w-20 rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newSubSort}
                onChange={(e) => setNewSubSort(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Add subcategory
            </button>
          </form>
        ) : null}
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-11 px-2 py-3">Actions</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Sort</th>
                <th className="w-11 px-2 py-3">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {subcategories.map((s) => {
                const cat = categories.find((c) => c.id === s.glCategoryId)
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        title="Copy JSON"
                        aria-label="Copy JSON"
                        className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                        onClick={() => void copyJson(s)}
                      >
                        <CopyIcon />
                      </button>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {cat ? `${cat.code} — ${cat.name}` : s.glCategoryId}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{s.code}</td>
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-slate-600">{s.sortOrder}</td>
                    <td className="px-2 py-2">
                      {!readOnly ? (
                        <button
                          type="button"
                          title="Delete subcategory"
                          aria-label="Delete subcategory"
                          className={`${iconBtnClass} text-red-600 hover:border-red-200 hover:bg-red-50`}
                          onClick={() => {
                            if (!confirm('Delete this GL subcategory? Accounts using it will have it cleared.')) return
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
                      ) : null}
                    </td>
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
        <h2 className="text-lg font-medium text-slate-900">GL accounts</h2>
        {!readOnly ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!newAccCat || !newAccCode.trim() || !newAccName.trim()) return
              onError(null)
              try {
                await api.createGlAccount({
                  glCategoryId: newAccCat,
                  ...(newAccSub ? { glSubcategoryId: newAccSub } : {}),
                  code: newAccCode.trim(),
                  name: newAccName.trim(),
                })
                setNewAccCode('')
                setNewAccName('')
                await reloadMasters()
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Could not create account.')
              }
            }}
          >
            <label className="text-xs font-medium text-slate-600">
              Category
              <select
                className="mt-1 block min-w-[10rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newAccCat}
                onChange={(e) => {
                  setNewAccCat(e.target.value)
                  setNewAccSub('')
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Subcategory
              <select
                className="mt-1 block min-w-[10rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newAccSub}
                onChange={(e) => setNewAccSub(e.target.value)}
              >
                <option value="">— None —</option>
                {subcategories
                  .filter((s) => s.glCategoryId === newAccCat)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Code
              <input
                className="mt-1 block w-24 rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newAccCode}
                onChange={(e) => setNewAccCode(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Name
              <input
                className="mt-1 block min-w-[12rem] rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Add account
            </button>
          </form>
        ) : null}
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-11 px-2 py-3">Actions</th>
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
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      title="Copy JSON"
                      aria-label="Copy JSON"
                      className={`${iconBtnClass} text-teal-700 hover:border-teal-200 hover:bg-teal-50`}
                      onClick={() => void copyJson(a)}
                    >
                      <CopyIcon />
                    </button>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{a.code}</td>
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {a.categoryCode ?? '—'} — {a.categoryName ?? ''}
                  </td>
                  <td className="px-4 py-2">
                    {!readOnly ? (
                      <select
                        className="max-w-[14rem] rounded border border-slate-200 px-2 py-1 text-xs"
                        value={a.glSubcategoryId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          void (async () => {
                            try {
                              await api.updateGlAccount(a.id, {
                                glSubcategoryId: v === '' ? null : v,
                              })
                              await reloadMasters()
                            } catch (err) {
                              onError(err instanceof Error ? err.message : 'Update failed.')
                            }
                          })()
                        }}
                      >
                        <option value="">— None —</option>
                        {subcategories
                          .filter((s) => s.glCategoryId === a.glCategoryId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} — {s.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="text-slate-600">
                        {a.subcategoryCode
                          ? `${a.subcategoryCode} — ${a.subcategoryName ?? ''}`
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {a.isActive ? 'Yes' : 'No'}
                    {!readOnly ? (
                      <button
                        type="button"
                        className="ml-2 text-xs font-medium text-teal-700 hover:underline"
                        onClick={() => {
                          void (async () => {
                            try {
                              await api.updateGlAccount(a.id, { isActive: !a.isActive })
                              await reloadMasters()
                            } catch (err) {
                              onError(err instanceof Error ? err.message : 'Update failed.')
                            }
                          })()
                        }}
                      >
                        Toggle
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-900">General ledger (this project)</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-100 bg-white p-3">
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
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  <th className="px-2 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {glEntries.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-2 py-1.5">{formatDate(r.entryDate)}</td>
                    <td className="px-2 py-1.5">
                      <span className="font-mono text-xs">{r.accountCode}</span> {r.accountName}
                    </td>
                    <td className="px-2 py-1.5">{r.debit > 0 ? formatMoney(r.debit) : '—'}</td>
                    <td className="px-2 py-1.5">{r.credit > 0 ? formatMoney(r.credit) : '—'}</td>
                    <td className="px-2 py-1.5 text-xs text-slate-600">
                      {r.sourceKind}
                      <br />
                      <span className="font-mono">{r.sourceId.slice(0, 8)}…</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
    </div>
  )
}
