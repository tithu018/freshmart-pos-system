import { createSlice } from '@reduxjs/toolkit'
import { logout } from './authSlice'

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] },
  reducers: {
    addItem: (state, { payload }) => {
      const existing = state.items.find((item) => item.id === payload.id)
      if (existing && existing.quantity < payload.stock) existing.quantity += 1
      else if (!existing && payload.stock > 0)
        state.items.push({ ...payload, quantity: 1 })
    },
    changeQuantity: (state, { payload }) => {
      if (payload.stock < 1) {
        state.items = state.items.filter((item) => item.id !== payload.id)
        return
      }
      const item = state.items.find((item) => item.id === payload.id)
      if (item)
        item.quantity = Math.min(Math.max(1, payload.quantity), payload.stock)
    },
    removeItem: (state, { payload }) => {
      state.items = state.items.filter((item) => item.id !== payload)
    },
    clearCart: (state) => {
      state.items = []
    },
  },
  extraReducers: (builder) =>
    builder.addCase(logout, (state) => {
      state.items = []
    }),
})
export const { addItem, changeQuantity, removeItem, clearCart } =
  cartSlice.actions
export default cartSlice.reducer
