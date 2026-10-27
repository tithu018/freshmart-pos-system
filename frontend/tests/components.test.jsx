import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import auth from '../src/store/slices/authSlice'
import AppRoutes from '../src/routes/AppRoutes'
import ErrorBoundary from '../src/components/ErrorBoundary'
import CatalogFeedback from '../src/components/CatalogFeedback'
import { RevenueChart } from '../src/components/AnalyticsCharts'
import { DataTable, SearchInput, Field } from '../src/components/ui'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function route(path, role) {
  const user = role ? { id: 'test-user', name: 'Test User', role } : null
  const store = configureStore({
    reducer: { auth },
    preloadedState: {
      auth: { user, status: user ? 'authenticated' : 'anonymous' },
    },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </Provider>,
  )
}

test.each([
  '/admin/employees',
  '/admin/reports',
  '/cashier/pos',
  '/admin/receipts/sale',
])('anonymous route %s returns the login page', async (path) => {
  route(path)
  expect(
    await screen.findByRole('button', { name: 'Sign in to FreshMart' }),
  ).toBeTruthy()
})

test.each([
  '/admin/dashboard',
  '/admin/employees',
  '/admin/customers',
  '/admin/reports',
  '/admin/settings',
  '/admin/receipts/sale',
])(
  'cashier route %s is denied without rendering protected content',
  async (path) => {
    route(path, 'cashier')
    expect(
      await screen.findByText(/This workspace isn.t available/),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Back to my dashboard' })
        .getAttribute('href'),
    ).toBe('/cashier/dashboard')
    expect(screen.queryByRole('button', { name: 'Add employee' })).toBeNull()
  },
)

test('admin cannot open the cashier workspace', async () => {
  route('/cashier/pos', 'admin')
  expect(await screen.findByText(/This workspace isn.t available/)).toBeTruthy()
})

test('unknown routes offer a working recovery link', () => {
  route('/missing', 'admin')
  expect(
    screen
      .getByRole('link', { name: 'Back to FreshMart' })
      .getAttribute('href'),
  ).toBe('/admin/dashboard')
})

test('render failures show a safe recovery view without raw error details', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken() {
    throw new Error('private-response-details')
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert').textContent).toContain(
    'Unable to display this page',
  )
  expect(screen.queryByText(/private-response-details/)).toBeNull()
  expect(screen.getByRole('button', { name: 'Reload FreshMart' })).toBeTruthy()
})

test('search clear and accessible input labels work', () => {
  const change = vi.fn()
  render(
    <>
      <SearchInput
        value="apples"
        onChange={change}
        placeholder="Search products"
      />
      <Field label="Product name" defaultValue="Apples" />
    </>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(change).toHaveBeenCalledWith('')
  expect(screen.getByLabelText('Product name').value).toBe('Apples')
})

test('tables paginate and escape customer-controlled markup', () => {
  const data = Array.from({ length: 9 }, (_, index) => ({
    id: index,
    name: index === 0 ? '<script>unsafe()</script>' : `Product ${index}`,
  }))
  render(
    <DataTable
      data={data}
      pageSize={7}
      columns={[{ key: 'name', label: 'Name' }]}
    />,
  )
  expect(screen.getByText('<script>unsafe()</script>')).toBeTruthy()
  expect(document.querySelector('script')).toBeNull()
  expect(screen.queryByText('Product 8')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(screen.getByText('Product 8')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
  expect(screen.queryByText('Product 8')).toBeNull()
})

test('loading, service failure and retry states recover without a stale error', () => {
  const retry = vi.fn()
  const view = render(<CatalogFeedback loading reload={retry} />)
  expect(screen.getByRole('status').textContent).toContain('Loading catalog')
  view.rerender(
    <CatalogFeedback error="Service temporarily unavailable" reload={retry} />,
  )
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain(
    'Service temporarily unavailable',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(retry).toHaveBeenCalledOnce()
  view.rerender(<CatalogFeedback reload={retry} />)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('empty tables show an empty state with disabled pagination', () => {
  render(
    <DataTable
      data={[]}
      columns={[{ key: 'name', label: 'Name' }]}
      emptyTitle="No customers yet"
    />,
  )
  expect(screen.getByText('No customers yet')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(
    true,
  )
  expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true)
})

test('hourly chart labels remain separated at mobile widths and retain both endpoints', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback
      }
      observe() {
        this.callback([{ contentRect: { width: 280 } }])
      }
      disconnect() {}
    },
  )
  render(
    <RevenueChart
      hourly
      points={Array.from({ length: 24 }, (_, hour) => ({
        label: String(hour),
        revenue: hour,
        orders: 1,
      }))}
    />,
  )
  const labels = [...document.querySelectorAll('svg text[y="198"]')]
  expect(labels[0].textContent).toBe('00:00')
  expect(labels.at(-1).textContent).toBe('23:00')
  for (let i = 1; i < labels.length; i++) {
    expect(
      Number(labels[i].getAttribute('x')) -
        Number(labels[i - 1].getAttribute('x')),
    ).toBeGreaterThanOrEqual(50)
  }
})
