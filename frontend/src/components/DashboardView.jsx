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
import { BarChart, DonutChart, LineChart } from './Charts'
import { hourlySales, weeklyRevenue } from '../data/mockData'
import { money } from '../utils/format'
import { selectLowStock } from '../store/slices/inventorySlice'
import { loadRecentSales } from '../store/slices/salesSlice'
import { paymentLabel, salesPeriod } from '../utils/sales'

export default function DashboardView() {
  const user = useSelector((state) => state.auth.user),
    products = useSelector((state) => state.inventory.items)
  const {
    recent: result,
    recentLoading,
    recentError,
  } = useSelector((state) => state.sales)
  const dispatch = useDispatch()
  const [period, setPeriod] = useState('today')
  const lowStock = useSelector(selectLowStock)
  const inventoryAvailable = useSelector(
    (state) => state.inventory.loaded && !state.inventory.error,
  )
  const admin = user.role === 'admin'
  // Keep the timezone after a pending request clears its previous response.
  const [timeZone, setTimeZone] = useState('Asia/Colombo')
  useEffect(() => {
    if (result?.timeZone) setTimeZone(result.timeZone)
  }, [result?.timeZone])
  useEffect(() => {
    const refresh = () =>
      dispatch(loadRecentSales({ ...salesPeriod(period, timeZone), size: 4 }))
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [dispatch, period, timeZone])
  const salesAvailable = !!result && !recentLoading && !recentError
  const sales = salesAvailable ? result.content : []
  const total = result?.summary.revenue || 0,
    units = result?.summary.units || 0,
    orders = result?.summary.orders || 0
  const segments = admin
    ? [
        { label: 'Fresh Produce', value: 28, color: '#12b76a' },
        { label: 'Dairy & Eggs', value: 22, color: '#34a7fa' },
        { label: 'Beverages', value: 18, color: '#8b5cf6' },
        { label: 'Bakery', value: 18, color: '#ffba45' },
        { label: 'Others', value: 14, color: '#e5eaf0' },
      ]
    : ['Cash', 'Card (simulated)'].map((label, i) => ({
        label,
        value: result?.summary[i === 0 ? 'cash' : 'card'] || 0,
        color: ['#12b76a', '#34a7fa', '#8b5cf6', '#ffba45'][i],
      }))
  return (
    <>
      <PageHeading
        title={`Welcome back, ${user.name.split(' ')[0]}! 👋`}
        description="Here’s what’s happening at your store today."
      >
        <span className="date-chip">
          <CalendarDays size={15} />{' '}
          {new Intl.DateTimeFormat('en-US', {
            timeZone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }).format(new Date())}
        </span>
      </PageHeading>
      <div className="welcome-strip">
        <span className="welcome-strip-icon">
          <LeafIcon />
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
      <div className="stats-grid">
        <StatCard
          label={period === 'today' ? 'Today’s Sales' : 'Weekly Sales'}
          value={salesAvailable ? money(total) : '—'}
          icon={ShoppingCart}
          note={
            salesAvailable ? `${orders} completed orders` : 'Sales unavailable'
          }
        />
        <StatCard
          label="Total Orders"
          value={salesAvailable ? orders : '—'}
          icon={ReceiptText}
          color="blue"
          note={
            period === 'today'
              ? 'Today’s transactions'
              : 'This week’s transactions'
          }
        />
        <StatCard
          label={admin ? 'Total Products' : 'Items Sold'}
          value={
            admin
              ? inventoryAvailable
                ? products.length
                : '—'
              : salesAvailable
                ? units
                : '—'
          }
          icon={Package}
          color="amber"
          note={admin ? 'Across all categories' : 'In the selected period'}
        />
        <StatCard
          label={admin ? 'Low Stock Items' : 'Average Order'}
          value={
            admin
              ? inventoryAvailable
                ? lowStock.length
                : '—'
              : salesAvailable
                ? money(result.summary.average)
                : '—'
          }
          icon={admin ? TriangleAlert : CreditCard}
          color="rose"
          note={admin ? 'Ready for your attention' : 'Per transaction'}
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
            <strong>{salesAvailable ? money(total) : '—'}</strong>
            <span className="chart-trend">
              <TrendingUp size={14} /> Overview
            </span>
          </div>
          <p className="chart-description">
            {salesAvailable
              ? `Total revenue from ${orders} orders`
              : 'Loading sales totals'}
          </p>
          <BarChart
            values={
              period === 'today'
                ? hourlySales
                : hourlySales.map((v) => Math.round(v * 1.4))
            }
          />
          <p className="chart-note">Illustrative hourly activity</p>
        </Card>
        <Card
          title="Revenue Trend"
          icon={TrendingUp}
          action={<span className="mini-label">Selected period</span>}
        >
          <div className="chart-headline">
            <strong>{salesAvailable ? money(total) : '—'}</strong>
          </div>
          <p className="chart-description">A little growth, every day</p>
          <LineChart values={weeklyRevenue} />
          <p className="chart-note">Illustrative weekly trend</p>
        </Card>
        <Card
          title={admin ? 'Category Distribution' : 'Payment Methods'}
          icon={ChartPie}
          action={<span className="mini-label">Selected period</span>}
        >
          <p className="chart-description chart-description-spaced">
            {admin
              ? 'A balanced basket of everyday essentials'
              : 'How your customers prefer to pay'}
          </p>
          <DonutChart
            segments={segments}
            value={admin ? products.length : orders}
            label={admin ? 'Products' : 'Orders'}
          />
          <p className="chart-note">
            {admin
              ? 'Illustrative category share'
              : 'Based on your completed transactions'}
          </p>
        </Card>
      </div>
      <div className={`dashboard-bottom ${!admin ? 'cashier-bottom' : ''}`}>
        {admin && (
          <Card
            title="Low Stock Alerts"
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
              pageSize={4}
              caption="Low stock products"
              data={inventoryAvailable ? lowStock : []}
              emptyTitle={
                inventoryAvailable
                  ? 'No stock alerts'
                  : 'Stock alerts unavailable'
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
                  render: (p) => <Badge tone="rose">{p.stock} left</Badge>,
                },
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
          {recentLoading && (
            <p role="status" className="p-4 text-muted">
              Loading recent sales…
            </p>
          )}
          {recentError && (
            <div className="p-4">
              <p role="alert" className="form-error">
                {recentError}
              </p>
              <Button
                variant="secondary"
                onClick={() =>
                  dispatch(
                    loadRecentSales({
                      ...salesPeriod(period, timeZone),
                      size: 4,
                    }),
                  )
                }
              >
                Retry recent sales
              </Button>
            </div>
          )}
          {salesAvailable && (
            <DataTable
              caption="Recent transactions"
              pageSize={4}
              data={sales.slice(0, 4)}
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
                  : [
                      {
                        key: 'items',
                        label: 'Items',
                        render: (s) => s.quantity,
                      },
                    ]),
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
          )}
        </Card>
      </div>
      <div className="dashboard-note">
        <span className="status-dot" /> All set for a productive day{' '}
        <span>FreshMart · Main Branch</span>
      </div>
    </>
  )
}
function LeafIcon() {
  return <ShoppingCart size={22} />
}
