import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
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
  Card,
  DataTable,
  PageHeading,
  ProductName,
  StatCard,
} from './ui'
import { BarChart, DonutChart, LineChart } from './Charts'
import { DEMO_DATE, hourlySales, weeklyRevenue } from '../data/mockData'
import { money } from '../utils/format'

export default function DashboardView() {
  const user = useSelector((state) => state.auth.user),
    products = useSelector((state) => state.products.items),
    allSales = useSelector((state) => state.sales.items)
  const [period, setPeriod] = useState('today')
  const admin = user.role === 'admin',
    sales = admin
      ? allSales
      : allSales.filter((sale) => sale.cashierId === user.id)
  const recent = sales.filter(
    (sale) => period === 'week' || sale.date.startsWith(DEMO_DATE),
  )
  const total = recent.reduce((sum, sale) => sum + sale.total, 0),
    lowStock = products.filter((p) => p.stock < p.minStock)
  const units = recent.reduce(
    (sum, sale) => sum + sale.items.reduce((n, item) => n + item.quantity, 0),
    0,
  )
  const segments = admin
    ? [
        { label: 'Fresh Produce', value: 28, color: '#12b76a' },
        { label: 'Dairy & Eggs', value: 22, color: '#34a7fa' },
        { label: 'Beverages', value: 18, color: '#8b5cf6' },
        { label: 'Bakery', value: 18, color: '#ffba45' },
        { label: 'Others', value: 14, color: '#e5eaf0' },
      ]
    : ['Cash', 'Credit Card', 'Debit Card', 'Mobile Pay'].map((label, i) => ({
        label,
        value: sales.filter((s) => s.payment === label).length,
        color: ['#12b76a', '#34a7fa', '#8b5cf6', '#ffba45'][i],
      }))
  return (
    <>
      <PageHeading
        title={`Welcome back, ${user.name.split(' ')[0]}! 👋`}
        description="Here’s what’s happening at your store today."
      >
        <span className="date-chip">
          <CalendarDays size={15} /> Sat, Oct 17, 2026
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
          value={money(total)}
          icon={ShoppingCart}
          note={`${recent.length} completed orders`}
        />
        <StatCard
          label="Total Orders"
          value={recent.length}
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
          value={admin ? products.length : units}
          icon={Package}
          color="amber"
          note={admin ? 'Across all categories' : 'In the selected period'}
        />
        <StatCard
          label={admin ? 'Low Stock Items' : 'Average Order'}
          value={
            admin
              ? lowStock.length
              : money(recent.length ? total / recent.length : 0)
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
            <strong>{money(total)}</strong>
            <span className="chart-trend">
              <TrendingUp size={14} /> Overview
            </span>
          </div>
          <p className="chart-description">
            Total revenue from {recent.length} orders
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
          action={<span className="mini-label">Last 7 days</span>}
        >
          <div className="chart-headline">
            <strong>
              {money(sales.reduce((sum, sale) => sum + sale.total, 0))}
            </strong>
          </div>
          <p className="chart-description">A little growth, every day</p>
          <LineChart values={weeklyRevenue} />
          <p className="chart-note">Illustrative weekly trend</p>
        </Card>
        <Card
          title={admin ? 'Category Distribution' : 'Payment Methods'}
          icon={ChartPie}
          action={<span className="mini-label">This week</span>}
        >
          <p className="chart-description chart-description-spaced">
            {admin
              ? 'A balanced basket of everyday essentials'
              : 'How your customers prefer to pay'}
          </p>
          <DonutChart
            segments={segments}
            value={admin ? products.length : sales.length}
            label={admin ? 'Products' : 'Orders'}
          />
          <p className="chart-note">
            {admin
              ? 'Illustrative category share'
              : 'Based on your demo transactions'}
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
                to="/admin/inventory?status=Low%20Stock"
              >
                View all <ArrowRight size={13} />
              </Link>
            }
          >
            <DataTable
              pageSize={4}
              caption="Low stock products"
              data={lowStock}
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
          <DataTable
            caption="Recent transactions"
            pageSize={4}
            data={sales.slice(0, 4)}
            columns={[
              {
                key: 'id',
                label: 'Order ID',
                render: (s) => (
                  <span className="font-medium">#{s.id.slice(4)}</span>
                ),
              },
              ...(admin
                ? [{ key: 'cashier', label: 'Cashier' }]
                : [
                    {
                      key: 'items',
                      label: 'Items',
                      render: (s) =>
                        s.items.reduce((sum, item) => sum + item.quantity, 0),
                    },
                  ]),
              {
                key: 'payment',
                label: 'Payment',
                render: (s) => (
                  <span className="payment-label">
                    <CreditCard size={13} />
                    {s.payment}
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
                render: (s) => <Badge>{s.status}</Badge>,
              },
            ]}
          />
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
