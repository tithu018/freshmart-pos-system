import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import {
  Banknote,
  CreditCard,
  Download,
  Eye,
  ReceiptText,
  ShoppingBag,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  DataTable,
  PageHeading,
  SearchInput,
  StatCard,
} from './ui'
import { downloadCsv, money } from '../utils/format'
import { paymentLabel, salesDate } from '../utils/sales'
import { loadSales, loadSalesCashiers } from '../store/slices/salesSlice'
import SaleDetailsModal from './SaleDetailsModal'

export default function SalesView() {
  const user = useSelector((state) => state.auth.user)
  const admin = user?.role === 'admin'
  const { list, listLoading, listError, cashiers, cashiersError } = useSelector(
    (state) => state.sales,
  )
  const [filters, setFilters] = useState({
    q: '',
    from: '',
    to: '',
    payment: '',
    cashierId: '',
    page: 0,
    size: 10,
    sort: 'occurredAt',
    direction: 'desc',
  })
  const [params, setParams] = useSearchParams()
  const selected = params.get('sale')
  const dispatch = useDispatch()
  const invalidRange = filters.from && filters.to && filters.from > filters.to
  useEffect(() => {
    if (invalidRange) return
    const refresh = () => dispatch(loadSales(filters))
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [dispatch, filters, invalidRange])
  useEffect(() => {
    if (admin) dispatch(loadSalesCashiers())
  }, [dispatch, admin])
  const filter = (changes) =>
    setFilters((previous) => ({ ...previous, ...changes, page: 0 }))
  const ready = !!list && !listLoading && !listError && !invalidRange
  const rows = ready ? list.content : []
  const open = (id) => {
    const next = new URLSearchParams(params)
    id ? next.set('sale', id) : next.delete('sale')
    setParams(next)
  }
  return (
    <>
      <PageHeading
        title={admin ? 'Sales' : 'Sales History'}
        description={
          admin
            ? 'Every transaction tells a story. Here’s yours.'
            : 'A clear view of every sale you’ve made.'
        }
      >
        <Button
          variant="secondary"
          disabled={!ready || !rows.length}
          onClick={() =>
            downloadCsv('freshmart-sales-page.csv', [
              [
                'Sale ID',
                'Date',
                'Cashier',
                'Items',
                'Total',
                'Payment',
                'Status',
              ],
              ...rows.map((s) => [
                s.id,
                salesDate(s.occurredAt, list.timeZone),
                s.userName,
                s.quantity,
                s.total,
                paymentLabel(s.payment),
                'Completed',
              ]),
            ])
          }
        >
          <Download size={16} />
          Export page
        </Button>
      </PageHeading>
      <div className="stats-grid stats-three">
        <StatCard
          label="Total Revenue"
          value={ready ? money(list.summary.revenue) : '—'}
          icon={Banknote}
          note="All matching transactions"
        />
        <StatCard
          label="Completed Orders"
          value={ready ? list.summary.orders : '—'}
          icon={ReceiptText}
          color="blue"
          note="Every sale, accounted for"
        />
        <StatCard
          label="Average Order"
          value={ready ? money(list.summary.average) : '—'}
          icon={ShoppingBag}
          color="amber"
          note="Average matching basket value"
        />
      </div>
      <Card>
        <div className="table-toolbar">
          <SearchInput
            value={filters.q}
            onChange={(q) => filter({ q })}
            placeholder="Search Sale ID..."
          />
          <div className="date-range">
            <input
              aria-label="Sales start date"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => filter({ from: e.target.value })}
            />
            <span>to</span>
            <input
              aria-label="Sales end date"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => filter({ to: e.target.value })}
            />
          </div>
          <select
            aria-label="Filter payment method"
            value={filters.payment}
            onChange={(e) => filter({ payment: e.target.value })}
          >
            <option value="">All payments</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card (simulated)</option>
          </select>
          {admin && (
            <select
              aria-label="Filter cashier"
              value={filters.cashierId}
              onChange={(e) => filter({ cashierId: e.target.value })}
            >
              <option value="">All cashiers</option>
              {cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Sort sales"
            value={`${filters.sort}:${filters.direction}`}
            onChange={(e) => {
              const [sort, direction] = e.target.value.split(':')
              filter({ sort, direction })
            }}
          >
            <option value="occurredAt:desc">Newest first</option>
            <option value="occurredAt:asc">Oldest first</option>
            <option value="total:desc">Highest total</option>
            <option value="total:asc">Lowest total</option>
          </select>
          <select
            aria-label="Sales per page"
            value={filters.size}
            onChange={(e) => filter({ size: Number(e.target.value) })}
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </div>
        <p className="chart-note">
          Dates and times: {list?.timeZone || 'Asia/Colombo'}
        </p>
        {admin && cashiersError && (
          <div className="p-4">
            <p role="alert" className="form-error">
              {cashiersError}
            </p>
            <Button
              variant="secondary"
              onClick={() => dispatch(loadSalesCashiers())}
            >
              Retry cashier filter
            </Button>
          </div>
        )}
        {invalidRange ? (
          <p role="alert" className="form-error p-4">
            Start date must be on or before end date.
          </p>
        ) : listLoading || (!list && !listError) ? (
          <p role="status" className="p-4 text-muted">
            Loading sales…
          </p>
        ) : listError ? (
          <div className="p-4">
            <p role="alert" className="form-error">
              {listError}
            </p>
            <Button
              variant="secondary"
              onClick={() => dispatch(loadSales(filters))}
            >
              Try again
            </Button>
          </div>
        ) : (
          <DataTable
            data={rows}
            caption="Sales transactions"
            emptyTitle="No sales found"
            pagination={{
              page: list.page,
              size: list.size,
              totalElements: list.totalElements,
              onPageChange: (page) =>
                setFilters((previous) => ({ ...previous, page })),
            }}
            columns={[
              {
                key: 'id',
                label: 'Sale ID',
                render: (s) => (
                  <button className="order-id" onClick={() => open(s.id)}>
                    {s.id}
                  </button>
                ),
              },
              {
                key: 'occurredAt',
                label: 'Date & Time',
                render: (s) => salesDate(s.occurredAt, list.timeZone),
              },
              ...(admin ? [{ key: 'userName', label: 'Cashier' }] : []),
              { key: 'quantity', label: 'Items' },
              {
                key: 'total',
                label: 'Total',
                render: (s) => <strong>{money(s.total)}</strong>,
              },
              {
                key: 'payment',
                label: 'Payment Method',
                render: (s) => (
                  <span className="payment-label">
                    {s.payment === 'CASH' ? (
                      <Banknote size={14} />
                    ) : (
                      <CreditCard size={14} />
                    )}
                    {paymentLabel(s.payment)}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: () => <Badge>Completed</Badge>,
              },
              {
                key: 'actions',
                label: '',
                render: (s) => (
                  <button
                    className="icon-button"
                    aria-label={`View ${s.id}`}
                    onClick={() => open(s.id)}
                  >
                    <Eye size={16} />
                  </button>
                ),
              },
            ]}
          />
        )}
      </Card>
      {selected && (
        <SaleDetailsModal
          key={selected}
          id={selected}
          onClose={() => open(null)}
        />
      )}
    </>
  )
}
