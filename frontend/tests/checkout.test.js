import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { configureStore } from '@reduxjs/toolkit'
import auth, {
  restoreSession,
  sessionExpired,
} from '../src/store/slices/authSlice.js'
import inventory from '../src/store/slices/inventorySlice.js'
import cart, {
  addItem,
  changeQuantity,
  removeItem,
  clearCart,
  loadPOS,
  setDiscount,
  setPayment,
  setCustomer,
  submitCheckout,
  restoreCheckout,
  calculateTotals,
} from '../src/store/slices/cartSlice.js'
import { catalogClient } from '../src/services/catalogApi.js'
import { readPendingCheckout } from '../src/services/checkoutService.js'

const adapter = catalogClient.defaults.adapter
const product = {
  id: 'p1',
  name: 'Apples',
  sku: 'APL',
  barcode: '123',
  price: 2.5,
  stock: 10,
}
const sale = { id: 'sale-1', total: 6.99, items: [], payment: 'CASH' }
let storage
beforeEach(() => {
  storage = new Map()
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  })
})
afterEach(() => {
  catalogClient.defaults.adapter = adapter
  delete globalThis.sessionStorage
})
function store() {
  const state = configureStore({ reducer: { auth, inventory, cart } })
  state.dispatch(restoreSession.pending('auth'))
  state.dispatch(
    restoreSession.fulfilled({ user: { id: 'u1', role: 'cashier' } }, 'auth'),
  )
  return state
}
function respond(checkout = () => sale) {
  catalogClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data:
      config.url === '/auth/csrf'
        ? { token: 'csrf' }
        : config.url === '/pos/config'
          ? { taxRate: 7.5, maxTotal: 1000000000 }
          : config.url === '/checkout'
            ? await checkout(config)
            : [product],
  })
}
const fail = (status, message) => {
  throw { response: { status, data: { message } } }
}

test('POS starts empty, loads actual product prices/stock and supports cart changes', async () => {
  const state = store()
  respond()
  assert.deepEqual(state.getState().cart.products, [])
  await state.dispatch(loadPOS()).unwrap()
  assert.equal(state.getState().cart.products[0].barcode, '123')
  state.dispatch(addItem(product))
  state.dispatch(addItem(product))
  assert.equal(state.getState().cart.items[0].quantity, 2)
  state.dispatch(changeQuantity({ id: 'p1', quantity: 100, stock: 10 }))
  assert.equal(state.getState().cart.items[0].quantity, 10)
  state.dispatch(changeQuantity({ id: 'p1', quantity: 9, stock: 10 }))
  assert.equal(state.getState().cart.items[0].quantity, 9)
  state.dispatch(removeItem('p1'))
  assert.deepEqual(state.getState().cart.items, [])
  state.dispatch(addItem({ ...product, stock: 0 }))
  assert.deepEqual(state.getState().cart.items, [])
})

test('optional customer is included in checkout and cleared after success; guests omit it', async () => {
  const state = store()
  let body
  respond(config => { body = JSON.parse(config.data); return { ...sale, customerId: 'c1' } })
  state.dispatch(addItem(product))
  state.dispatch(setCustomer({ id: 'c1', name: 'Customer', phone: '0771234567' }))
  await state.dispatch(submitCheckout()).unwrap()
  assert.equal(body.customerId, 'c1')
  assert.equal(state.getState().cart.customer, null)
  assert.equal(state.getState().cart.receipt.customerId, 'c1')
  state.dispatch(addItem(product))
  await state.dispatch(submitCheckout()).unwrap()
  assert.equal('customerId' in body, false)
})

