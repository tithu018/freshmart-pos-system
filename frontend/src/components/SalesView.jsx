import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
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
  Modal,
  PageHeading,
  SearchInput,
  StatCard,
} from './ui'
import { downloadCsv, money, saleDate } from '../utils/format'

export default function SalesView() {
  const user = useSelector((state) => state.auth.user),
    allSales = useSelector((state) => state.sales.items),
    admin = user.role === 'admin'
  const [query, setQuery] = useState(''),
    [payment, setPayment] = useState('All payments'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [selected, setSelected] = useState(null)
  const sales = useMemo(
    () =>
      allSales.filter(
        (s) =>
          (admin || s.cashierId === user.id) &&
          `${s.id} ${s.cashier}`.toLowerCase().includes(query.toLowerCase()) &&
          (payment === 'All payments' || s.payment === payment) &&
          (!from || s.date.slice(0, 10) >= from) &&
          (!to || s.date.slice(0, 10) <= to),
      ),
    [allSales, admin, user.id, query, payment, from, to],
  )
  const total = sales.reduce((sum, s) => sum + s.total, 0)
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
          onClick={() =>
            downloadCsv('freshmart-sales.csv', [
              [
                'Order ID',
                'Date',
                'Cashier',
                'Items',
                'Total',
                'Payment',
                'Status',
              ],
              ...sales.map((s) => [
                s.id,
                saleDate(s.date),
                s.cashier,
                s.items.reduce((n, i) => n + i.quantity, 0),
                s.total,
                s.payment,
                s.status,
              ]),
            ])
          }
        >
          <Download size={16} />
          Export sales
        </Button>
      </PageHeading>
      <div className="stats-grid stats-three">
        <StatCard
          label="Total Revenue"
          value={money(total)}
          icon={Banknote}
          note="In the selected period"
        />
        <StatCard
          label="Completed Orders"
          value={sales.length}
          icon={ReceiptText}
          color="blue"
          note="Every sale, accounted for"
        />
        <StatCard
          label="Average Order"
          value={money(sales.length ? total / sales.length : 0)}
          icon={ShoppingBag}
          color="amber"
          note="Average basket value"
        />
      </div>
      <Card>
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={
              admin ? 'Search order ID or cashier...' : 'Search order ID...'
            }
          />
          <div className="date-range">
            <input
              aria-label="Sales start date"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span>to</span>
            <input
              aria-label="Sales end date"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter payment method"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          >
            {[
              'All payments',
              'Cash',
              'Credit Card',
              'Debit Card',
              'Mobile Pay',
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <DataTable
          data={sales}
          caption="Sales transactions"
          columns={[
            {
              key: 'id',
              label: 'Order ID',
              render: (s) => (
                <button className="order-id" onClick={() => setSelected(s)}>
                  #{s.id}
                </button>
              ),
            },
            {
              key: 'date',
              label: 'Date & Time',
              render: (s) => saleDate(s.date),
            },
            ...(admin ? [{ key: 'cashier', label: 'Cashier' }] : []),
            {
              key: 'items',
              label: 'Items',
              render: (s) => s.items.reduce((n, i) => n + i.quantity, 0),
            },
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
                  {s.payment === 'Cash' ? (
                    <Banknote size={14} />
                  ) : (
                    <CreditCard size={14} />
                  )}
                  {s.payment}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (s) => <Badge>{s.status}</Badge>,
            },
            {
              key: 'actions',
              label: '',
              render: (s) => (
                <button
                  className="icon-button"
                  aria-label={`View ${s.id}`}
                  onClick={() => setSelected(s)}
                >
                  <Eye size={16} />
                </button>
              ),
            },
          ]}
        />
      </Card>
      {selected && (
        <Modal
          title={`Order #${selected.id}`}
          onClose={() => setSelected(null)}
        >
          <div className="sale-detail-header">
            <Badge>{selected.status}</Badge>
            <span>{saleDate(selected.date)}</span>
          </div>
          <p className="form-intro">
            Served by {selected.cashier} · {selected.payment}
          </p>
          <div className="receipt-items">
            {selected.items.map((item) => (
              <div key={item.id}>
                <span>
                  {item.icon} {item.name} × {item.quantity}
                </span>
                <strong>{money(item.price * item.quantity)}</strong>
              </div>
            ))}
            <div>
              <span>Tax</span>
              <strong>{money(selected.tax)}</strong>
            </div>
            <div className="receipt-total">
              <strong>Total</strong>
              <strong>{money(selected.total)}</strong>
            </div>
          </div>
          <div className="modal-actions">
            <Button onClick={() => setSelected(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
