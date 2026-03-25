import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as api from '../../api/dataApi'
import type { Invoice, Project, TransactionPaymentOption } from '../../types'

export type AccountsPagePaymentContextStatus = 'idle' | 'loading' | 'succeeded' | 'failed'

interface AccountsPageState {
  paymentOptions: TransactionPaymentOption[]
  vendorById: Record<string, string>
  invoiceById: Record<string, Invoice>
  paymentContextStatus: AccountsPagePaymentContextStatus
  paymentContextError: string | null
}

const initialState: AccountsPageState = {
  paymentOptions: [],
  vendorById: {},
  invoiceById: {},
  paymentContextStatus: 'idle',
  paymentContextError: null,
}

/** Loads vendor billing data for all projects (used by the transaction payment link UI). */
export const fetchAccountsPaymentContext = createAsyncThunk(
  'accountsPage/fetchPaymentContext',
  async (projects: Project[], { rejectWithValue }) => {
    try {
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
        pay.forEach((pm) =>
          opts.push({ payment: pm, projectId: p.id, projectName: p.name }),
        )
      }
      return { paymentOptions: opts, vendorById, invoiceById }
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load payment context.')
    }
  },
)

const accountsPageSlice = createSlice({
  name: 'accountsPage',
  initialState,
  reducers: {
    clearAccountsPage() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccountsPaymentContext.pending, (state) => {
        state.paymentContextStatus = 'loading'
        state.paymentContextError = null
      })
      .addCase(fetchAccountsPaymentContext.fulfilled, (state, action) => {
        state.paymentContextStatus = 'succeeded'
        state.paymentOptions = action.payload.paymentOptions
        state.vendorById = action.payload.vendorById
        state.invoiceById = action.payload.invoiceById
      })
      .addCase(fetchAccountsPaymentContext.rejected, (state, action) => {
        state.paymentContextStatus = 'failed'
        state.paymentContextError =
          typeof action.payload === 'string' ? action.payload : action.error.message ?? 'Failed'
        state.paymentOptions = []
        state.vendorById = {}
        state.invoiceById = {}
      })
  },
})

export const { clearAccountsPage } = accountsPageSlice.actions
export const accountsPageReducer = accountsPageSlice.reducer
