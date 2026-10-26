import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { loadSaleDetails, clearSaleDetails } from '../store/slices/salesSlice'
import { Badge, Button, Modal } from './ui'
import { money } from '../utils/format'
import { paymentLabel, salesDate } from '../utils/sales'

export default function SaleDetailsModal({ id, onClose }) {
  const dispatch = useDispatch()
  const { details, detailsLoading, detailsError } = useSelector(
    (state) => state.sales,
  )
  const role = useSelector((state) => state.auth.user?.role)
  useEffect(() => {
    dispatch(loadSaleDetails(id))
    return () => {
      dispatch(clearSaleDetails())
    }
  }, [dispatch, id])
  const data = details?.sale.id === id ? details : null
  return (
    <Modal title="Transaction details" onClose={onClose} wide>
      {(detailsLoading || (!data && !detailsError)) && (
        <p role="status">Loading transaction…</p>
      )}
      {detailsError && (
        <>
          <p role="alert" className="form-error">
            {detailsError}
          </p>
          <Button
            variant="secondary"
            onClick={() => dispatch(loadSaleDetails(id))}
          >
            Try again
          </Button>
        </>
      )}
      {data && (
        <>
          <div className="sale-detail-header">
            <Badge>Completed</Badge>
            <span>{salesDate(data.sale.occurredAt, data.timeZone)}</span>
          </div>
          <p className="form-intro">
            Sale ID: {data.sale.id}
            <br />
            Served by {data.sale.userName} · {paymentLabel(data.sale.payment)}
          </p>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Transaction items</caption>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.sale.items.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      {item.name}
                      <small className="block text-muted">{item.sku}</small>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{money(item.price)}</td>
                    <td>{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="receipt-items">
            <div>
              <span>Subtotal</span>
              <strong>{money(data.sale.subtotal)}</strong>
            </div>
            <div>
              <span>Discount</span>
              <strong>−{money(data.sale.discount)}</strong>
            </div>
            <div>
              <span>Tax ({data.sale.taxRate}%)</span>
              <strong>{money(data.sale.tax)}</strong>
            </div>
            <div className="receipt-total">
              <strong>Total</strong>
              <strong>{money(data.sale.total)}</strong>
            </div>
          </div>
          <div className="modal-actions">
            <Link
              className="btn btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
              to={`/${role}/receipts/${encodeURIComponent(id)}`}
            >
              <Printer size={16} /> Print Receipt
            </Link>
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      )}
    </Modal>
  )
}
