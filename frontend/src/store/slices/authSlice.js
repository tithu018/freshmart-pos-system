import { createSlice } from '@reduxjs/toolkit'
import { demoUsers } from '../../data/mockData'

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null },
  reducers: {
    demoLogin: (state, { payload }) => {
      state.user = { ...demoUsers[payload] }
    },
    logout: (state) => {
      state.user = null
    },
    updateProfile: (state, { payload }) => {
      if (state.user) Object.assign(state.user, payload)
    },
  },
})
export const { demoLogin, logout, updateProfile } = authSlice.actions
export default authSlice.reducer
