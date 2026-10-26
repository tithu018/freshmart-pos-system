import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { login, logout, sessionExpired, restoreSession } from './authSlice.js'
import { loadInventory } from './inventorySlice.js'
import {
  checkoutService,
  savePendingCheckout,
  clearPendingCheckout,
} from '../../services/checkoutService.js'

export const loadPOS = createAsyncThunk('cart/loadPOS', async (_, api) => {
  const userId = api.getState().auth.user?.id
  try {
    const [products, config] = await Promise.all([
      checkoutService.products(),
      checkoutService.config(),
    ])
    return { products, config }
  } catch (error) {
    if (error.status === 401 && api.getState().auth.user?.id === userId)
      api.dispatch(sessionExpired())
    return api.rejectWithValue({ message: error.message })
  }
})

export const submitCheckout = createAsyncThunk(
  'cart/checkout',
  async (_, api) => {
    const state = api.getState(),
      userId = state.auth.user.id,
      cart = state.cart
    const snapshot = cart.attempt || {
      items: cart.items.map((item) => ({ ...item })),
      request: {
        idempotencyKey: crypto.randomUUID(),
        items: cart.items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          expectedUnitPrice: item.price,
        })),
        discount: Number(cart.discount || 0),
        expectedTaxRate: cart.taxRate,
        payment: cart.payment,
      },
    }
    try {
      savePendingCheckout(userId, snapshot)
      api.dispatch(restoreCheckout(snapshot))
      const result = await checkoutService.checkout(snapshot.request)
      clearPendingCheckout(userId)
      if (api.getState().auth.user?.id === userId) {
        api.dispatch(loadInventory(true))
        api.dispatch(loadPOS())
      }
      return result
    } catch (error) {
      // A CSRF/access rejection on a retry cannot resolve an earlier lost response.
      const uncertain =
        !error.status || error.status >= 500 || error.status === 403
      if (!uncertain && error.status !== 401) clearPendingCheckout(userId)
      if (api.getState().auth.user?.id === userId) {
        if (error.status === 401) api.dispatch(sessionExpired())
        else if (!uncertain) api.dispatch(loadPOS())
      }
      return api.rejectWithValue({ message: error.message, uncertain })
    }
  },
  {
    condition: (_, { getState }) => {
      const { cart, auth } = getState()
      return (
        !!auth.user &&
        !cart.submitting &&
        (cart.items.length > 0 || !!cart.attempt)
      )
    },
  },
)

const initialState = {
  items: [],
  products: [],
  taxRate: 0,
  maxTotal: 1000000000,
  discount: '',
  payment: 'CASH',
  loaded: false,
  loading: false,
  loadId: null,
  loadError: null,
  submitting: false,
  checkoutId: null,
  attempt: null,
  receipt: null,
  error: null,
}
const locked = (state) => state.submitting || !!state.attempt
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, { payload }) => {
      if (locked(state)) return
      const existing = state.items.find((item) => item.id === payload.id)
      if (existing && existing.quantity < Math.min(payload.stock, 1000000))
        existing.quantity += 1
      else if (!existing && payload.stock > 0 && state.items.length < 100)
        state.items.push({ ...payload, quantity: 1 })
    },
    changeQuantity: (state, { payload }) => {
      if (locked(state) || !Number.isInteger(payload.quantity)) return
      const item = state.items.find((item) => item.id === payload.id)
      if (item)
        item.quantity = Math.min(
          Math.max(1, payload.quantity),
          Math.max(1, payload.stock),
          1000000,
        )
    },
    removeItem: (state, { payload }) => {
      if (!locked(state))
        state.items = state.items.filter((item) => item.id !== payload)
    },
    clearCart: (state) => {
      if (!locked(state)) {
        state.items = []
        state.discount = ''
        state.error = null
      }
    },
    setDiscount: (state, { payload }) => {
      if (!locked(state)) state.discount = payload
    },
    setPayment: (state, { payload }) => {
      if (!locked(state)) state.payment = payload
    },
    dismissReceipt: (state) => {
      state.receipt = null
    },
    restoreCheckout: (state, { payload }) => {
      state.attempt = payload
      state.items = payload.items
      state.discount = String(payload.request.discount)
      state.payment = payload.request.payment
      state.error = null
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(loadPOS.pending, (state, action) => {
        state.loading = true
        state.loadError = null
        state.loadId = action.meta.requestId
      })
      .addCase(loadPOS.fulfilled, (state, action) => {
        if (state.loadId !== action.meta.requestId) return
        state.products = action.payload.products
        state.taxRate = action.payload.config.taxRate
        state.maxTotal = action.payload.config.maxTotal
        state.loaded = true
        state.loading = false
        state.loadId = null
        if (!locked(state))
          state.items = state.items.map((item) => ({
            ...item,
            ...state.products.find((p) => p.id === item.id),
            quantity: item.quantity,
          }))
      })
      .addCase(loadPOS.rejected, (state, action) => {
        if (state.loadId !== action.meta.requestId) return
        state.loading = false
        state.loadId = null
        state.loadError = action.payload?.message || 'Unable to load products.'
      })
      .addCase(submitCheckout.pending, (state, action) => {
        state.submitting = true
        state.checkoutId = action.meta.requestId
        state.error = null
      })
      .addCase(submitCheckout.fulfilled, (state, action) => {
        if (state.checkoutId !== action.meta.requestId) return
        state.receipt = action.payload
        state.items = []
        state.discount = ''
        state.attempt = null
        state.submitting = false
        state.checkoutId = null
        state.error = null
      })
      .addCase(submitCheckout.rejected, (state, action) => {
        if (state.checkoutId !== action.meta.requestId) return
        state.submitting = false
        state.checkoutId = null
        state.error = action.payload?.message || 'Unable to complete checkout.'
        if (!action.payload?.uncertain) state.attempt = null
      })
      .addMatcher(
        (action) =>
          isAnyOf(login.pending, logout.fulfilled, sessionExpired)(action) ||
          (restoreSession.rejected.match(action) &&
            [401, 403].includes(action.payload?.status)),
        () => initialState,
      ),
})
export const {
  addItem,
  changeQuantity,
  removeItem,
  clearCart,
  setDiscount,
  setPayment,
  dismissReceipt,
  restoreCheckout,
} = cartSlice.actions
export default cartSlice.reducer

export function calculateTotals(items, discount, taxRate) {
  const subtotalCents = items.reduce(
    (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
    0,
  )
  const discountCents = Math.round(Number(discount || 0) * 100)
  const rateBasisPoints = Math.round(taxRate * 100)
  const taxCents = Math.floor(
    ((subtotalCents - discountCents) * rateBasisPoints + 5000) / 10000,
  )
  return {
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    tax: taxCents / 100,
    total: (subtotalCents - discountCents + taxCents) / 100,
  }
}
