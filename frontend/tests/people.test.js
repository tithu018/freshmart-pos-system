import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { configureStore } from '@reduxjs/toolkit'
import auth, { restoreSession, logout, sessionExpired, saveProfile } from '../src/store/slices/authSlice.js'
import people, { loadEmployees, loadCustomers, loadCustomerHistory, loadCustomerOptions, savePerson, clearHistory } from '../src/store/slices/peopleSlice.js'
import { catalogClient } from '../src/services/catalogApi.js'

const adapter = catalogClient.defaults.adapter
afterEach(() => { catalogClient.defaults.adapter = adapter })
function store() {
  const state = configureStore({ reducer: { auth, people } })
  state.dispatch(restoreSession.pending('auth'))
  state.dispatch(restoreSession.fulfilled({ user: { id: 'u1', role: 'admin', email: 'admin@test.com', name: 'Manager', phone: '' } }, 'auth'))
  return state
}
function respond(handler) {
  catalogClient.defaults.adapter = async config => ({ config, status: 200, headers: {}, data: config.url === '/auth/csrf' ? { token: 'csrf' } : await handler(config) })
}
test('employee and customer pages start empty and send server filters and pagination', async () => {
  const state = store()
  assert.equal(state.getState().people.employees, null)
  respond(config => {
    assert.equal(config.withCredentials, true)
    assert.deepEqual(config.params, { q: 'alex', role: 'ADMIN', enabled: 'true', page: 2, size: 10 })
    return { content: [{ id: 'one' }], totalElements: 21, summary: { total: 21, active: 20 } }
  })
  await state.dispatch(loadEmployees({ q: 'alex', role: 'ADMIN', enabled: 'true', page: 2, size: 10 })).unwrap()
  assert.equal(state.getState().people.employees.totalElements, 21)
  respond(config => { assert.equal(config.url, '/admin/customers'); assert.deepEqual(config.params, { page: 0 }); return { content: [], summary: { spending: 6.99 } } })
  await state.dispatch(loadCustomers({ q: '', enabled: '', page: 0 })).unwrap()
  assert.equal(state.getState().people.customers.summary.spending, 6.99)
})
test('employee creation uses CSRF and stores only returned account details', async () => {
  const state = store()
  respond(config => {
    assert.equal(config.url, '/admin/employees')
    assert.equal(config.method, 'post')
    assert.equal(config.headers['X-CSRF-TOKEN'], 'csrf')
    assert.deepEqual(JSON.parse(config.data), { name: 'Cashier', email: 'cashier@test.com', phone: '', role: 'CASHIER', enabled: true, password: 'New-Password123' })
    return { id: 'new', name: 'Cashier', role: 'CASHIER', enabled: true }
  })
  await state.dispatch(savePerson({ type: 'employees', person: { name: ' Cashier ', email: 'cashier@test.com', phone: '', role: 'CASHIER', enabled: true, password: 'New-Password123', authVersion: 123 } })).unwrap()
  assert.equal(state.getState().people.save.id, 'new')
  assert(!JSON.stringify(state.getState()).includes('New-Password123'))
})
test('customer edits whitelist contact fields and leave spending to the backend', async () => {
  const state = store()
  respond(config => {
    assert.equal(config.method, 'put')
    assert.equal(config.url, '/admin/customers/c1')
    assert.deepEqual(JSON.parse(config.data), { name: 'Customer', phone: '0771234567', email: '', enabled: false })
    return { id: 'c1', spent: 6.99, visits: 1 }
  })
  await state.dispatch(savePerson({ type: 'customers', person: { id: 'c1', name: 'Customer', phone: '0771234567', email: null, enabled: false, spent: 0, visits: 0 } })).unwrap()
  assert.equal(state.getState().people.save.spent, 6.99)
})
test('history and POS lookup are independent and closed histories ignore late responses', async () => {
  const state = store()
  respond(config => config.url.startsWith('/pos/') ? [{ id: 'c1', name: 'Customer' }] : { content: [], summary: { orders: 10, revenue: 6.99 } })
  await state.dispatch(loadCustomerHistory({ id: 'c1', page: 0, size: 5 }))
  await state.dispatch(loadCustomerOptions('Customer'))
  assert.equal(state.getState().people.history.summary.orders, 10)
  assert.equal(state.getState().people.lookup[0].id, 'c1')
  state.dispatch(loadCustomerHistory.pending('old'))
  state.dispatch(clearHistory())
  state.dispatch(loadCustomerHistory.fulfilled({ content: [{ id: 'private' }] }, 'old'))
  assert.equal(state.getState().people.history, null)
})
test('latest search wins and successful mutations invalidate older list requests', () => {
  const state = store()
  state.dispatch(loadEmployees.pending('old'))
  state.dispatch(loadEmployees.pending('new'))
  state.dispatch(loadEmployees.fulfilled({ totalElements: 2 }, 'new'))
  state.dispatch(loadEmployees.fulfilled({ totalElements: 20 }, 'old'))
  assert.equal(state.getState().people.employees.totalElements, 2)
  state.dispatch(loadEmployees.pending('list'))
  state.dispatch(savePerson.pending('save', { type: 'employees' }))
  state.dispatch(savePerson.fulfilled({ id: 'new' }, 'save', { type: 'employees' }))
  state.dispatch(loadEmployees.fulfilled({ totalElements: 0 }, 'list'))
  assert.equal(state.getState().people.employees, null)
})
test('permission and network failures preserve safe state and session expiry clears all people', async () => {
  const state = store()
  respond(() => { throw { response: { status: 403, data: { message: 'Forbidden' } } } })
  await state.dispatch(loadEmployees({}))
  assert.equal(state.getState().people.employeesError, 'Forbidden')
  assert.equal(state.getState().auth.user.id, 'u1')
  respond(() => ({ content: [] }))
  await state.dispatch(loadEmployees({}))
  assert.equal(state.getState().people.employeesError, null)
  state.dispatch(loadCustomerHistory.pending('private'))
  state.dispatch(sessionExpired())
  state.dispatch(loadCustomerHistory.fulfilled({ content: [{ id: 'private' }] }, 'private'))
  assert.equal(state.getState().people.employees, null)
  assert.equal(state.getState().people.history, null)
})
test('profile updates persist through API and never send role or email edits', async () => {
  const state = store()
  respond(config => {
    assert.equal(config.url, '/profile')
    assert.equal(config.headers['X-CSRF-TOKEN'], 'csrf')
    assert.deepEqual(JSON.parse(config.data), { name: 'Updated', phone: '0771234567' })
    return { id: 'u1', name: 'Updated', phone: '0771234567', email: 'other@test.com', role: 'CASHIER' }
  })
  await state.dispatch(saveProfile({ name: ' Updated ', phone: '0771234567', email: 'other@test.com', role: 'cashier' })).unwrap()
  assert.equal(state.getState().auth.user.name, 'Updated')
  assert.equal(state.getState().auth.user.email, 'admin@test.com')
  assert.equal(state.getState().auth.user.role, 'admin')
  respond(() => { throw { response: { status: 503, data: { message: 'Unavailable' } } } })
  await state.dispatch(saveProfile({ name: 'Unsaved', phone: '' }))
  assert.equal(state.getState().auth.user.name, 'Updated')
})
test('late profile saves cannot cancel logout or restore a signed-out user', () => {
  const state = store()
  state.dispatch(saveProfile.pending('profile'))
  state.dispatch(logout.pending('logout'))
  state.dispatch(saveProfile.fulfilled({ id: 'u1', name: 'Late', phone: '' }, 'profile'))
  state.dispatch(logout.fulfilled(undefined, 'logout'))
  assert.equal(state.getState().auth.user, null)
  assert.equal(state.getState().auth.profileSaving, false)
})
