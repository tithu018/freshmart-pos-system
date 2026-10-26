import { configureStore } from '@reduxjs/toolkit'
import auth from './slices/authSlice'
import products from './slices/productSlice'
import cart from './slices/cartSlice'
import sales from './slices/salesSlice'
import management from './slices/managementSlice'
import catalog from './slices/catalogSlice'

export const store = configureStore({
  reducer: { auth, products, cart, sales, management, catalog },
})
