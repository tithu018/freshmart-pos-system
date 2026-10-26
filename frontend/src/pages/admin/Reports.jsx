import { useEffect, useState } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import {
  BarChart3,
  CreditCard,
  Download,
  Package,
  ReceiptText,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Button,
  Card,
  DataTable,
  PageHeading,
  ProductName,
  StatCard,
} from '../../components/ui'
import { RevenueChart, PaymentChart } from '../../components/AnalyticsCharts'
import { money } from '../../utils/format'
import { reportParams, rangeError, saveReportCsv } from '../../utils/analytics'
import { loadReport, exportReport } from '../../store/slices/analyticsSlice'

export default function Reports() {
  const dispatch = useDispatch()
  const store = useStore()
  const {
    report,
    reportLoading: loading,
    reportError: error,
    csvLoading,
    csvError,
  } = useSelector((state) => state.analytics)
  const userId = useSelector((state) => state.auth.user?.id)
  const [period, setPeriod] = useState('week')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filters, setFilters] = useState({ period: 'week' })
  const [validation, setValidation] = useState('')
  const [ranking, setRanking] = useState('revenue')
  useEffect(() => {
    const refresh = () => dispatch(loadReport(filters))
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [dispatch, filters, userId])
  const available = report && !loading && !error
  const summary = available ? report.summary : null
  const changePeriod = (value) => {
    setPeriod(value)
    setValidation('')
    if (value !== 'custom') setFilters({ period: value })
    else if (report) {
      setFrom(report.range.from)
      setTo(report.range.to)
    }
  }
  const apply = (e) => {
    e.preventDefault()
    const message = rangeError(from, to)
    setValidation(message)
    if (!message) setFilters(reportParams('custom', from, to))
  }
  const download = async () => {
    // Export the exact displayed dates even if midnight passes after loading.
    const { from, to } = report.range
    const action = await dispatch(
      exportReport(reportParams('custom', from, to)),
    )
    if (
      exportReport.fulfilled.match(action) &&
      store.getState().analytics.csv === action.payload
    )
      saveReportCsv(action.payload, from, to)
  }
  return (
    <>
      <PageHeading
        title="Reports"
        description="A clearer picture of how your store is doing."
      >
        <select
          aria-label="Report period"
          value={period}
          onChange={(e) => changePeriod(e.target.value)}
        >
          <option value="today">Daily · Today</option>
          <option value="week">Weekly · This week</option>
          <option value="month">Monthly · This month</option>
          <option value="custom">Custom date range</option>
        </select>
        <Button
          variant="secondary"
          onClick={download}
          disabled={!available || csvLoading}
        >
          <Download size={16} />
          {csvLoading ? 'Exporting…' : 'Download report'}
        </Button>
      </PageHeading>
      {period === 'custom' && (
        <form onSubmit={apply} className="flex flex-wrap items-end gap-3 mb-5">
          <label className="field">
            <span>Start date</span>
            <input
              aria-label="Start date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>End date</span>
            <input
              aria-label="End date"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </label>
          <Button type="submit">Apply dates</Button>
          {validation && (
            <p role="alert" className="form-error">
              {validation}
            </p>
          )}
        </form>
      )}
      {loading && (
        <p role="status" className="p-4 text-muted">
          Loading sales report…
        </p>
      )}
      {error && (
        <div className="p-4">
          <p role="alert" className="form-error">
            {error}
          </p>
          <Button
            variant="secondary"
            onClick={() => dispatch(loadReport(filters))}
          >
            Retry report
          </Button>
        </div>
      )}
      {csvError && (
        <p role="alert" className="form-error">
          Export failed: {csvError}
        </p>
      )}
      {available && (
        <p className="mb-4 text-xs text-muted">
          {report.range.from} to {report.range.to} (inclusive) ·{' '}
          {report.range.timeZone}
        </p>
      )}
      <div className="stats-grid">
        <StatCard
          label="Total Revenue"
          value={summary ? money(summary.revenue) : '—'}
          icon={TrendingUp}
          note="Selected period"
        />
        <StatCard
          label="Transactions"
          value={summary?.orders ?? '—'}
          icon={ReceiptText}
          color="blue"
          note="Completed sales"
        />
        <StatCard
          label="Items Sold"
          value={summary?.units ?? '—'}
          icon={Package}
          color="amber"
          note="Products taken home"
        />
        <StatCard
          label="Average Sale"
          value={summary ? money(summary.average) : '—'}
          icon={CreditCard}
          color="purple"
          note="Per transaction"
        />
      </div>
      {summary && (
        <div className="flex flex-wrap gap-6 mb-5 text-sm">
          <span>
            Gross subtotal: <strong>{money(summary.subtotal)}</strong>
          </span>
          <span>
            Total discounts: <strong>{money(summary.discounts)}</strong>
          </span>
          <span>
            Taxes collected: <strong>{money(summary.taxes)}</strong>
          </span>
        </div>
      )}
      <div className="reports-grid">
        <Card title="Revenue by Day" icon={BarChart3}>
          <div className="chart-headline">
            <strong>{summary ? money(summary.revenue) : '—'}</strong>
          </div>
          <p className="chart-description">
            Completed sales in the selected date range
          </p>
          {available && <RevenueChart points={report.daily} />}
        </Card>
        <Card title="Payment Breakdown" icon={CreditCard}>
          <p className="chart-description chart-description-spaced">
            Cash and Card share of sales revenue
          </p>
          {available && (
            <PaymentChart payments={report.payments} orders={summary.orders} />
          )}
        </Card>
      </div>
      <Card
        title="Best-selling Products"
        icon={Package}
        action={
          <select
            className="small-select"
            aria-label="Product ranking"
            value={ranking}
            onChange={(e) => setRanking(e.target.value)}
          >
            <option value="revenue">Top 10 by revenue</option>
            <option value="quantity">Top 10 by quantity</option>
          </select>
        }
      >
        <DataTable
          data={
            available
              ? report[
                  ranking === 'quantity' ? 'topByQuantity' : 'topByRevenue'
                ]
              : []
          }
          caption="Best-selling products"
          pageSize={5}
          columns={[
            {
              key: 'name',
              label: 'Product',
              render: (p) => <ProductName product={p} />,
            },
            { key: 'sku', label: 'SKU' },
            { key: 'quantity', label: 'Units Sold' },
            {
              key: 'revenue',
              label: 'Gross Revenue',
              render: (p) => <strong>{money(p.revenue)}</strong>,
            },
          ]}
        />
        <p className="p-4 text-xs text-muted">
          Product revenue uses historical line totals before order discounts and
          tax.
        </p>
      </Card>
      <div className="mt-5">
        <Card title="Cashier Sales Performance" icon={Users}>
          <DataTable
            data={available ? report.cashiers : []}
            caption="Cashier sales performance"
            pageSize={5}
            columns={[
              { key: 'name', label: 'Cashier' },
              { key: 'orders', label: 'Transactions' },
              ...[
                ['revenue', 'Revenue'],
                ['discounts', 'Discounts'],
                ['taxes', 'Taxes'],
                ['average', 'Average Sale'],
              ].map(([key, label]) => ({
                key,
                label,
                render: (c) => money(c[key]),
              })),
            ]}
          />
        </Card>
      </div>
    </>
  )
}