test('pending customer selection is frozen and restored with the identical retry payload', async () => {
  const state = store()
  const requests = []
  let first = true
  respond(config => { requests.push(config.data); if (first) throw new Error('lost response'); return sale })
  state.dispatch(addItem(product))
  state.dispatch(setCustomer({ id: 'c1', name: 'Customer' }))
  await state.dispatch(submitCheckout())
  state.dispatch(setCustomer({ id: 'c2', name: 'Other' }))
  assert.equal(state.getState().cart.customer.id, 'c1')
  const snapshot = readPendingCheckout('u1')
  assert.equal(snapshot.request.customerId, 'c1')
  const restored = store()
  restored.dispatch(restoreCheckout(snapshot))
  assert.equal(restored.getState().cart.customer.name, 'Customer')
  first = false
  await restored.dispatch(submitCheckout()).unwrap()
  assert.equal(requests[0], requests[1])
})
test('totals use a fixed amount discount before tax and round half-up to cents', () => {
  assert.deepEqual(
    calculateTotals([{ ...product, quantity: 3 }], '1.00', 7.5),
    { subtotal: 7.5, discount: 1, tax: 0.49, total: 6.99 },
  )
  assert.equal(calculateTotals([{ price: 0.1, quantity: 3 }], '', 0).total, 0.3)
  assert.equal(calculateTotals([{ price: 0.1, quantity: 1 }], '', 5).tax, 0.01)
})
test('checkout uses Axios cookies/CSRF, sends expected prices and takes server totals', async () => {
  const state = store()
  let request
  respond((config) => {
    request = config
    return sale
  })
  await state.dispatch(loadPOS())
  state.dispatch(addItem(product))
  state.dispatch(setDiscount('1'))
  state.dispatch(setPayment('CARD'))
  await state.dispatch(submitCheckout()).unwrap()
  const body = JSON.parse(request.data)
  assert.match(body.idempotencyKey, /^[a-f0-9-]{36}$/)
  assert.deepEqual(body.items, [
    { productId: 'p1', quantity: 1, expectedUnitPrice: 2.5 },
  ])
  assert.equal(body.payment, 'CARD')
  assert.equal(body.discount, 1)
  assert.equal(body.expectedTaxRate, 7.5)
  assert.equal(request.withCredentials, true)
  assert.equal(request.headers['X-CSRF-TOKEN'], 'csrf')
  assert.equal(state.getState().cart.receipt.total, 6.99)
  assert.deepEqual(state.getState().cart.items, [])
  assert.equal(readPendingCheckout('u1'), null)
})
test('insufficient stock retains the cart and exposes the backend error', async () => {
  const state = store()
  respond(() => fail(409, 'Only 1 unit available.'))
  state.dispatch(addItem(product))
  await assert.rejects(state.dispatch(submitCheckout()).unwrap(), {
    message: 'Only 1 unit available.',
  })
  assert.equal(state.getState().cart.items.length, 1)
  assert.equal(state.getState().cart.attempt, null)
  assert.equal(state.getState().cart.receipt, null)
})
test('an unknown outcome freezes edits and retry reuses the exact original request', async () => {
  const state = store(),
    requests = []
  let failed = true
  respond((config) => {
    requests.push(config.data)
    if (failed) throw new Error('lost response')
    return sale
  })
  state.dispatch(addItem(product))
  state.dispatch(setDiscount('1'))
  await state.dispatch(submitCheckout())
  assert(state.getState().cart.attempt)
  state.dispatch(addItem(product))
  state.dispatch(clearCart())
  state.dispatch(setDiscount('0'))
  state.dispatch(setPayment('CARD'))
  assert.equal(state.getState().cart.items[0].quantity, 1)
  assert.equal(state.getState().cart.discount, '1')
  failed = false
  await state.dispatch(submitCheckout()).unwrap()
  assert.equal(requests.length, 2)
  assert.equal(requests[0], requests[1])
  assert.equal(state.getState().cart.attempt, null)
})
test('refresh recovery retains the key, payment, discount and price snapshots for the same user', async () => {
  const first = store()
  respond(() => {
    throw new Error('timeout')
  })
  first.dispatch(addItem(product))
  first.dispatch(setPayment('CARD'))
  await first.dispatch(submitCheckout())
  const saved = readPendingCheckout('u1')
  assert(saved)
  assert.equal(readPendingCheckout('different-user'), null)
  const restored = store()
  restored.dispatch(restoreCheckout(saved))
  let request
  respond((config) => {
    request = JSON.parse(config.data)
    return sale
  })
  await restored.dispatch(loadPOS())
  await restored.dispatch(submitCheckout()).unwrap()
  assert.deepEqual(request, saved.request)
  assert.equal(restored.getState().cart.receipt.id, sale.id)
})
test('rapid double submission sends only one HTTP checkout', async () => {
  const state = store()
  let resolve,
    calls = 0
  respond(async () => {
    calls++
    return new Promise((done) => {
      resolve = done
    })
  })
  state.dispatch(addItem(product))
  const first = state.dispatch(submitCheckout())
  const second = await state.dispatch(submitCheckout())
  assert.equal(second.meta.condition, true)
  while (!resolve) await new Promise((done) => setImmediate(done))
  resolve(sale)
  await first.unwrap()
  assert.equal(calls, 1)
})
test('expired session clears visible cart but retains pending recovery for reauthentication', async () => {
  const state = store()
  respond(() => fail(401, 'Sign in again.'))
  state.dispatch(addItem(product))
  await state.dispatch(submitCheckout())
  assert.equal(state.getState().auth.user, null)
  assert.deepEqual(state.getState().cart.items, [])
  assert.equal(state.getState().cart.receipt, null)
  assert(readPendingCheckout('u1'))
})
test('late responses after session expiry cannot restore products or show another users receipt', () => {
  const state = store()
  state.dispatch(loadPOS.pending('old-load'))
  state.dispatch(submitCheckout.pending('old-sale'))
  state.dispatch(sessionExpired())
  state.dispatch(
    loadPOS.fulfilled(
      { products: [product], config: { taxRate: 0 } },
      'old-load',
    ),
  )
  state.dispatch(submitCheckout.fulfilled(sale, 'old-sale'))
  assert.deepEqual(state.getState().cart.products, [])
  assert.equal(state.getState().cart.receipt, null)
})
test('unavailable session storage prevents checkout before sending a sale', async () => {
  const state = store()
  let calls = 0
  globalThis.sessionStorage.setItem = () => {
    throw new Error('storage blocked')
  }
  respond(() => {
    calls++
    return sale
  })
  state.dispatch(addItem(product))
  await state.dispatch(submitCheckout())
  assert.equal(calls, 0)
  assert.match(state.getState().cart.error, /session storage/)
})

