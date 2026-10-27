import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeAction } from '../src/store/devTools.js'
import { catalogClient, catalogRequest } from '../src/services/catalogApi.js'

afterEach(() => mock.restoreAll())

test('Redux development history redacts login and employee passwords without mutating requests', () => {
  for (const type of [
    'auth/login/pending',
    'auth/login/fulfilled',
    'auth/login/rejected',
    'people/save/pending',
    'people/save/fulfilled',
    'people/save/rejected',
  ]) {
    const action = {
      type,
      meta: {
        requestId: 'request',
        arg: {
          password: 'private-password',
          person: { password: 'private-password' },
        },
      },
    }
    assert(!JSON.stringify(sanitizeAction(action)).includes('private-password'))
    assert.equal(action.meta.arg.password, 'private-password')
    assert.equal(sanitizeAction(action).meta.requestId, 'request')
  }
  const ordinary = { type: 'cart/setPayment', payload: 'CASH' }
  assert.equal(sanitizeAction(ordinary), ordinary)
})

test('shared API errors remain useful for non-catalog pages and do not expose transport details', async () => {
  mock.method(catalogClient, 'request', async () => {
    throw {
      message: 'private transport configuration',
      response: { status: 403, data: '<html>proxy error</html>' },
    }
  })
  await assert.rejects(
    catalogRequest('/admin/employees'),
    (error) =>
      error.status === 403 &&
      error.message === 'You do not have permission to perform this action.',
  )
})
