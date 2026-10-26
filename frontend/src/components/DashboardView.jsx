import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChartPie,
  Clock3,
  CreditCard,
  Package,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  DataTable,
  PageHeading,
  ProductName,
  StatCard,
} from './ui'
import { RevenueChart, PaymentChart } from './AnalyticsCharts'
import { money } from '../utils/format'
import { loadDashboard } from '../store/slices/analyticsSlice'
import { paymentLabel } from '../utils/sales'

export default function DashboardView() {
  const user = useSelector((state) => state.auth.user)
  const {
    dashboard: result,
    dashboardLoading: loading,
    dashboardError: error,
  } = useSelector((state) => state.analytics)
  const dispatch = useDispatch()
  const [period, setPeriod] = useState('today')
  const admin = user.role === 'admin'
  const refresh = () => dispatch(loadDashboard({ role: user.role, period }))
  useEffect(() => {
    const refresh = () => dispatch(loadDashboard({ role: user.role, period }))
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [dispatch, period, user.role, user.id])
  const available = result && !loading && !error
  const today = available ? result.today : null
  const inventory = available ? result.inventory : null
  return (
    <>
      <PageHeading
        title={`Welcome back, ${user.name.split(' ')[0]}! 👋`}
        description={
          admin
            ? 'Here’s what’s happening at your store today.'
            : 'Your sales and register activity today.'
        }
      >
        <span className="date-chip">
          <CalendarDays size={15} />
          {available
            ? `${result.range.to} · ${result.range.timeZone}`
            : 'Store dashboard'}
        </span>
      </PageHeading>
      <div className="welcome-strip">
        <span className="welcome-strip-icon">
          <ShoppingCart size={22} />
        </span>
        <div>
          <strong>A fresh day. A world of possibilities.</strong>
          <p>
            {admin
              ? 'Your store at a glance. Let’s make it a great one.'
              : 'You’re ready to make someone’s day. Your register is open.'}
          </p>
        </div>
        <Link to={`/${user.role}/pos`}>
          Open POS <ArrowRight size={16} />
        </Link>
      </div>
      {loading && (
        <p role="status" className="p-4 text-muted">
          Loading dashboard…
        </p>
      )}
      {error && (
        <div className="p-4">
          <p role="alert" className="form-error">
            {error}
          </p>
          <Button variant="secondary" onClick={refresh}>
            Retry dashboard
          </Button>
        </div>
      )}
      <div className="stats-grid">
        <StatCard
          label={admin ? 'Today’s Sales' : 'Your Sales Today'}
          value={today ? money(today.revenue) : '—'}
          icon={ShoppingCart}
          note={
            today ? `${today.orders} completed transactions` : 'Loading sales'
          }
        />
        <StatCard
          label="Total Transactions"
          value={today?.orders ?? '—'}
          icon={ReceiptText}
          color="blue"
          note="Today’s transactions"
        />
        <StatCard
          label={admin ? 'Total Products' : 'Items Sold'}
          value={admin ? (inventory?.products ?? '—') : (today?.units ?? '—')}
          icon={Package}
          color="amber"
          note={admin ? 'Across all categories' : 'Your items sold today'}
        />
        <StatCard
          label={admin ? 'Low / Out of Stock' : 'Average Sale'}
          value={
            admin
              ? inventory
                ? `${inventory.lowStock} / ${inventory.outOfStock}`
                : '—'
              : today
                ? money(today.average)
                : '—'
          }
          icon={admin ? TriangleAlert : CreditCard}
          color="rose"
          note={
            admin
              ? 'Low stock / out of stock products'
              : 'Per transaction today'
          }
        />
      </div>
      <div className="dashboard-charts">
        <Card
          title={admin ? 'Sales Overview' : 'Your Sales Overview'}
          icon={BarChart3}
          action={
            <select
              aria-label="Dashboard period"
              className="small-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="week">This week</option>
            </select>
          }
        >
          <div className="chart-headline">
            <strong>{available ? money(result.summary.revenue) : '—'}</strong>
            <span className="chart-trend">
              <TrendingUp size={14} /> Overview
            </span>
          </div>
          <p className="chart-description">
            {available
              ? `${result.summary.orders} transactions · ${result.range.from} to ${result.range.to}`
              : 'Sales revenue'}
          </p>
          {available && (
            <RevenueChart
              points={result.activity}
              hourly={period === 'today'}
            />
          )}
        </Card>
        <Card
          title="Revenue Trend"
          icon={TrendingUp}
          action={<span className="mini-label">Last 7 days</span>}
        >
          <p className="chart-description chart-description-spaced">
            Daily completed sales in the store timezone
          </p>
          {available && <RevenueChart points={result.weekly} line />}
        </Card>
        <Card
          title="Payment Methods"
          icon={ChartPie}
          action={<span className="mini-label">Selected period</span>}
        >
          <p className="chart-description chart-description-spaced">
            Cash and Card share of sales revenue
          </p>
          {available && (
            <PaymentChart
              payments={result.payments}
              orders={result.summary.orders}
            />
          )}
        </Card>
      </div>
      <div
        className={`dashboard-bottom mb-5 ${!admin ? 'cashier-bottom' : ''}`}
      >
        {admin && (
          <Card
            title="Inventory Alerts"
            icon={TriangleAlert}
            action={
              <Link
                className="text-link"
                to="/admin/inventory?status=Needs%20Attention"
              >
                View all <ArrowRight size={13} />
              </Link>
            }
          >
            <DataTable
              pageSize={5}
              caption="Low and out of stock products"
              data={inventory?.alerts || []}
              emptyTitle={
                available ? 'No stock alerts' : 'Stock alerts unavailable'
              }
              columns={[
                {
                  key: 'name',
                  label: 'Product',
                  render: (p) => <ProductName product={p} />,
                },
                {
                  key: 'stock',
                  label: 'Stock',
                  render: (p) => (
                    <Badge tone="rose">
                      {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                    </Badge>
                  ),
                },
                { key: 'minStock', label: 'Minimum' },
                {
                  key: 'action',
                  label: '',
                  render: (p) => (
                    <Link
                      className="restock-link"
                      to={`/admin/inventory?q=${encodeURIComponent(p.sku)}`}
                    >
                      Restock
                    </Link>
                  ),
                },
              ]}
            />
          </Card>
        )}
        <Card
          title="Recent Transactions"
          icon={Clock3}
          action={
            <Link
              className="text-link"
              to={`/${user.role}/${admin ? 'sales' : 'sales-history'}`}
            >
              View all <ArrowRight size={13} />
            </Link>
          }
        >
          <DataTable
            caption="Recent transactions"
            pageSize={4}
            data={available ? result.recent : []}
            emptyTitle={
              available
                ? 'No transactions in this period'
                : 'Transactions unavailable'
            }
            columns={[
              {
                key: 'id',
                label: 'Order ID',
                render: (s) => (
                  <Link
                    className="order-id"
                    to={`/${user.role}/${admin ? 'sales' : 'sales-history'}?sale=${encodeURIComponent(s.id)}`}
                    title={s.id}
                  >
                    {s.id.slice(0, 8)}…
                  </Link>
                ),
              },
              ...(admin
                ? [{ key: 'userName', label: 'Cashier' }]
                : [{ key: 'quantity', label: 'Items' }]),
              {
                key: 'payment',
                label: 'Payment',
                render: (s) => (
                  <span className="payment-label">
                    <CreditCard size={13} />
                    {paymentLabel(s.payment)}
                  </span>
                ),
              },
              {
                key: 'total',
                label: 'Amount',
                render: (s) => <strong>{money(s.total)}</strong>,
              },
              {
                key: 'status',
                label: 'Status',
                render: () => <Badge>Completed</Badge>,
              },
            ]}
          />
        </Card>
      </div>
      {admin ? (
        <Card
          title="Best-selling Products"
          icon={Package}
          action={
            <span className="mini-label">
              Top 10 by quantity · selected period
            </span>
          }
        >
          <DataTable
            caption="Dashboard best-selling products"
            data={available ? result.topProducts : []}
            pageSize={5}
            columns={[
              {
                key: 'name',
                label: 'Product',
                render: (p) => <ProductName product={p} />,
              },
              { key: 'quantity', label: 'Units Sold' },
              {
                key: 'revenue',
                label: 'Gross Revenue',
                render: (p) => money(p.revenue),
              },
            ]}
          />
          <p className="p-4 text-xs text-muted">
            Product revenue is before order discounts and tax.
          </p>
        </Card>
      ) : (
        <Card title="Your Personal Sales Summary" icon={ReceiptText}>
          <p className="p-4 text-muted">
            {available
              ? `${result.range.from} to ${result.range.to}: ${result.summary.orders} transactions, ${result.summary.units} items, ${money(result.summary.revenue)} revenue, ${money(result.summary.discounts)} discounts and ${money(result.summary.taxes)} taxes. Average sale: ${money(result.summary.average)}.`
              : 'Your summary will appear when sales load.'}
          </p>
        </Card>
      )}
      <div className="dashboard-note">
        <span className="status-dot" /> All set for a productive day{' '}
        <span>FreshMart · Main Branch</span>
      </div>
    </>
  )
}
