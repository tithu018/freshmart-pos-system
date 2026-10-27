import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { peopleService } from '../../services/peopleService.js'
import { login, logout, restoreSession, sessionExpired } from './authSlice.js'

function request(name, operation) {
  return createAsyncThunk(`people/${name}`, async (input, api) => {
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
export const loadEmployees = request('employees', peopleService.employees)
export const loadCustomers = request('customers', peopleService.customers)
export const loadCustomerOptions = request('lookup', peopleService.lookup)
export const loadCustomerHistory = request('history', peopleService.history)
export const savePerson = request('save', peopleService.save)
const initialState = Object.fromEntries(
  ['employees', 'customers', 'lookup', 'history', 'save'].flatMap((key) => [
    [key, null],
    [`${key}Loading`, false],
    [`${key}Error`, null],
    [`${key}Id`, null],
  ]),
)
const slice = createSlice({
  name: 'people',
  initialState,
  reducers: {
    clearHistory: (state) => {
      state.history = null
      state.historyId = null
      state.historyError = null
      state.historyLoading = false
    },
  },
  extraReducers: (builder) => {
    for (const [key, thunk] of [
      ['employees', loadEmployees],
      ['customers', loadCustomers],
      ['lookup', loadCustomerOptions],
      ['history', loadCustomerHistory],
      ['save', savePerson],
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
          if (key === 'save') {
            const type = action.meta.arg.type
            state[type] = null
            state[`${type}Id`] = null
            state[`${type}Loading`] = false
            state.lookup = null
            state.lookupId = null
            state.lookupLoading = false
          }
        })
        .addCase(thunk.rejected, (state, action) => {
          if (state[`${key}Id`] !== action.meta.requestId) return
          state[`${key}Loading`] = false
          state[`${key}Id`] = null
          state[`${key}Error`] =
            action.payload?.message ||
            'Unable to load people. Please try again.'
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
export const { clearHistory } = slice.actions
export default slice.reducer
