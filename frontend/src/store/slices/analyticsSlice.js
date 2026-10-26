import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { analyticsService } from '../../services/analyticsService.js'
import { login, logout, restoreSession, sessionExpired } from './authSlice.js'

function request(name, operation) {
  return createAsyncThunk(`analytics/${name}`, async (input, api) => {
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
export const loadDashboard = request('dashboard', analyticsService.dashboard)
export const loadReport = request('report', analyticsService.report)
export const exportReport = request('csv', analyticsService.csv)
const initialState = Object.fromEntries(
  ['dashboard', 'report', 'csv'].flatMap((key) => [
    [key, null],
    [`${key}Loading`, false],
    [`${key}Error`, null],
    [`${key}Id`, null],
  ]),
)
const slice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    for (const [key, thunk] of [
      ['dashboard', loadDashboard],
      ['report', loadReport],
      ['csv', exportReport],
    ]) {
      builder
        .addCase(thunk.pending, (state, action) => {
          state[key] = null
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
            action.payload?.message ||
            'Unable to load analytics. Please try again.'
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
export default slice.reducer
