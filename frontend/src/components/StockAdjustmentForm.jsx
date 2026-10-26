import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  adjustInventory,
  setStockThreshold,
} from '../store/slices/inventorySlice'
import { Button, Field, Modal, ProductName, useToast } from './ui'

export default function StockAdjustmentForm({
  product,
  threshold = false,
  onClose,
}) {
  const [type, setType] = useState('STOCK_IN'),
    [quantity, setQuantity] = useState('')
  const [minStock, setMinStock] = useState(product.minStock),
    [reason, setReason] = useState(''),
    [error, setError] = useState('')
  const saving = useSelector((state) => state.inventory.saving)
  const dispatch = useDispatch(),
    toast = useToast()
  const close = () => {
    if (!saving) onClose()
  }
  return (
    <Modal
      title={threshold ? 'Low-stock threshold' : 'Adjust stock'}
      onClose={close}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          const amount = Number(threshold ? minStock : quantity)
          if (
            !Number.isInteger(amount) ||
            amount < (threshold ? 0 : 1) ||
            amount > 1000000000
          )
            return setError(
              'Enter a valid whole quantity, up to 1,000,000,000.',
            )
          if (!threshold && !reason.trim())
            return setError('Enter a reason for this stock change.')
          try {
            await dispatch(
              threshold
                ? setStockThreshold({ id: product.id, minStock: amount })
                : adjustInventory({
                    id: product.id,
                    type,
                    quantity: amount,
                    reason: reason.trim(),
                  }),
            ).unwrap()
            toast(
              threshold
                ? 'Low-stock threshold saved.'
                : `Stock updated for ${product.name}.`,
            )
            onClose()
          } catch (failure) {
            setError(failure.message || 'Unable to save the stock change.')
          }
        }}
      >
        <ProductName product={product} detail />
        <p className="form-intro mt-5">
          Current stock: <strong>{product.stock}</strong> · Minimum stock:{' '}
          {product.minStock}
        </p>
        <div className="form-grid">
          {threshold ? (
            <Field
              label="Minimum stock"
              className="col-span-full"
              type="number"
              min="0"
              max="1000000000"
              step="1"
              required
              disabled={saving}
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              hint="Low stock means below this quantity. Zero stock always raises an alert."
            />
          ) : (
            <>
              <Field label="Movement type">
                <select
                  disabled={saving}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="STOCK_IN">Stock In</option>
                  <option value="STOCK_OUT">Stock Out</option>
                  <option value="RESTOCK">Restock</option>
                </select>
              </Field>
              <Field
                label={
                  type === 'STOCK_OUT'
                    ? 'Quantity to remove'
                    : 'Quantity to add'
                }
                type="number"
                min="1"
                max="1000000000"
                step="1"
                required
                disabled={saving}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <Field
                label="Reason"
                className="col-span-full"
                required
                maxLength={250}
                disabled={saving}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Delivery received or damaged items"
              />
            </>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={close}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : threshold ? 'Save threshold' : 'Update stock'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
