import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { loadSaleDetails, clearSaleDetails } from '../store/slices/salesSlice'
import { Button } from '../components/ui'
import { money } from '../utils/format'
import { paymentLabel, salesDate } from '../utils/sales'
import './receipt.css'

export default function Receipt() {
  const { id } = useParams(),
    dispatch = useDispatch()
  const role = useSelector((state) => state.auth.user?.role)
  const { details, detailsLoading, detailsError } = useSelector(
    (state) => state.sales,
  )
  useEffect(() => {
    dispatch(loadSaleDetails(id))
    return () => {
      dispatch(clearSaleDetails())
    }
  }, [dispatch, id])
  const data = details?.sale.id === id ? details : null
  useEffect(() => {
    const previous = document.title
    document.title = data
      ? `${data.storeName} receipt ${data.sale.id}`
      : 'FreshMart receipt'
    return () => {
      document.title = previous
    }
  }, [data])
  return (
    <main className="receipt-page">
      <div className="receipt-controls">
        <Link
          className="btn btn-secondary"
          to={`/${role}/${role === 'admin' ? 'sales' : 'sales-history'}`}
        >
          Back to sales
        </Link>
        <Button
          disabled={!data || detailsLoading}
          onClick={() => window.print()}
        >
          <Printer size={16} /> Print Receipt
        </Button>
      </div>
      {(detailsLoading || (!data && !detailsError)) && (
        <p role="status">Loading receipt…</p>
      )}
      {detailsError && (
        <div className="receipt-error">
          <p role="alert">{detailsError}</p>
          <Button
            variant="secondary"
            onClick={() => dispatch(loadSaleDetails(id))}
          >
            Try again
          </Button>
        </div>
      )}
      {data && (
        <article className="receipt-paper" aria-label="Sales receipt">
          <header>
            <h1>{data.storeName}</h1>
            <p>SALES RECEIPT</p>
          </header>
          <dl className="receipt-meta">
            <dt>Sale ID</dt>
            <dd>{data.sale.id}</dd>
            <dt>Date</dt>
            <dd>
              {salesDate(data.sale.occurredAt, data.timeZone)}
              <small>{data.timeZone}</small>
            </dd>
            <dt>Cashier</dt>
            <dd>{data.sale.userName}</dd>
            <dt>Customer</dt>
            <dd>{data.sale.customerName || 'Guest'}</dd>
            <dt>Payment</dt>
            <dd>{paymentLabel(data.sale.payment)}</dd>
          </dl>
          <table className="receipt-lines">
            <caption className="sr-only">Purchased items</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Qty</th>
                <th scope="col">Price</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.sale.items.map((item) => (
                <tr key={item.productId}>
                  <td>
                    {item.name}
                    <small>{item.sku}</small>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{money(item.price)}</td>
                  <td>{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="receipt-sums">
            <dt>Subtotal</dt>
            <dd>{money(data.sale.subtotal)}</dd>
            <dt>Discount</dt>
            <dd>
              {data.sale.discount > 0 ? '−' : ''}
              {money(data.sale.discount)}
            </dd>
            <dt>Tax ({data.sale.taxRate}%)</dt>
            <dd>{money(data.sale.tax)}</dd>
            <dt className="grand">TOTAL</dt>
            <dd className="grand">{money(data.sale.total)}</dd>
          </dl>
          <footer>
            <p>
              {data.sale.items.reduce((sum, item) => sum + item.quantity, 0)}{' '}
              items · Completed
            </p>
            <strong>Thank you for shopping fresh!</strong>
            <p>Please keep this receipt for your records.</p>
            {data.sale.payment === 'CARD' && (
              <p>Simulated card payment — no card charge.</p>
            )}
          </footer>
        </article>
      )}
    </main>
  )
}
