import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { salesService } from '../../services/salesService.js'
import { login, logout, restoreSession, sessionExpired } from './authSlice.js'

function request(name, operation) {
  return createAsyncThunk(`sales/${name}`, async (input, api) => {
    const userId = api.getState().auth.user?.id
    try {
      return await operation(input)
    } catch (error) {
      if (error.status === 401 && api.getState().auth.user?.id === userId)
        api.dispatch(sessionExpired())
      return api.rejectWithValue({
        message: error.message,
        status: error.status || 0,
      })
    }
  })
}
export const loadSales = request('list', salesService.list)
export const loadRecentSales = request('recent', salesService.list)
export const loadSaleDetails = request('details', salesService.details)
export const loadSalesCashiers = request('cashiers', salesService.cashiers)
const initialState = {
  list: null,
  listLoading: false,
  listError: null,
  listId: null,
  recent: null,
  recentLoading: false,
  recentError: null,
  recentId: null,
  details: null,
  detailsLoading: false,
  detailsError: null,
  detailsId: null,
  cashiers: [],
  cashiersLoading: false,
  cashiersError: null,
  cashiersId: null,
}
const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {
    clearSaleDetails: (state) => {
      state.details = null
      state.detailsId = null
      state.detailsLoading = false
      state.detailsError = null
    },
  },
  extraReducers: (builder) => {
    for (const [key, thunk] of [
      ['list', loadSales],
      ['recent', loadRecentSales],
      ['details', loadSaleDetails],
      ['cashiers', loadSalesCashiers],
    ]) {
      builder
        .addCase(thunk.pending, (state, action) => {
          state[key] = key === 'cashiers' ? [] : null
          state[`${key}Loading`] = true
          state[`${key}Error`] = null
          state[`${key}Id`] = action.meta.requestId
        })
        .addCase(thunk.fulfilled, (state, action) => {
          if (state[`${key}Id`] !== action.meta.requestId) return
          state[key] = action.payload
          state[`${key}Loading`] = false
          state[`${key}Id`] = null
        })
        .addCase(thunk.rejected, (state, action) => {
          if (state[`${key}Id`] !== action.meta.requestId) return
          state[`${key}Loading`] = false
          state[`${key}Id`] = null
          state[`${key}Error`] =
            action.payload?.message || 'Unable to load sales. Please try again.'
        })
    }
    builder.addMatcher(
      (action) =>
        isAnyOf(login.pending, logout.fulfilled, sessionExpired)(action) ||
        (restoreSession.rejected.match(action) &&
          [401, 403].includes(action.payload?.status)),
      () => initialState,
    )
  },
})
export const { clearSaleDetails } = salesSlice.actions
export default salesSlice.reducer
