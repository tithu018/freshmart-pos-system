import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { productService } from '../../services/productService.js'
import { categoryService } from '../../services/categoryService.js'
import { login, logout, restoreSession, sessionExpired } from './authSlice.js'

const handleFailure = (error, { dispatch, rejectWithValue }) => {
  if (error.status === 401) dispatch(sessionExpired())
  return rejectWithValue({
    message: error.message,
    status: error.status || 0,
    code: error.code,
  })
}
export const loadCatalog = createAsyncThunk(
  'catalog/load',
  async (_, api) => {
    try {
      const [products, categories] = await Promise.all([
        productService.list(),
        categoryService.list(),
      ])
      return { products, categories }
    } catch (error) {
      return handleFailure(error, api)
    }
  },
  {
    condition: (_, { getState }) =>
      !getState().catalog.loading && !getState().catalog.saving,
  },
)

const mutation = (name, action) =>
  createAsyncThunk(
    `catalog/${name}`,
    async (input, api) => {
      try {
        return await action(input)
      } catch (error) {
        return handleFailure(error, api)
      }
    },
    { condition: (_, { getState }) => !getState().catalog.saving },
  )
export const saveCatalogProduct = mutation('saveProduct', productService.save)
export const saveCatalogCategory = mutation(
  'saveCategory',
  categoryService.save,
)
export const deleteCatalogProduct = mutation('deleteProduct', async (id) => {
  await productService.delete(id)
  return id
})
export const deleteCatalogCategory = mutation('deleteCategory', async (id) => {
  await categoryService.delete(id)
  return id
})
const mutations = [
  saveCatalogProduct,
  saveCatalogCategory,
  deleteCatalogProduct,
  deleteCatalogCategory,
]
const initialState = {
  products: [],
  categories: [],
  loading: false,
  saving: false,
  error: null,
  loadId: null,
  mutationId: null,
}
const upsert = (items, item) => {
  const index = items.findIndex((value) => value.id === item.id)
  if (index < 0) items.push(item)
  else items[index] = item
  items.sort((a, b) => a.name.localeCompare(b.name))
}
const recount = (state) => {
  state.categories.forEach((category) => {
    category.productCount = state.products.filter(
      (product) => product.categoryId === category.id,
    ).length
  })
}

export default createSlice({
  name: 'catalog',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCatalog.pending, (state, action) => {
        state.loading = true
        state.error = null
        state.loadId = action.meta.requestId
      })
      .addCase(loadCatalog.fulfilled, (state, action) => {
        if (state.loadId !== action.meta.requestId) return
        Object.assign(state, action.payload, { loading: false, loadId: null })
      })
      .addCase(loadCatalog.rejected, (state, action) => {
        if (state.loadId !== action.meta.requestId) return
        state.loading = false
        state.loadId = null
        state.error = action.payload?.message || 'Unable to load the catalog.'
      })
      .addCase(saveCatalogProduct.fulfilled, (state, action) => {
        if (state.mutationId !== action.meta.requestId) return
        upsert(state.products, action.payload)
        recount(state)
      })
      .addCase(saveCatalogCategory.fulfilled, (state, action) => {
        if (state.mutationId !== action.meta.requestId) return
        upsert(state.categories, action.payload)
        state.products.forEach((product) => {
          if (product.categoryId === action.payload.id)
            product.category = action.payload.name
        })
      })
      .addCase(deleteCatalogProduct.fulfilled, (state, action) => {
        if (state.mutationId !== action.meta.requestId) return
        state.products = state.products.filter(
          (item) => item.id !== action.payload,
        )
        recount(state)
      })
      .addCase(deleteCatalogCategory.fulfilled, (state, action) => {
        if (state.mutationId !== action.meta.requestId) return
        state.categories = state.categories.filter(
          (item) => item.id !== action.payload,
        )
      })
      .addMatcher(
        isAnyOf(...mutations.map((thunk) => thunk.pending)),
        (state, action) => {
          state.saving = true
          state.mutationId = action.meta.requestId
          state.loadId = null
          state.loading = false
        },
      )
      .addMatcher(
        isAnyOf(
          ...mutations.flatMap((thunk) => [thunk.fulfilled, thunk.rejected]),
        ),
        (state, action) => {
          if (state.mutationId !== action.meta.requestId) return
          state.saving = false
          state.mutationId = null
        },
      )
      .addMatcher(
        (action) =>
          isAnyOf(login.pending, logout.fulfilled, sessionExpired)(action) ||
          (restoreSession.rejected.match(action) &&
            [401, 403].includes(action.payload?.status)),
        () => initialState,
      )
  },
}).reducer
