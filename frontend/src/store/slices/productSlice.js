import { createSlice, nanoid } from '@reduxjs/toolkit'
import { products, categories } from '../../data/mockData'

const productSlice = createSlice({
  name: 'products',
  initialState: { items: products, categories },
  reducers: {
    saveProduct: (state, { payload }) => {
      const existing = state.items.find((item) => item.id === payload.id)
      if (existing) Object.assign(existing, payload)
      else state.items.unshift({ ...payload, id: `PRD-${nanoid(6)}` })
    },
    adjustStock: (state, { payload }) => {
      const product = state.items.find((item) => item.id === payload.id)
      if (product) product.stock = Math.max(0, payload.stock)
    },
    reduceStock: (state, { payload }) => {
      payload.forEach((item) => {
        const product = state.items.find((p) => p.id === item.id)
        if (product) product.stock = Math.max(0, product.stock - item.quantity)
      })
    },
    saveCategory: (state, { payload }) => {
      const existing = state.categories.find((item) => item.id === payload.id)
      if (existing) {
        state.items.forEach((product) => {
          if (product.category === existing.name)
            product.category = payload.name
        })
        Object.assign(existing, payload)
      } else state.categories.push({ ...payload, id: `CAT-${nanoid(6)}` })
    },
  },
})
export const { saveProduct, adjustStock, reduceStock, saveCategory } =
  productSlice.actions
export default productSlice.reducer
