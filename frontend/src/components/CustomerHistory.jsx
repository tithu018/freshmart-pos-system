import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { Button, DataTable, Modal } from './ui'
import { loadCustomerHistory, clearHistory } from '../store/slices/peopleSlice'
import { money } from '../utils/format'
import { salesDate, paymentLabel } from '../utils/sales'

export default function CustomerHistory({ customer, onClose }) {
  const dispatch = useDispatch()
  const [page, setPage] = useState(0)
  const {
    history,
    historyLoading: loading,
    historyError: error,
  } = useSelector((state) => state.people)
  const refresh = () =>
    dispatch(loadCustomerHistory({ id: customer.id, page, size: 5 }))
  useEffect(() => {
    dispatch(loadCustomerHistory({ id: customer.id, page, size: 5 }))
    return () => {
      dispatch(clearHistory())
    }
  }, [dispatch, customer.id, page])
  return (
    <Modal title={`${customer.name} · Purchase history`} onClose={onClose} wide>
      {loading && (
        <p role="status" className="p-4 text-muted">
          Loading purchases…
        </p>
      )}
      {error && (
        <div>
          <p role="alert" className="form-error">
            {error}
          </p>
          <Button onClick={refresh}>Retry purchases</Button>
        </div>
      )}
      {history && (
        <>
          <p className="p-4 text-muted">
            {history.summary.orders} purchases ·{' '}
            {money(history.summary.revenue)} total spending · {history.timeZone}
          </p>
          <DataTable
            data={history.content}
            caption="Customer purchases"
            emptyTitle="No purchases yet"
            pagination={{
              page,
              size: 5,
              totalElements: history.totalElements,
              onPageChange: setPage,
            }}
            columns={[
              {
                key: 'id',
                label: 'Sale',
                render: (sale) => (
                  <Link
                    className="text-link"
                    to={`/admin/sales?sale=${encodeURIComponent(sale.id)}`}
                  >
                    {sale.id.slice(0, 8)}…
                  </Link>
                ),
              },
              {
                key: 'occurredAt',
                label: 'Date',
                render: (sale) => salesDate(sale.occurredAt, history.timeZone),
              },
              { key: 'userName', label: 'Cashier' },
              { key: 'quantity', label: 'Items' },
              {
                key: 'payment',
                label: 'Payment',
                render: (sale) => paymentLabel(sale.payment),
              },
              {
                key: 'total',
                label: 'Amount',
                render: (sale) => money(sale.total),
              },
            ]}
          />
        </>
      )}
    </Modal>
  )
}
