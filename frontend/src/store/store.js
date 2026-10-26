import {
  configureStore,
  createListenerMiddleware,
  isAnyOf,
} from '@reduxjs/toolkit'
import auth from './slices/authSlice'
import products from './slices/productSlice'
import cart from './slices/cartSlice'
import sales from './slices/salesSlice'
import management from './slices/managementSlice'
import catalog from './slices/catalogSlice'
import inventory, { loadInventory } from './slices/inventorySlice'
import {
  saveCatalogProduct,
  deleteCatalogProduct,
  saveCatalogCategory,
} from './slices/catalogSlice'

const inventoryRefresh = createListenerMiddleware()
inventoryRefresh.startListening({
  matcher: isAnyOf(
    saveCatalogProduct.fulfilled,
    deleteCatalogProduct.fulfilled,
    saveCatalogCategory.fulfilled,
  ),
  effect: (_, api) => {
    api.dispatch(loadInventory(true))
  },
})

export const store = configureStore({
  reducer: { auth, products, cart, sales, management, catalog, inventory },
  middleware: (getDefault) => getDefault().prepend(inventoryRefresh.middleware),
})
