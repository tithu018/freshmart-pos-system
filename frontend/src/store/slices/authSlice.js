import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { authService } from '../../services/authService.js'
import { peopleService } from '../../services/peopleService.js'

const failure = (error) => ({
  message: error.message,
  status: error.status || 0,
  code: error.code || 'REQUEST_FAILED',
})

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      return await authService.login(credentials)
    } catch (error) {
      return rejectWithValue(failure(error))
    }
  },
  { condition: (_, { getState }) => getState().auth.status !== 'signingIn' },
)

export const restoreSession = createAsyncThunk(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    try {
      return await authService.me()
    } catch (error) {
      return rejectWithValue(failure(error))
    }
  },
  {
    condition: (_, { getState }) =>
      !getState().auth.checking &&
      !getState().auth.profileSaving &&
      !['signingIn', 'signingOut'].includes(getState().auth.status),
  },
)

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout()
    } catch (error) {
      if (error.status !== 401) return rejectWithValue(failure(error))
    }
  },
  { condition: (_, { getState }) => getState().auth.status !== 'signingOut' },
)

const anonymous = (state) => {
  state.user = null
  state.expiresAt = null
  state.status = 'anonymous'
  state.checking = false
  state.profileRequestId = null
  state.profileSaving = false
}

export const saveProfile = createAsyncThunk(
  'auth/saveProfile',
  async (details, api) => {
    const id = api.getState().auth.user?.id
    try {
      return await peopleService.profile(details)
    } catch (error) {
      if (error.status === 401 && api.getState().auth.user?.id === id)
        api.dispatch(sessionExpired())
      return api.rejectWithValue(failure(error))
    }
  },
)

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    expiresAt: null,
    status: 'initializing',
    checking: false,
    requestId: null,
    error: null,
    notice: null,
    profileRequestId: null,
    profileSaving: false,
  },
  reducers: {
    clearAuthFeedback: (state) => {
      state.error = null
      state.notice = null
    },
    sessionExpired: (state) => {
      anonymous(state)
      state.requestId = null
      state.notice = 'Your session has ended. Please sign in again.'
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(saveProfile.pending, (state, action) => {
        state.profileSaving = true
        state.profileRequestId = action.meta.requestId
        state.requestId = null
        state.checking = false
      })
      .addCase(saveProfile.fulfilled, (state, action) => {
        if (
          state.profileRequestId !== action.meta.requestId ||
          state.user?.id !== action.payload.id
        )
          return
        state.profileSaving = false
        state.profileRequestId = null
        state.requestId = null
        state.checking = false
        state.user.name = action.payload.name
        state.user.phone = action.payload.phone
      })
      .addCase(saveProfile.rejected, (state, action) => {
        if (state.profileRequestId !== action.meta.requestId) return
        state.profileSaving = false
        state.profileRequestId = null
      })
      .addCase(login.pending, (state, action) => {
        state.profileRequestId = null
        state.profileSaving = false
        state.status = 'signingIn'
        state.checking = false
        state.requestId = action.meta.requestId
        state.error = null
        state.notice = null
      })
      .addCase(login.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        Object.assign(state, action.payload, {
          status: 'authenticated',
          checking: false,
          error: null,
        })
      })
      .addCase(login.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        anonymous(state)
        state.error =
          action.payload?.message || 'Unable to sign in. Please try again.'
      })
      .addCase(restoreSession.pending, (state, action) => {
        state.checking = true
        state.requestId = action.meta.requestId
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        Object.assign(state, action.payload, {
          status: 'authenticated',
          checking: false,
          error: null,
          notice: null,
        })
      })
      .addCase(restoreSession.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        const hadUser = Boolean(state.user)
        state.checking = false
        if (
          action.payload?.status === 401 ||
          action.payload?.code === 'INVALID_SESSION'
        ) {
          anonymous(state)
          if (hadUser)
            state.notice = 'Your session has ended. Please sign in again.'
        } else if (!hadUser) {
          anonymous(state)
          state.error =
            action.payload?.message || 'Unable to check your session.'
        }
      })
      .addCase(logout.pending, (state, action) => {
        state.profileRequestId = null
        state.profileSaving = false
        state.status = 'signingOut'
        state.checking = false
        state.requestId = action.meta.requestId
        state.error = null
      })
      .addCase(logout.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        anonymous(state)
        state.notice = 'You have been signed out.'
      })
      .addCase(logout.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.status = 'authenticated'
        state.error =
          action.payload?.message || 'Unable to sign out. Please try again.'
      })
  },
})
export const { clearAuthFeedback, sessionExpired } = authSlice.actions
export default authSlice.reducer
