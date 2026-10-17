import { afterEach, test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { configureStore } from '@reduxjs/toolkit'
import auth, { login, logout, restoreSession, sessionExpired, updateProfile } from '../src/store/slices/authSlice.js'
import { authService } from '../src/services/authService.js'

const session = { user: { id: 'EMP-002', name: 'Sarah', email: 'cashier@freshmart.com', role: 'CASHIER', phone: '' }, expiresAt: new Date(Date.now() + 3600000).toISOString() }
const store = () => configureStore({ reducer: { auth } })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => mock.restoreAll())

test('login sends credentials with CSRF, takes the server role, and never stores the password/token', async () => {
  const requests = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options })
    return url.endsWith('/csrf') ? json({ token: 'csrf-value' }) : json(session)
  })
  const state = store()
  await state.dispatch(login({ email: ' cashier@freshmart.com ', password: 'test-password', role: 'ADMIN' })).unwrap()
  assert.equal(state.getState().auth.user.role, 'cashier')
  assert.equal(state.getState().auth.status, 'authenticated')
  assert.equal(requests[1].options.credentials, 'include')
  assert.equal(requests[1].options.headers['X-CSRF-TOKEN'], 'csrf-value')
  assert.deepEqual(JSON.parse(requests[1].options.body), { email: 'cashier@freshmart.com', password: 'test-password' })
  assert(!JSON.stringify(state.getState()).includes('test-password'))
})

test('invalid credentials show a clean error and leave the user anonymous', async () => {
  mock.method(globalThis, 'fetch', async url => url.endsWith('/csrf') ? json({ token: 'csrf' }) : json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }, 401))
  const state = store()
  await state.dispatch(login({ email: 'admin@freshmart.com', password: 'wrong' }))
  assert.equal(state.getState().auth.status, 'anonymous')
  assert.equal(state.getState().auth.user, null)
  assert.equal(state.getState().auth.error, 'Invalid email or password.')
})

test('session restore uses the cookie; a revoked session clears the user', async () => {
  const state = store()
  const fetch = mock.method(globalThis, 'fetch', async () => json(session))
  await state.dispatch(restoreSession())
  assert.equal(state.getState().auth.user.role, 'cashier')
  fetch.mock.mockImplementation(async () => json({ code: 'UNAUTHENTICATED' }, 401))
  await state.dispatch(restoreSession())
  assert.equal(state.getState().auth.user, null)
  assert.match(state.getState().auth.notice, /session has ended/)
})

test('failed logout remains visibly signed in and can retry session checks', async () => {
  const state = store()
  const fetch = mock.method(globalThis, 'fetch', async () => json(session))
  await state.dispatch(restoreSession())
  state.dispatch(restoreSession.pending('old-request'))
  fetch.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
  await state.dispatch(logout())
  assert.equal(state.getState().auth.status, 'authenticated')
  assert.equal(state.getState().auth.checking, false)
  assert.match(state.getState().auth.error, /Unable to reach FreshMart/)
  fetch.mock.mockImplementation(async () => json(session))
  await state.dispatch(restoreSession())
  assert.equal(state.getState().auth.error, null)
})

test('logout completion wins over an older in-flight session response', async () => {
  const state = store()
  state.dispatch(restoreSession.pending('old'))
  state.dispatch(logout.pending('new'))
  state.dispatch(logout.fulfilled(undefined, 'new'))
  state.dispatch(restoreSession.fulfilled({ ...session, user: { ...session.user, role: 'cashier' } }, 'old'))
  assert.equal(state.getState().auth.user, null)
  assert.equal(state.getState().auth.status, 'anonymous')
})

test('local profile edits cannot modify account identity, email, or role', async () => {
  mock.method(globalThis, 'fetch', async () => json(session))
  const state = store()
  await state.dispatch(restoreSession())
  state.dispatch(updateProfile({ name: 'Preview', phone: '123', id: 'EMP-001', email: 'admin@freshmart.com', role: 'admin' }))
  assert.equal(state.getState().auth.user.role, 'cashier')
  assert.equal(state.getState().auth.user.id, 'EMP-002')
  assert.equal(state.getState().auth.user.email, 'cashier@freshmart.com')
  state.dispatch(sessionExpired())
  assert.equal(state.getState().auth.user, null)
})

test('unsupported server roles are rejected', async () => {
  mock.method(globalThis, 'fetch', async () => json({ ...session, user: { ...session.user, role: 'OWNER' } }))
  await assert.rejects(authService.me(), { code: 'INVALID_SESSION' })
})
