import { useMemo, useState } from 'react'
import {
  BarChart3,
  CreditCard,
  Download,
  Package,
  ReceiptText,
  TrendingUp,
} from 'lucide-react'
import {
  Button,
  Card,
  DataTable,
  PageHeading,
  ProductName,
  StatCard,
} from '../../components/ui'
import { BarChart, DonutChart } from '../../components/Charts'
import { downloadCsv, money } from '../../utils/format'
import { DEMO_DATE, sales as demoSales } from '../../data/mockData'

export default function Reports() {
  const allSales = demoSales,
    [period, setPeriod] = useState('week')
  const sales = useMemo(
    () =>
      allSales.filter((s) => period === 'week' || s.date.startsWith(DEMO_DATE)),
    [allSales, period],
  )
  const revenue = sales.reduce((sum, s) => sum + s.total, 0),
    units = sales.reduce(
      (sum, s) => sum + s.items.reduce((count, i) => count + i.quantity, 0),
      0,
    )
  const topProducts = useMemo(() => {
    const grouped = {}
    sales.forEach((s) =>
      s.items.forEach((item) => {
        if (!grouped[item.id])
          grouped[item.id] = { ...item, sold: 0, revenue: 0 }
        grouped[item.id].sold += item.quantity
        grouped[item.id].revenue += item.quantity * item.price
      }),
    )
    return Object.values(grouped).sort((a, b) => b.revenue - a.revenue)
  }, [sales])
  const segments = ['Cash', 'Credit Card', 'Debit Card', 'Mobile Pay'].map(
    (label, i) => ({
      label,
      value: sales.filter((s) => s.payment === label).length,
      color: ['#12b76a', '#36a7fa', '#8b5cf6', '#ffba45'][i],
    }),
  )
  const days = ['12', '13', '14', '15', '16', '17', '18'],
    values = days.map((day) =>
      Math.round(
        sales
          .filter((s) => s.date.startsWith(`2026-10-${day}`))
          .reduce((sum, s) => sum + s.total, 0),
      ),
    )
  return (
    <>
      <PageHeading
        title="Reports"
        description="A clearer picture of how your store is doing."
      >
        <select
          aria-label="Report period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="week">This week · Oct 12–18</option>
          <option value="today">Today · Oct 17</option>
        </select>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv('freshmart-report.csv', [
              ['Metric', 'Value'],
              [
                'Period',
                period === 'today' ? DEMO_DATE : '2026-10-12 to 2026-10-18',
              ],
              ['Revenue', revenue.toFixed(2)],
              ['Orders', sales.length],
              ['Items sold', units],
              [],
              ['Product', 'Units sold', 'Revenue'],
              ...topProducts.map((p) => [p.name, p.sold, p.revenue.toFixed(2)]),
            ])
          }
        >
          <Download size={16} />
          Download report
        </Button>
      </PageHeading>
      <div className="stats-grid">
        <StatCard
          label="Total Revenue"
          value={money(revenue)}
          icon={TrendingUp}
          note="Selected period"
        />
        <StatCard
          label="Transactions"
          value={sales.length}
          icon={ReceiptText}
          color="blue"
          note="Completed sales"
        />
        <StatCard
          label="Items Sold"
          value={units}
          icon={Package}
          color="amber"
          note="Products taken home"
        />
        <StatCard
          label="Average Sale"
          value={money(sales.length ? revenue / sales.length : 0)}
          icon={CreditCard}
          color="purple"
          note="Per transaction"
        />
      </div>
      <div className="reports-grid">
        <Card title="Revenue by Day" icon={BarChart3}>
          <div className="chart-headline">
            <strong>{money(revenue)}</strong>
          </div>
          <p className="chart-description">
            Based on the selected demo transactions
          </p>
          <BarChart values={values} labels={days.map((day) => `Oct ${day}`)} />
        </Card>
        <Card title="Payment Breakdown" icon={CreditCard}>
          <p className="chart-description chart-description-spaced">
            Every way your customers pay
          </p>
          <DonutChart segments={segments} value={sales.length} label="Orders" />
        </Card>
      </div>
      <Card
        title="Best-selling Products"
        icon={Package}
        action={<span className="mini-label">By revenue</span>}
      >
        <DataTable
          data={topProducts}
          caption="Best-selling products"
          pageSize={5}
          columns={[
            {
              key: 'name',
              label: 'Product',
              render: (p) => <ProductName product={p} />,
            },
            { key: 'category', label: 'Category' },
            { key: 'sold', label: 'Units Sold' },
            {
              key: 'revenue',
              label: 'Revenue',
              render: (p) => <strong>{money(p.revenue)}</strong>,
            },
          ]}
        />
      </Card>
    </>
  )
}
