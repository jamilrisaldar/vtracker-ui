import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as api from '../../api/dataApi'
import type {
  Account,
  AccountTransaction,
  Invoice,
  Project,
  TransactionPaymentOption,
} from '../../types'
import { logoutThunk } from './authSlice'

export type AccountsPagePaymentContextStatus = 'idle' | 'loading' | 'succeeded' | 'failed'
export type AccountsBootstrapStatus = 'idle' | 'loading' | 'succeeded' | 'failed'

function ledgerBalance(transactions: AccountTransaction[]): number {
  return transactions.reduce((sum, t) => {
    return sum + (t.entryType === 'debit' ? t.amount : -t.amount)
  }, 0)
}

async function loadPaymentContext(projects: Project[]): Promise<{
  paymentOptions: TransactionPaymentOption[]
  vendorById: Record<string, string>
  invoiceById: Record<string, Invoice>
}> {
  const opts: TransactionPaymentOption[] = []
  const vendorById: Record<string, string> = {}
  const invoiceById: Record<string, Invoice> = {}
  for (const p of projects) {
    const [pay, ven, inv] = await Promise.all([
      api.listPayments(p.id),
      api.listVendors(p.id),
      api.listInvoices(p.id),
    ])
    ven.forEach((v) => {
      vendorById[v.id] = v.name
    })
    inv.forEach((i) => {
      invoiceById[i.id] = i
    })
    pay.forEach((pm) => opts.push({ payment: pm, projectId: p.id, projectName: p.name }))
  }
  return { paymentOptions: opts, vendorById, invoiceById }
}

export interface AccountsPageState {
  accounts: Account[]
  projects: Project[]
  /** Full transaction list per account (no filters); used for balances + default ledger view. */
  transactionsByAccountId: Record<string, AccountTransaction[]>
  balancesByAccountId: Record<string, number>
  paymentOptions: TransactionPaymentOption[]
  vendorById: Record<string, string>
  invoiceById: Record<string, Invoice>
  paymentContextProjectsKey: string | null
  paymentContextStatus: AccountsPagePaymentContextStatus
  paymentContextError: string | null
  bootstrapStatus: AccountsBootstrapStatus
  bootstrapError: string | null
}

const emptyPaymentState = {
  paymentOptions: [] as TransactionPaymentOption[],
  vendorById: {} as Record<string, string>,
  invoiceById: {} as Record<string, Invoice>,
}

const initialState: AccountsPageState = {
  accounts: [],
  projects: [],
  transactionsByAccountId: {},
  balancesByAccountId: {},
  ...emptyPaymentState,
  paymentContextProjectsKey: null,
  paymentContextStatus: 'idle',
  paymentContextError: null,
  bootstrapStatus: 'idle',
  bootstrapError: null,
}

export type AccountsThunkConfig = { state: { accountsPage: AccountsPageState } }

export type AccountsBootstrapResult = {
  accounts: Account[]
  projects: Project[]
  transactionsByAccountId: Record<string, AccountTransaction[]>
  balancesByAccountId: Record<string, number>
  paymentOptions: TransactionPaymentOption[]
  vendorById: Record<string, string>
  invoiceById: Record<string, Invoice>
  paymentContextProjectsKey: string
}

/**
 * Loads accounts, projects, all account transaction lists (for balances + cache), and payment
 * picker context. Skips payment API round-trip when project set unchanged and context already loaded.
 */
export const bootstrapAccountsPage = createAsyncThunk<
  AccountsBootstrapResult,
  void,
  AccountsThunkConfig
>(
  'accountsPage/bootstrap',
  async (_, { getState, rejectWithValue }) => {
    try {
      const [accs, plist] = await Promise.all([api.listAccounts(), api.listProjects()])

      const entries = await Promise.all(
        accs.map(async (a) => {
          const txs = await api.listAccountTransactions(a.id)
          return [a.id, txs] as const
        }),
      )

      const transactionsByAccountId = Object.fromEntries(entries) as Record<
        string,
        AccountTransaction[]
      >
      const balancesByAccountId = Object.fromEntries(
        entries.map(([id, txs]) => [id, ledgerBalance(txs)] as const),
      )

      const projectsKey = [...plist].map((p) => p.id).sort().join(',')
      const st = getState().accountsPage

      const skipPayment =
        st.paymentContextStatus === 'succeeded' && st.paymentContextProjectsKey === projectsKey

      let paymentOptions: TransactionPaymentOption[]
      let vendorById: Record<string, string>
      let invoiceById: Record<string, Invoice>

      if (skipPayment) {
        paymentOptions = st.paymentOptions
        vendorById = st.vendorById
        invoiceById = st.invoiceById
      } else {
        const loaded = await loadPaymentContext(plist)
        paymentOptions = loaded.paymentOptions
        vendorById = loaded.vendorById
        invoiceById = loaded.invoiceById
      }

      return {
        accounts: accs,
        projects: plist,
        transactionsByAccountId,
        balancesByAccountId,
        paymentOptions,
        vendorById,
        invoiceById,
        paymentContextProjectsKey: projectsKey,
      }
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load accounts.')
    }
  },
  {
    condition: (_, { getState }) => {
      const st = getState().accountsPage
      if (st.bootstrapStatus === 'loading') return false
      return true
    },
  },
)

const accountsPageSlice = createSlice({
  name: 'accountsPage',
  initialState,
  reducers: {
    clearAccountsPage() {
      return { ...initialState }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAccountsPage.pending, (state) => {
        state.bootstrapStatus = 'loading'
        state.bootstrapError = null
        if (state.paymentContextStatus !== 'succeeded') {
          state.paymentContextStatus = 'loading'
          state.paymentContextError = null
        }
      })
      .addCase(bootstrapAccountsPage.fulfilled, (state, action) => {
        state.bootstrapStatus = 'succeeded'
        state.bootstrapError = null
        state.accounts = action.payload.accounts
        state.projects = action.payload.projects
        state.transactionsByAccountId = action.payload.transactionsByAccountId
        state.balancesByAccountId = action.payload.balancesByAccountId
        state.paymentOptions = action.payload.paymentOptions
        state.vendorById = action.payload.vendorById
        state.invoiceById = action.payload.invoiceById
        state.paymentContextProjectsKey = action.payload.paymentContextProjectsKey
        state.paymentContextStatus = 'succeeded'
        state.paymentContextError = null
      })
      .addCase(bootstrapAccountsPage.rejected, (state, action) => {
        state.bootstrapStatus = 'failed'
        state.bootstrapError =
          typeof action.payload === 'string' ? action.payload : action.error.message ?? 'Failed'
        state.accounts = []
        state.projects = []
        state.transactionsByAccountId = {}
        state.balancesByAccountId = {}
        state.paymentContextStatus = 'failed'
        state.paymentContextError = state.bootstrapError
        Object.assign(state, emptyPaymentState)
        state.paymentContextProjectsKey = null
      })
      .addCase(logoutThunk.fulfilled, () => ({ ...initialState }))
  },
})

export const { clearAccountsPage } = accountsPageSlice.actions
export const accountsPageReducer = accountsPageSlice.reducer
