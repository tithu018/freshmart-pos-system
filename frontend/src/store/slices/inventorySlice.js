import {
  createAsyncThunk,
  createSelector,
  createSlice,
  isAnyOf,
} from '@reduxjs/toolkit'
import { inventoryService } from '../../services/inventoryService.js'
import { login, logout, restoreSession, sessionExpired } from './authSlice.js'

function failure(error, api) {
  if (error.status === 401) api.dispatch(sessionExpired())
  return api.rejectWithValue({
    message: error.message,
    status: error.status || 0,
  })
}
export const loadInventory = createAsyncThunk(
  'inventory/load',
  async (_, api) => {
    try {
      return await inventoryService.list()
    } catch (error) {
      return failure(error, api)
    }
  },
  {
    condition: (force, { getState }) =>
      (force === true || !getState().inventory.loading) &&
      !getState().inventory.saving,
  },
)
export const loadStockHistory = createAsyncThunk(
  'inventory/history',
  async (productId, api) => {
    try {
      return await inventoryService.history(productId)
    } catch (error) {
      return failure(error, api)
    }
  },
)
const mutation = (name, operation) =>
  createAsyncThunk(
    `inventory/${name}`,
    async (input, api) => {
      try {
        return await operation(input)
      } catch (error) {
        return failure(error, api)
      }
    },
    { condition: (_, { getState }) => !getState().inventory.saving },
  )
export const adjustInventory = mutation('adjust', inventoryService.adjust)
export const setStockThreshold = mutation(
  'threshold',
  inventoryService.threshold,
)
const initialState = {
  items: [],
  loaded: false,
  loading: false,
  saving: false,
  error: null,
  loadId: null,
  mutationId: null,
  history: [],
  historyLoading: false,
  historyError: null,
  historyId: null,
}
const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadInventory.pending, (state, action) => {
        state.loading = true
        state.error = null
        state.loadId = action.meta.requestId
      })
      .addCase(loadInventory.fulfilled, (state, action) => {
        if (state.loadId !== action.meta.requestId) return
        state.items = action.payload
        state.loading = false
        state.loaded = true
        state.loadId = null
      })
      .addCase(loadInventory.rejected, (state, action) => {
        if (state.loadId !== action.meta.requestId) return
        state.loading = false
        state.loadId = null
        state.error = action.payload?.message || 'Unable to load inventory.'
      })
      .addCase(loadStockHistory.pending, (state, action) => {
        state.history = []
        state.historyLoading = true
        state.historyError = null
        state.historyId = action.meta.requestId
      })
      .addCase(loadStockHistory.fulfilled, (state, action) => {
        if (state.historyId !== action.meta.requestId) return
        state.history = action.payload
        state.historyLoading = false
        state.historyId = null
      })
      .addCase(loadStockHistory.rejected, (state, action) => {
        if (state.historyId !== action.meta.requestId) return
        state.historyLoading = false
        state.historyError =
          action.payload?.message || 'Unable to load stock history.'
      })
      .addMatcher(
        isAnyOf(adjustInventory.pending, setStockThreshold.pending),
        (state, action) => {
          state.saving = true
          state.mutationId = action.meta.requestId
          state.loadId = null
          state.loading = false
        },
      )
      .addMatcher(
        isAnyOf(adjustInventory.fulfilled, setStockThreshold.fulfilled),
        (state, action) => {
          if (state.mutationId !== action.meta.requestId) return
          const index = state.items.findIndex(
            (item) => item.id === action.payload.id,
          )
          if (index >= 0) state.items[index] = action.payload
          else state.items.push(action.payload)
          state.saving = false
          state.mutationId = null
          state.history = []
          state.historyId = null
          state.historyLoading = false
        },
      )
      .addMatcher(
        isAnyOf(adjustInventory.rejected, setStockThreshold.rejected),
        (state, action) => {
          if (state.mutationId !== action.meta.requestId) return
          state.saving = false
          state.mutationId = null
        },
      )
      .addMatcher(
        (action) =>
          isAnyOf(login.pending, logout.fulfilled, sessionExpired)(action) ||
          (restoreSession.rejected.match(action) &&
            [401, 403].includes(action.payload?.status)),
        () => initialState,
      )
  },
})
export default inventorySlice.reducer
export const selectLowStock = createSelector(
  (state) => state.inventory.items,
  (items) =>
    items.filter((item) => item.stock === 0 || item.stock < item.minStock),
)
export const selectInventorySummary = createSelector(
  (state) => state.inventory.items,
  (items) => ({
    units: items.reduce((sum, item) => sum + item.stock, 0),
    value: items.reduce((sum, item) => sum + item.stock * item.price, 0),
    lowStock: items.filter(
      (item) => item.stock > 0 && item.stock < item.minStock,
    ).length,
    outOfStock: items.filter((item) => item.stock === 0).length,
  }),
)
