import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { configureStore } from '@reduxjs/toolkit'
import auth, {
  sessionExpired,
  restoreSession,
} from '../src/store/slices/authSlice.js'
import catalog, {
  loadCatalog,
  saveCatalogProduct,
  saveCatalogCategory,
  deleteCatalogProduct,
} from '../src/store/slices/catalogSlice.js'
import { catalogClient, catalogRequest } from '../src/services/catalogApi.js'

const adapter = catalogClient.defaults.adapter
afterEach(() => {
  catalogClient.defaults.adapter = adapter
})
const store = () => configureStore({ reducer: { auth, catalog } })
const category = {
  id: 'category-1',
  name: 'Fruit',
  description: '',
  status: 'ACTIVE',
  productCount: 0,
}
const product = {
  id: 'product-1',
  name: 'Apple',
  sku: 'APL-001',
  categoryId: category.id,
  category: category.name,
  price: 2.5,
  status: 'ACTIVE',
}
function respond(handler) {
  catalogClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: await handler(config),
  })
}
function fail(status, code, message) {
  throw { response: { status, data: { code, message } } }
}
function signedIn(state) {
  state.dispatch(restoreSession.pending('session'))
  state.dispatch(
    restoreSession.fulfilled(
      { user: { id: 'admin', role: 'admin' }, expiresAt: '2099-01-01' },
      'session',
    ),
  )
}

test('catalog starts empty and loads only API records', async () => {
  const state = store()
  assert.deepEqual(state.getState().catalog.products, [])
  respond((config) => (config.url === '/products' ? [product] : [category]))
  await state.dispatch(loadCatalog()).unwrap()
  assert.equal(state.getState().catalog.products[0].id, product.id)
  assert.equal(state.getState().catalog.loading, false)
})

test('catalog saves use Axios cookies and CSRF, strip stock fields and update category counts', async () => {
  const state = store(),
    requests = []
  respond((config) => {
    requests.push(config)
    if (config.url === '/auth/csrf') return { token: 'csrf-value' }
    if (config.method === 'post') return product
    return config.url === '/products' ? [] : [category]
  })
  await state.dispatch(loadCatalog()).unwrap()
  await state
    .dispatch(
      saveCatalogProduct({
        ...product,
        id: undefined,
        stock: 100,
        minStock: 5,
      }),
    )
    .unwrap()
  const request = requests.find((config) => config.method === 'post')
  assert.equal(request.withCredentials, true)
  assert.equal(request.headers['X-CSRF-TOKEN'], 'csrf-value')
  assert.equal(JSON.parse(request.data).stock, undefined)
  assert.equal(state.getState().catalog.categories[0].productCount, 1)
  respond((config) => (config.url === '/auth/csrf' ? { token: 'csrf' } : null))
  await state.dispatch(deleteCatalogProduct(product.id)).unwrap()
  assert.equal(state.getState().catalog.products.length, 0)
  assert.equal(state.getState().catalog.categories[0].productCount, 0)
})

test('renaming a category updates product labels without changing assignment IDs', async () => {
  const state = store()
  respond((config) => (config.url === '/products' ? [product] : [category]))
  await state.dispatch(loadCatalog())
  respond((config) =>
    config.url === '/auth/csrf'
      ? { token: 'csrf' }
      : { ...category, name: 'Fresh Fruit' },
  )
  await state
    .dispatch(saveCatalogCategory({ ...category, name: 'Fresh Fruit' }))
    .unwrap()
  assert.equal(state.getState().catalog.products[0].category, 'Fresh Fruit')
  assert.equal(state.getState().catalog.products[0].categoryId, category.id)
})

test('failed saves expose server validation and do not insert optimistic records', async () => {
  const state = store()
  respond((config) =>
    config.url === '/auth/csrf'
      ? { token: 'csrf' }
      : fail(409, 'DUPLICATE_SKU', 'This SKU already exists.'),
  )
  await assert.rejects(state.dispatch(saveCatalogProduct(product)).unwrap(), {
    message: 'This SKU already exists.',
  })
  assert.deepEqual(state.getState().catalog.products, [])
  assert.equal(state.getState().catalog.saving, false)
})

test('late catalog responses cannot restore data after session expiry', () => {
  const state = store()
  state.dispatch(loadCatalog.pending('old-load'))
  state.dispatch(saveCatalogProduct.pending('old-save'))
  state.dispatch(sessionExpired())
  state.dispatch(
    loadCatalog.fulfilled(
      { products: [product], categories: [category] },
      'old-load',
    ),
  )
  state.dispatch(saveCatalogProduct.fulfilled(product, 'old-save'))
  assert.deepEqual(state.getState().catalog.products, [])
  assert.equal(state.getState().catalog.saving, false)
})

test('401 clears the existing session while 403 preserves it', async () => {
  const state = store()
  signedIn(state)
  respond(() => fail(403, 'FORBIDDEN', 'Read only.'))
  await state.dispatch(loadCatalog())
  assert.equal(state.getState().auth.user.id, 'admin')
  respond(() => fail(401, 'UNAUTHENTICATED', 'Sign in.'))
  await state.dispatch(loadCatalog())
  assert.equal(state.getState().auth.user, null)
})

test('CSRF expiry retries once with a fresh token and then returns the failure', async () => {
  let reads = 0,
    writes = 0
  respond((config) => {
    if (config.url === '/auth/csrf') return { token: `csrf-${++reads}` }
    writes++
    return fail(403, 'CSRF_INVALID', 'Form expired.')
  })
  await assert.rejects(
    catalogRequest('/categories', { method: 'POST', data: category }),
    { message: 'Form expired.' },
  )
  assert.equal(reads, 2)
  assert.equal(writes, 2)
})
