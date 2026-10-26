import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { configureStore } from '@reduxjs/toolkit'
import auth, {
  restoreSession,
  sessionExpired,
} from '../src/store/slices/authSlice.js'
import sales, {
  loadSales,
  loadRecentSales,
  loadSaleDetails,
  loadSalesCashiers,
  clearSaleDetails,
} from '../src/store/slices/salesSlice.js'
import { catalogClient } from '../src/services/catalogApi.js'
import { salesPeriod, salesDate, paymentLabel } from '../src/utils/sales.js'

const adapter = catalogClient.defaults.adapter
afterEach(() => {
  catalogClient.defaults.adapter = adapter
})
const page = {
  content: [{ id: 'sale-1', total: 2.5, quantity: 1, userId: 'u1' }],
  page: 0,
  size: 10,
  totalElements: 20,
  totalPages: 2,
  summary: { orders: 20, revenue: 50, average: 2.5, units: 20 },
  timeZone: 'Asia/Colombo',
}
function store() {
  const state = configureStore({ reducer: { auth, sales } })
  state.dispatch(restoreSession.pending('auth'))
  state.dispatch(
    restoreSession.fulfilled({ user: { id: 'u1', role: 'cashier' } }, 'auth'),
  )
  return state
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
function fail(status, message) {
  throw { response: { status, data: { message } } }
}

test('sales start without mocks and send filters, pagination and sorting to the API', async () => {
  const state = store()
  let request
  assert.equal(state.getState().sales.list, null)
  respond((config) => {
    request = config
    return page
  })
  await state
    .dispatch(
      loadSales({
        q: 'abc',
        from: '2026-10-26',
        to: '',
        payment: 'CARD',
        cashierId: '',
        page: 2,
        size: 25,
        sort: 'total',
        direction: 'asc',
      }),
    )
    .unwrap()
  assert.equal(request.url, '/sales')
  assert.equal(request.withCredentials, true)
  assert.deepEqual(request.params, {
    q: 'abc',
    from: '2026-10-26',
    payment: 'CARD',
    page: 2,
    size: 25,
    sort: 'total',
    direction: 'asc',
  })
  assert.equal(state.getState().sales.list.summary.revenue, 50)
  assert.equal(state.getState().sales.list.totalElements, 20)
  assert.equal(state.getState().sales.list.content.length, 1)
})
test('detail request uses the backend snapshot, and a forbidden record never leaves old receipt data visible', async () => {
  const state = store()
  let path
  const details = {
    sale: {
      id: 'sale-1',
      items: [{ name: 'Historical apples', price: 2.5 }],
      discount: 1,
      tax: 0.49,
      total: 6.99,
    },
    storeName: 'FreshMart',
    timeZone: 'Asia/Colombo',
  }
  respond((config) => {
    path = config.url
    return details
  })
  await state.dispatch(loadSaleDetails('sale-1')).unwrap()
  assert.equal(path, '/sales/sale-1')
  assert.equal(
    state.getState().sales.details.sale.items[0].name,
    'Historical apples',
  )
  respond(() => fail(404, 'Sale not found.'))
  const result = state.dispatch(loadSaleDetails('someone-else'))
  assert.equal(state.getState().sales.details, null)
  await result
  assert.equal(state.getState().sales.details, null)
  assert.equal(state.getState().sales.detailsError, 'Sale not found.')
})
test('new filters supersede older requests and closing details ignores late responses', () => {
  const state = store()
  state.dispatch(loadSales.pending('old'))
  state.dispatch(loadSales.pending('new'))
  state.dispatch(loadSales.fulfilled(page, 'new'))
  state.dispatch(loadSales.fulfilled({ content: [] }, 'old'))
  assert.equal(state.getState().sales.list.totalElements, 20)
  state.dispatch(loadSaleDetails.pending('detail'))
  state.dispatch(clearSaleDetails())
  state.dispatch(
    loadSaleDetails.fulfilled({ sale: { id: 'hidden' } }, 'detail'),
  )
  assert.equal(state.getState().sales.details, null)
})
test('dashboard recent requests and history filters maintain independent results', async () => {
  const state = store()
  respond((config) => ({ ...page, size: config.params.size }))
  await state.dispatch(loadSales({ size: 10 }))
  await state.dispatch(loadRecentSales({ size: 4, from: '2026-10-26' }))
  assert.equal(state.getState().sales.list.size, 10)
  assert.equal(state.getState().sales.recent.size, 4)
})
test('cashier options are loaded from their API and permission errors do not log the user out', async () => {
  const state = store()
  let path
  respond((config) => {
    path = config.url
    return [{ id: 'cashier', name: 'Former cashier' }]
  })
  await state.dispatch(loadSalesCashiers())
  assert.equal(path, '/sales/cashiers')
  assert.equal(state.getState().sales.cashiers[0].name, 'Former cashier')
  respond(() => fail(403, 'Forbidden'))
  await state.dispatch(loadSalesCashiers())
  assert.deepEqual(state.getState().sales.cashiers, [])
  assert.equal(state.getState().auth.user.id, 'u1')
})
test('session expiry clears all sales and ignores responses from the old session', () => {
  const state = store()
  state.dispatch(loadSales.pending('list'))
  state.dispatch(loadRecentSales.pending('recent'))
  state.dispatch(loadSaleDetails.pending('details'))
  state.dispatch(loadSalesCashiers.pending('cashiers'))
  state.dispatch(sessionExpired())
  state.dispatch(loadSales.fulfilled(page, 'list'))
  state.dispatch(loadRecentSales.fulfilled(page, 'recent'))
  state.dispatch(loadSaleDetails.fulfilled({ sale: {} }, 'details'))
  state.dispatch(loadSalesCashiers.fulfilled([{ id: 'other' }], 'cashiers'))
  assert.equal(state.getState().sales.list, null)
  assert.equal(state.getState().sales.recent, null)
  assert.equal(state.getState().sales.details, null)
  assert.deepEqual(state.getState().sales.cashiers, [])
})
test('network errors support retry and current-session 401 responses clear authentication', async () => {
  const state = store()
  respond(() => fail(503, 'Sales unavailable.'))
  await state.dispatch(loadSales({}))
  assert.equal(state.getState().sales.listError, 'Sales unavailable.')
  respond(() => page)
  await state.dispatch(loadSales({}))
  assert.equal(state.getState().sales.listError, null)
  respond(() => fail(401, 'Sign in again.'))
  await state.dispatch(loadSaleDetails('sale-1'))
  assert.equal(state.getState().auth.user, null)
  assert.equal(state.getState().sales.list, null)
})
test('shop date filters and receipt dates agree even across UTC midnight and week boundaries', () => {
  const instant = new Date('2026-10-25T18:30:00Z')
  assert.deepEqual(salesPeriod('today', 'Asia/Colombo', instant), {
    from: '2026-10-26',
    to: '2026-10-26',
  })
  assert.deepEqual(
    salesPeriod('week', 'Asia/Colombo', new Date('2026-10-24T20:00:00Z')),
    { from: '2026-10-19', to: '2026-10-25' },
  )
  assert.match(salesDate(instant, 'Asia/Colombo'), /Oct 26, 2026/)
  assert.equal(paymentLabel('CARD'), 'Card (simulated)')
})
