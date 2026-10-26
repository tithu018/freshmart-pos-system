import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { loadStockHistory } from '../store/slices/inventorySlice'
import { Button, DataTable, Modal, SearchInput } from './ui'

const labels = {
  STOCK_IN: 'Stock In',
  STOCK_OUT: 'Stock Out',
  RESTOCK: 'Restock',
  THRESHOLD: 'Threshold',
}
export default function StockHistory({ product, onClose }) {
  const dispatch = useDispatch()
  const { history, historyLoading, historyError } = useSelector(
    (state) => state.inventory,
  )
  const [query, setQuery] = useState(''),
    [type, setType] = useState('')
  useEffect(() => {
    dispatch(loadStockHistory(product?.id))
  }, [dispatch, product?.id])
  const rows = useMemo(
    () =>
      history.filter(
        (item) =>
          (!type || item.type === type) &&
          `${item.productName} ${item.sku} ${item.reason} ${item.userName}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [history, query, type],
  )
  return (
    <Modal
      title={
        product ? `Stock history: ${product.name}` : 'Stock movement history'
      }
      onClose={onClose}
      wide
    >
      <div className="table-toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search stock history..."
        />
        <select
          aria-label="Filter movement type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All movements</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {historyLoading ? (
        <p role="status">Loading stock history…</p>
      ) : historyError ? (
        <>
          <p className="form-error" role="alert">
            {historyError}
          </p>
          <Button
            variant="secondary"
            onClick={() => dispatch(loadStockHistory(product?.id))}
          >
            Try again
          </Button>
        </>
      ) : (
        <DataTable
          caption="Stock movements"
          data={rows}
          emptyTitle="No stock movements found"
          columns={[
            {
              key: 'occurredAt',
              label: 'Date',
              render: (m) => new Date(m.occurredAt).toLocaleString(),
            },
            {
              key: 'productName',
              label: 'Product',
              render: (m) => (
                <span>
                  {m.productName}
                  <small className="block text-muted">{m.sku}</small>
                </span>
              ),
            },
            { key: 'type', label: 'Type', render: (m) => labels[m.type] },
            {
              key: 'quantity',
              label: 'Quantity',
              render: (m) =>
                m.type === 'THRESHOLD'
                  ? '—'
                  : `${m.type === 'STOCK_OUT' ? '−' : '+'}${m.quantity}`,
            },
            {
              key: 'balance',
              label: 'Before → After',
              render: (m) =>
                m.type === 'THRESHOLD'
                  ? `${m.thresholdBefore} → ${m.thresholdAfter} (min.)`
                  : `${m.stockBefore} → ${m.stockAfter}`,
            },
            { key: 'reason', label: 'Reason' },
            { key: 'userName', label: 'User' },
          ]}
        />
      )}
    </Modal>
  )
}
