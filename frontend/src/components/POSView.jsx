import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Minus,
  Plus,
  ScanBarcode,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import {
  addItem,
  changeQuantity,
  clearCart,
  removeItem,
  loadPOS,
  submitCheckout,
  setDiscount,
  setPayment,
  dismissReceipt,
  restoreCheckout,
  calculateTotals,
} from '../store/slices/cartSlice'
import { readPendingCheckout } from '../services/checkoutService'
import { money } from '../utils/format'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeading,
  SearchInput,
  useToast,
} from './ui'

export default function POSView() {
  const {
    products,
    items: cart,
    taxRate,
    maxTotal,
    discount,
    payment,
    receipt,
    attempt,
    submitting,
    loading,
    loaded,
    loadError,
    error: checkoutError,
  } = useSelector((state) => state.cart)
  const user = useSelector((state) => state.auth.user)
  const [params, setParams] = useSearchParams(),
    query = params.get('q') || ''
  const [category, setCategory] = useState('All items'),
    [checkout, setCheckout] = useState(false)
  const dispatch = useDispatch(),
    toast = useToast()
  useEffect(() => {
    if (!user?.id) return
    const saved = readPendingCheckout(user.id)
    if (saved) dispatch(restoreCheckout(saved))
    const refresh = () => dispatch(loadPOS())
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [dispatch, user?.id])
  const locked = submitting || !!attempt
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  )
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          `${p.name} ${p.sku} ${p.barcode || ''}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (category === 'All items' || p.category === category),
      ),
    [products, query, category],
  )
  const effectiveTax = attempt?.request.expectedTaxRate ?? taxRate
  const { subtotal, tax, total } = calculateTotals(cart, discount, effectiveTax)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const invalidDiscount =
    !Number.isFinite(Number(discount || 0)) ||
    Number(discount) < 0 ||
    Number(discount) > subtotal ||
    !/^\d*(\.\d{0,2})?$/.test(String(discount))
  const unavailable = cart.some(
    (item) =>
      item.quantity > (products.find((p) => p.id === item.id)?.stock || 0),
  )
  const invalidOrder =
    invalidDiscount || unavailable || total > maxTotal || subtotal > maxTotal
  const completeSale = async () => {
    try {
      await dispatch(submitCheckout()).unwrap()
      setCheckout(false)
      toast('Sale completed. Inventory updated.')
    } catch {
      /* The slice retains the cart and displays the API error. */
    }
  }
  return (
    <>
      <PageHeading
        title="Point of Sale"
        description="A fresh basket. A happy customer."
      >
        <span className="register-status">
          <span className="status-dot" /> Register 01 · Open
        </span>
      </PageHeading>
      <div className="pos-layout">
        <div className="pos-catalog">
          <div className="pos-search">
            <SearchInput
              value={query}
              onChange={(value) => setParams(value ? { q: value } : {})}
              placeholder="Search name, SKU or barcode..."
            />
            <ScanBarcode size={22} />
          </div>
          <div className="category-pills" aria-label="Product category filters">
            {['All items', ...categories].map((name) => (
              <button
                key={name}
                className={category === name ? 'active' : ''}
                onClick={() => setCategory(name)}
              >
                {name === 'All items' && <ShoppingBag size={15} />}
                {name}
              </button>
            ))}
          </div>
          <div className="pos-catalog-heading">
            <h2>{category}</h2>
            <span>{filtered.length} products</span>
          </div>
          {loading && (
            <p role="status" className="text-muted">
              Loading products…
            </p>
          )}
          {loadError && (
            <div>
              <p role="alert" className="form-error">
                {loadError}
              </p>
              <Button variant="secondary" onClick={() => dispatch(loadPOS())}>
                Try again
              </Button>
            </div>
          )}
          <div className="product-grid">
            {filtered.map((product) => {
              const quantity =
                cart.find((i) => i.id === product.id)?.quantity || 0
              return (
                <button
                  key={product.id}
                  className={`product-card ${quantity ? 'in-cart' : ''}`}
                  disabled={
                    locked ||
                    !loaded ||
                    !!loadError ||
                    loading ||
                    product.stock === 0 ||
                    quantity >= Math.min(product.stock, 1000000) ||
                    (!quantity && cart.length >= 100)
                  }
                  onClick={() => dispatch(addItem(product))}
                  aria-label={`Add ${product.name} to order`}
                >
                  <div className={`product-art tint-${product.color}`}>
                    <span aria-hidden="true">{product.icon}</span>
                    {quantity > 0 && <b>{quantity}</b>}
                    {product.stock === 0 && (
                      <span className="sold-out">Out of stock</span>
                    )}
                  </div>
                  <span className="product-card-category">
                    {product.category}
                  </span>
                  <strong>{product.name}</strong>
                  <span className="product-card-unit">
                    {product.unit} · {product.stock} in stock
                  </span>
                  <div className="product-card-bottom">
                    <strong>{money(product.price)}</strong>
                    <span>
                      <Plus size={16} />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
          {loaded && !loading && !loadError && !filtered.length && (
            <EmptyState title="No products found" />
          )}
        </div>
        <Card className="order-panel">
          <div className="order-heading">
            <h2>
              Current order <span>{itemCount}</span>
            </h2>
            <button
              className="icon-button"
              aria-label="Clear order"
              disabled={!cart.length || locked}
              onClick={() => dispatch(clearCart())}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="walk-in">
            <UserRound size={17} />
            <span>Walk-in customer</span>
            <Badge tone="neutral">Retail</Badge>
          </div>
          <div className="order-items">
            {!cart.length ? (
              <EmptyState
                title="A fresh start"
                description="Select a product to start your order."
                icon={ShoppingCart}
              />
            ) : (
              cart.map((item) => {
                const stock = products.find((p) => p.id === item.id)?.stock || 0
                return (
                  <div className="order-item" key={item.id}>
                    <span className={`product-thumb tint-${item.color}`}>
                      {item.icon}
                    </span>
                    <div className="order-item-info">
                      <strong>{item.name}</strong>
                      <small>
                        {money(item.price)} / {item.unit}
                      </small>
                      <div className="quantity-stepper">
                        <button
                          aria-label={`Decrease ${item.name}`}
                          disabled={locked}
                          onClick={() =>
                            item.quantity === 1
                              ? dispatch(removeItem(item.id))
                              : dispatch(
                                  changeQuantity({
                                    id: item.id,
                                    quantity: item.quantity - 1,
                                    stock,
                                  }),
                                )
                          }
                        >
                          <Minus size={12} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          aria-label={`Increase ${item.name}`}
                          disabled={
                            locked || item.quantity >= Math.min(stock, 1000000)
                          }
                          onClick={() =>
                            dispatch(
                              changeQuantity({
                                id: item.id,
                                quantity: item.quantity + 1,
                                stock,
                              }),
                            )
                          }
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="order-item-end">
                      <button
                        className="remove-item"
                        aria-label={`Remove ${item.name}`}
                        disabled={locked}
                        onClick={() => dispatch(removeItem(item.id))}
                      >
                        <X size={13} />
                      </button>
                      <strong>{money(item.price * item.quantity)}</strong>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="order-totals">
            <div>
              <span>Subtotal ({itemCount} items)</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div>
              <Field
                label="Discount amount"
                type="number"
                min="0"
                max={subtotal}
                step="0.01"
                value={discount}
                disabled={locked}
                onChange={(e) => dispatch(setDiscount(e.target.value))}
                placeholder="0.00"
              />
            </div>
            <div>
              <span>Tax ({effectiveTax}%)</span>
              <strong>{money(tax)}</strong>
            </div>
            <div className="order-grand-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            {!attempt && invalidDiscount && (
              <p role="alert" className="form-error">
                Enter a discount between zero and the subtotal, with up to two
                decimal places.
              </p>
            )}
            {!attempt && unavailable && (
              <p role="alert" className="form-error">
                Some items exceed available stock. Reduce the quantity or remove
                them.
              </p>
            )}
            {!attempt && (total > maxTotal || subtotal > maxTotal) && (
              <p role="alert" className="form-error">
                The order exceeds the supported total of {money(maxTotal)}.
              </p>
            )}
            <Button
              disabled={
                submitting ||
                (!attempt &&
                  (!cart.length ||
                    !loaded ||
                    !!loadError ||
                    loading ||
                    invalidOrder))
              }
              onClick={() => {
                setCheckout(true)
              }}
            >
              <CreditCard size={18} />
              {attempt ? 'Confirm pending checkout' : 'Checkout'}{' '}
              <ArrowRight size={17} />
            </Button>
            <p>Cash or simulated Card payment</p>
          </div>
        </Card>
      </div>
      {(checkout || attempt) && !receipt && (
        <Modal
          title="Complete your sale"
          onClose={() => {
            if (!locked) setCheckout(false)
          }}
        >
          <div className="checkout-total">
            <span>Total to pay</span>
            <strong>{money(total)}</strong>
            <small>{itemCount} items in this order</small>
          </div>
          <p className="field-label">Payment method</p>
          <div className="payment-options">
            {[
              ['CASH', 'Cash', Banknote],
              ['CARD', 'Card (simulated)', CreditCard],
            ].map(([value, name, Icon]) => (
              <button
                key={name}
                className={payment === value ? 'selected' : ''}
                disabled={locked}
                onClick={() => dispatch(setPayment(value))}
              >
                <Icon size={21} />
                {name}
                {payment === value && <Check size={14} />}
              </button>
            ))}
          </div>
          <p className="mock-note">
            {payment === 'CARD'
              ? 'Card payment is simulated. No card details are collected and no charge is made.'
              : 'Confirm that the cash payment has been received before completing the sale.'}
          </p>
          {attempt && !submitting && (
            <p role="status" className="mock-note">
              This order is awaiting confirmation. Retry to check its result
              without creating another sale.
            </p>
          )}
          {checkoutError && (
            <p role="alert" className="form-error">
              {checkoutError}
            </p>
          )}
          <div className="modal-actions">
            <Button
              variant="secondary"
              disabled={locked}
              onClick={() => setCheckout(false)}
            >
              Back
            </Button>
            <Button
              disabled={
                submitting ||
                (!attempt &&
                  (invalidOrder || !loaded || loading || !!loadError))
              }
              onClick={completeSale}
            >
              {submitting
                ? 'Completing…'
                : attempt
                  ? 'Retry checkout'
                  : 'Complete sale'}{' '}
              <Check size={16} />
            </Button>
          </div>
        </Modal>
      )}
      {receipt && (
        <Modal
          title="Sale completed"
          onClose={() => dispatch(dismissReceipt())}
        >
          <div className="receipt-success">
            <span>
              <Check size={28} />
            </span>
            <h3>Thank you for shopping fresh!</h3>
            <p>{receipt.id}</p>
          </div>
          <div className="receipt-items">
            {receipt.items.map((item) => (
              <div key={item.productId}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <strong>{money(item.lineTotal)}</strong>
              </div>
            ))}
            <div>
              <span>Discount</span>
              <strong>−{money(receipt.discount)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{money(receipt.tax)}</strong>
            </div>
            <div className="receipt-total">
              <strong>
                Total ·{' '}
                {receipt.payment === 'CARD' ? 'Card (simulated)' : 'Cash'}
              </strong>
              <strong>{money(receipt.total)}</strong>
            </div>
          </div>
          <p className="mock-note text-center">
            Thank you for shopping fresh. See you again!
          </p>
          <Link
            className="btn btn-secondary w-full mt-5"
            target="_blank"
            rel="noopener noreferrer"
            to={`/${user.role}/receipts/${encodeURIComponent(receipt.id)}`}
          >
            Print Receipt
          </Link>
          <Button
            className="w-full mt-5"
            onClick={() => dispatch(dismissReceipt())}
          >
            Start a new order <ArrowRight size={16} />
          </Button>
        </Modal>
      )}
    </>
  )
}
