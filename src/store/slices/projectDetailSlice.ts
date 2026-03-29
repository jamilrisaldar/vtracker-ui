import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import * as api from '../../api/dataApi'
import type {
  Invoice,
  LandPlot,
  Payment,
  Phase,
  Project,
  ProjectDocument,
  ProjectReport,
  Vendor,
} from '../../types'
import type { TabId } from '../../components/project-detail/constants'

export type ProjectDetailLoaded = {
  phases: boolean
  plots: boolean
  vendorBilling: boolean
  documents: boolean
  report: boolean
}

const emptyLoaded = (): ProjectDetailLoaded => ({
  phases: false,
  plots: false,
  vendorBilling: false,
  documents: false,
  report: false,
})

interface ProjectDetailState {
  projectId: string | null
  project: Project | null
  phases: Phase[]
  plots: LandPlot[]
  vendors: Vendor[]
  invoices: Invoice[]
  payments: Payment[]
  documents: ProjectDocument[]
  report: ProjectReport | null
  loaded: ProjectDetailLoaded
  /** Initial project fetch (header + overview). */
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  reportLoading: boolean
  reportError: string | null
}

const initialState: ProjectDetailState = {
  projectId: null,
  project: null,
  phases: [],
  plots: [],
  vendors: [],
  invoices: [],
  payments: [],
  documents: [],
  report: null,
  loaded: emptyLoaded(),
  status: 'idle',
  error: null,
  reportLoading: false,
  reportError: null,
}

export const loadProject = createAsyncThunk(
  'projectDetail/loadProject',
  async (projectId: string) => {
    const project = await api.getProject(projectId)
    return { projectId, project }
  },
)

export const fetchPhases = createAsyncThunk('projectDetail/fetchPhases', (projectId: string) =>
  api.listPhases(projectId),
)

export const fetchPlots = createAsyncThunk('projectDetail/fetchPlots', (projectId: string) =>
  api.listPlots(projectId),
)

export const fetchVendorBilling = createAsyncThunk(
  'projectDetail/fetchVendorBilling',
  async (projectId: string) => {
    const [vendors, invoices, payments] = await Promise.all([
      api.listVendors(projectId),
      api.listInvoices(projectId),
      api.listPayments(projectId),
    ])
    return { vendors, invoices, payments }
  },
)

export const fetchDocuments = createAsyncThunk('projectDetail/fetchDocuments', (projectId: string) =>
  api.listDocuments(projectId),
)

export const fetchReport = createAsyncThunk('projectDetail/fetchReport', (projectId: string) =>
  api.getProjectReport(projectId),
)

/**
 * Loads tab-specific data only once per project until invalidated (e.g. report after billing changes).
 */
export const ensureTabData = createAsyncThunk(
  'projectDetail/ensureTab',
  async ({ projectId, tab }: { projectId: string; tab: TabId }, { getState, dispatch }) => {
    const s = getState() as { projectDetail: ProjectDetailState }
    const { loaded } = s.projectDetail

    switch (tab) {
      case 'overview':
        return
      case 'phases':
        if (!loaded.phases) await dispatch(fetchPhases(projectId)).unwrap()
        return
      case 'plots':
        if (!loaded.plots) await dispatch(fetchPlots(projectId)).unwrap()
        return
      case 'vendors':
        if (!loaded.vendorBilling) await dispatch(fetchVendorBilling(projectId)).unwrap()
        return
      case 'gl':
        return
      case 'documents': {
        const tasks: Promise<unknown>[] = []
        if (!loaded.documents) tasks.push(dispatch(fetchDocuments(projectId)).unwrap())
        if (!loaded.vendorBilling) tasks.push(dispatch(fetchVendorBilling(projectId)).unwrap())
        await Promise.all(tasks)
        return
      }
      case 'reports':
        if (!loaded.report) await dispatch(fetchReport(projectId)).unwrap()
        return
      default:
        return
    }
  },
)

const projectDetailSlice = createSlice({
  name: 'projectDetail',
  initialState,
  reducers: {
    projectUpdated: (state, action: PayloadAction<Project>) => {
      state.project = action.payload
    },
    clearProjectDetail: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProject.pending, (state, action) => {
        state.status = 'loading'
        state.error = null
        const nextId = action.meta.arg
        if (state.projectId !== nextId) {
          state.project = null
        }
      })
      .addCase(loadProject.fulfilled, (state, action) => {
        const { projectId, project } = action.payload
        const prevId = state.projectId
        state.projectId = projectId
        state.project = project
        state.status = 'succeeded'
        if (prevId !== projectId) {
          state.phases = []
          state.plots = []
          state.vendors = []
          state.invoices = []
          state.payments = []
          state.documents = []
          state.report = null
          state.loaded = emptyLoaded()
          state.reportError = null
          state.reportLoading = false
        }
        if (!project) {
          state.phases = []
          state.plots = []
          state.vendors = []
          state.invoices = []
          state.payments = []
          state.documents = []
          state.report = null
          state.loaded = emptyLoaded()
          state.reportError = null
          state.reportLoading = false
        }
      })
      .addCase(loadProject.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message ?? 'Failed to load project'
      })
      .addCase(fetchPhases.fulfilled, (state, action) => {
        state.phases = action.payload
        state.loaded.phases = true
      })
      .addCase(fetchPlots.fulfilled, (state, action) => {
        state.plots = action.payload
        state.loaded.plots = true
      })
      .addCase(fetchVendorBilling.fulfilled, (state, action) => {
        state.vendors = action.payload.vendors
        state.invoices = action.payload.invoices
        state.payments = action.payload.payments
        state.loaded.vendorBilling = true
        state.loaded.report = false
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.documents = action.payload
        state.loaded.documents = true
      })
      .addCase(fetchReport.pending, (state) => {
        state.reportLoading = true
        state.reportError = null
      })
      .addCase(fetchReport.fulfilled, (state, action) => {
        state.report = action.payload
        state.loaded.report = true
        state.reportLoading = false
        state.reportError = null
      })
      .addCase(fetchReport.rejected, (state, action) => {
        state.reportLoading = false
        state.reportError = action.error.message ?? 'Failed to load report'
      })
  },
})

export const { projectUpdated, clearProjectDetail } = projectDetailSlice.actions
export const projectDetailReducer = projectDetailSlice.reducer
