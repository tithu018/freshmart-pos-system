import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { configureStore } from '@reduxjs/toolkit'
import auth, {
  sessionExpired,
  restoreSession,
} from '../src/store/slices/authSlice.js'
import inventory, {
  loadInventory,
  adjustInventory,
  setStockThreshold,
  loadStockHistory,
  selectLowStock,
  selectInventorySummary,
} from '../src/store/slices/inventorySlice.js'
import { catalogClient } from '../src/services/catalogApi.js'

const adapter = catalogClient.defaults.adapter
afterEach(() => {
  catalogClient.defaults.adapter = adapter
})
const store = () => configureStore({ reducer: { auth, inventory } })
const product = { id: 'p1', name: 'Apple', stock: 5, minStock: 10, price: 2.5 }
function respond(handler) {
  catalogClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: await handler(config),
  })
}
function fail(status, message) {
  throw { response: { status, data: { message } } }
}

test('inventory starts empty and derives stock alerts and summary from API records', async () => {
  const state = store()
  assert.deepEqual(state.getState().inventory.items, [])
  respond(() => [product, { ...product, id: 'p2', stock: 0, minStock: 0 }])
  await state.dispatch(loadInventory()).unwrap()
  assert.equal(selectLowStock(state.getState()).length, 2)
  assert.deepEqual(selectInventorySummary(state.getState()), {
    units: 5,
    value: 12.5,
    lowStock: 1,
    outOfStock: 1,
  })
})

test('stock changes send a delta with CSRF and only apply server-confirmed balances', async () => {
  const state = store(),
    requests = []
  respond((config) => {
    requests.push(config)
    if (config.url === '/auth/csrf') return { token: 'csrf' }
    return config.method === 'post' ? { ...product, stock: 8 } : [product]
  })
  await state.dispatch(loadInventory())
  await state
    .dispatch(
      adjustInventory({
        id: 'p1',
        type: 'STOCK_IN',
        quantity: '3',
        reason: 'Delivery',
        stock: 999,
        userId: 'fake',
      }),
    )
    .unwrap()
  const request = requests.find((config) => config.method === 'post')
  assert.equal(request.withCredentials, true)
  assert.equal(request.headers['X-CSRF-TOKEN'], 'csrf')
  assert.deepEqual(JSON.parse(request.data), {
    type: 'STOCK_IN',
    quantity: 3,
    reason: 'Delivery',
  })
  assert.equal(state.getState().inventory.items[0].stock, 8)
})

test('insufficient stock preserves the prior balance and surfaces the API error', async () => {
  const state = store()
  respond(() => [product])
  await state.dispatch(loadInventory())
  respond((config) =>
    config.url === '/auth/csrf'
      ? { token: 'csrf' }
      : fail(409, 'Only 5 units are available.'),
  )
  await assert.rejects(
    state
      .dispatch(
        adjustInventory({
          id: 'p1',
          type: 'STOCK_OUT',
          quantity: 6,
          reason: 'Damage',
        }),
      )
      .unwrap(),
    { message: 'Only 5 units are available.' },
  )
  assert.equal(state.getState().inventory.items[0].stock, 5)
  assert.equal(state.getState().inventory.saving, false)
})

test('saving thresholds immediately updates low-stock alerts without changing quantity', async () => {
  const state = store()
  respond(() => [product])
  await state.dispatch(loadInventory())
  respond((config) =>
    config.url === '/auth/csrf'
      ? { token: 'csrf' }
      : { ...product, minStock: 5 },
  )
  await state.dispatch(setStockThreshold({ id: 'p1', minStock: 5 })).unwrap()
  assert.equal(selectLowStock(state.getState()).length, 0)
  assert.equal(selectInventorySummary(state.getState()).units, 5)
})

test('older loads cannot overwrite an adjustment and old history cannot replace a new selection', () => {
  const state = store()
  state.dispatch(loadInventory.pending('old'))
  state.dispatch(adjustInventory.pending('adjust'))
  state.dispatch(adjustInventory.fulfilled({ ...product, stock: 8 }, 'adjust'))
  state.dispatch(loadInventory.fulfilled([product], 'old'))
  assert.equal(state.getState().inventory.items[0].stock, 8)
  state.dispatch(loadStockHistory.pending('old-history'))
  state.dispatch(loadStockHistory.pending('new-history'))
  state.dispatch(
    loadStockHistory.fulfilled([{ id: 'new-movement' }], 'new-history'),
  )
  state.dispatch(
    loadStockHistory.fulfilled([{ id: 'old-movement' }], 'old-history'),
  )
  assert.equal(state.getState().inventory.history[0].id, 'new-movement')
})

test('session expiry clears inventory and ignores late responses', () => {
  const state = store()
  state.dispatch(loadInventory.pending('old'))
  state.dispatch(loadStockHistory.pending('old-history'))
  state.dispatch(sessionExpired())
  state.dispatch(loadInventory.fulfilled([product], 'old'))
  state.dispatch(loadStockHistory.fulfilled([{ id: 'm1' }], 'old-history'))
  assert.deepEqual(state.getState().inventory.items, [])
  assert.deepEqual(state.getState().inventory.history, [])
})

test('catalog refresh supersedes an older inventory request', async () => {
  const state = store()
  state.dispatch(loadInventory.pending('old-catalog'))
  respond(() => [product])
  await state.dispatch(loadInventory(true)).unwrap()
  state.dispatch(loadInventory.fulfilled([], 'old-catalog'))
  assert.equal(state.getState().inventory.items[0].id, product.id)
})

test('network failures allow retry and 401 responses use the existing session-expired handling', async () => {
  const state = store()
  respond(() => fail(503, 'Inventory temporarily unavailable.'))
  await state.dispatch(loadInventory())
  assert.equal(
    state.getState().inventory.error,
    'Inventory temporarily unavailable.',
  )
  respond(() => [product])
  await state.dispatch(loadInventory())
  assert.equal(state.getState().inventory.error, null)
  state.dispatch(restoreSession.pending('auth'))
  state.dispatch(
    restoreSession.fulfilled({ user: { id: 'admin', role: 'admin' } }, 'auth'),
  )
  respond(() => fail(401, 'Sign in again.'))
  await state.dispatch(loadInventory())
  assert.equal(state.getState().auth.user, null)
  assert.deepEqual(state.getState().inventory.items, [])
})
