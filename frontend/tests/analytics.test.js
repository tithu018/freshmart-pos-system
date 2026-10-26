import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { configureStore } from '@reduxjs/toolkit'
import auth, {
  restoreSession,
  sessionExpired,
} from '../src/store/slices/authSlice.js'
import analytics, {
  loadDashboard,
  loadReport,
  exportReport,
} from '../src/store/slices/analyticsSlice.js'
import { catalogClient } from '../src/services/catalogApi.js'
import {
  reportParams,
  rangeError,
  saveReportCsv,
} from '../src/utils/analytics.js'

const original = catalogClient.defaults.adapter
afterEach(() => {
  catalogClient.defaults.adapter = original
})
function store() {
  const state = configureStore({ reducer: { auth, analytics } })
  state.dispatch(restoreSession.pending('auth'))
  state.dispatch(
    restoreSession.fulfilled(
      { user: { id: 'cashier', role: 'cashier' } },
      'auth',
    ),
  )
  return state
}
function respond(fn) {
  catalogClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    headers: {},
    data: await fn(config),
  })
}
test('dashboard uses role endpoint, cookies and backend financial totals', async () => {
  const state = store()
  assert.equal(state.getState().analytics.dashboard, null)
  respond((config) => {
    assert.equal(config.url, '/cashier/dashboard')
    assert.equal(config.withCredentials, true)
    assert.deepEqual(config.params, { period: 'week' })
    return { today: { revenue: 19.8 }, summary: { revenue: 28.77 } }
  })
  await state
    .dispatch(loadDashboard({ role: 'cashier', period: 'week' }))
    .unwrap()
  assert.equal(state.getState().analytics.dashboard.today.revenue, 19.8)
})
test('reports and CSV send identical explicit dates and keep totals from the API', async () => {
  const state = store(),
    params = reportParams('custom', '2026-10-01', '2026-10-31')
  respond((config) => {
    assert.deepEqual(config.params, params)
    return config.url.endsWith('/csv')
      ? '"Revenue","26.40"\r\n'
      : { summary: { revenue: 26.4, taxes: 2.4 } }
  })
  await state.dispatch(loadReport(params)).unwrap()
  const csv = await state.dispatch(exportReport(params)).unwrap()
  assert.equal(state.getState().analytics.report.summary.taxes, 2.4)
  assert.equal(csv, '"Revenue","26.40"\r\n')
})
test('new ranges supersede old responses and session expiry removes all analytics', () => {
  const state = store()
  state.dispatch(loadReport.pending('old'))
  state.dispatch(loadReport.pending('new'))
  state.dispatch(loadReport.fulfilled({ summary: { revenue: 2 } }, 'new'))
  state.dispatch(loadReport.fulfilled({ summary: { revenue: 9 } }, 'old'))
  assert.equal(state.getState().analytics.report.summary.revenue, 2)
  state.dispatch(loadDashboard.pending('dashboard'))
  state.dispatch(exportReport.pending('csv'))
  state.dispatch(sessionExpired())
  state.dispatch(loadDashboard.fulfilled({ inventory: {} }, 'dashboard'))
  state.dispatch(exportReport.fulfilled('private', 'csv'))
  assert.equal(state.getState().analytics.report, null)
  assert.equal(state.getState().analytics.dashboard, null)
  assert.equal(state.getState().analytics.csv, null)
})
test('failed requests clear stale data, support retry and expire only on 401', async () => {
  const state = store()
  respond(() => ({ summary: { revenue: 1 } }))
  await state.dispatch(loadReport({ period: 'today' }))
  respond(() => {
    throw { response: { status: 503, data: { message: 'Unavailable' } } }
  })
  await state.dispatch(loadReport({ period: 'week' }))
  assert.equal(state.getState().analytics.report, null)
  assert.equal(state.getState().analytics.reportError, 'Unavailable')
  assert.equal(state.getState().auth.user.id, 'cashier')
  respond(() => ({ summary: { revenue: 0 } }))
  await state.dispatch(loadReport({ period: 'week' }))
  assert.equal(state.getState().analytics.reportError, null)
  respond(() => {
    throw { response: { status: 401, data: {} } }
  })
  await state.dispatch(loadDashboard({ role: 'cashier', period: 'today' }))
  assert.equal(state.getState().auth.user, null)
  assert.equal(state.getState().analytics.report, null)
})
test('date validation rejects reversed, missing and overlong ranges', () => {
  assert.deepEqual(reportParams('month', 'ignored', 'ignored'), {
    period: 'month',
  })
  assert.match(rangeError('', '2026-10-01'), /both/)
  assert.match(rangeError('2026-10-02', '2026-10-01'), /before/)
  assert.match(rangeError('2025-01-01', '2026-01-02'), /366/)
  assert.equal(rangeError('2024-02-29', '2024-02-29'), '')
})
test('download preserves server CSV bytes and names the displayed range', async () => {
  const create = URL.createObjectURL,
    revoke = URL.revokeObjectURL,
    document = global.document
  let blob,
    clicked = false
  const link = {
    click: () => {
      clicked = true
    },
  }
  URL.createObjectURL = (value) => {
    blob = value
    return 'blob:report'
  }
  URL.revokeObjectURL = () => {}
  global.document = { createElement: () => link }
  try {
    saveReportCsv('\uFEFF"Revenue","26.40"\r\n', '2026-10-01', '2026-10-31')
    assert.equal(link.download, 'freshmart-report-2026-10-01-2026-10-31.csv')
    assert.equal(clicked, true)
    assert.equal(await blob.text(), '"Revenue","26.40"\r\n')
  } finally {
    URL.createObjectURL = create
    URL.revokeObjectURL = revoke
    global.document = document
  }
})