test('a CSRF rejection during retry retains the original uncertain checkout key', async () => {
  const state = store()
  respond(() => {
    throw new Error('response lost')
  })
  state.dispatch(addItem(product))
  await state.dispatch(submitCheckout())
  const original = readPendingCheckout('u1')
  respond(() => fail(403, 'Your sign-in form expired. Please try again.'))
  await state.dispatch(submitCheckout())
  assert.deepEqual(state.getState().cart.attempt.request, original.request)
  assert.deepEqual(readPendingCheckout('u1'), original)
  respond(() => sale)
  await state.dispatch(submitCheckout()).unwrap()
  assert.equal(state.getState().cart.receipt.id, sale.id)
})

test('a late unauthorized response from an old checkout cannot sign out another user', async () => {
  const state = store()
  let reject
  respond(
    () =>
      new Promise((_, failRequest) => {
        reject = failRequest
      }),
  )
  state.dispatch(addItem(product))
  const pending = state.dispatch(submitCheckout())
  while (!reject) await new Promise((done) => setImmediate(done))
  state.dispatch(sessionExpired())
  state.dispatch(restoreSession.pending('new-auth'))
  state.dispatch(
    restoreSession.fulfilled({ user: { id: 'u2', role: 'admin' } }, 'new-auth'),
  )
  reject({
    response: { status: 401, data: { message: 'Old session expired' } },
  })
  await pending
  assert.equal(state.getState().auth.user.id, 'u2')
  assert.deepEqual(state.getState().cart.items, [])
})
