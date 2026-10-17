import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
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
  Smartphone,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import {
  addItem,
  changeQuantity,
  clearCart,
  removeItem,
} from '../store/slices/cartSlice'
import { reduceStock } from '../store/slices/productSlice'
import { addSale } from '../store/slices/salesSlice'
import { DEMO_DATE } from '../data/mockData'
import { money } from '../utils/format'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeading,
  SearchInput,
  useToast,
} from './ui'

export default function POSView() {
  const products = useSelector((state) => state.products.items),
    categories = useSelector((state) => state.products.categories),
    cart = useSelector((state) => state.cart.items),
    user = useSelector((state) => state.auth.user),
    settings = useSelector((state) => state.management.settings)
  const [params, setParams] = useSearchParams(),
    query = params.get('q') || ''
  const [category, setCategory] = useState('All items'),
    [checkout, setCheckout] = useState(false),
    [payment, setPayment] = useState('Cash'),
    [receipt, setReceipt] = useState(null),
    [checkoutError, setCheckoutError] = useState('')
  const dispatch = useDispatch(),
    toast = useToast()
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()) &&
          (category === 'All items' || p.category === category),
      ),
    [products, query, category],
  )
  const subtotal =
      Math.round(
        cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100,
      ) / 100,
    tax = Math.round(subtotal * settings.taxRate) / 100,
    total = Math.round((subtotal + tax) * 100) / 100,
    itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const completeSale = () => {
    const unavailable = cart.find(
      (item) =>
        item.quantity > (products.find((p) => p.id === item.id)?.stock || 0),
    )
    if (unavailable)
      return setCheckoutError(
        `${unavailable.name} has insufficient stock. Close checkout and adjust the quantity.`,
      )
    const sale = {
      id: `ORD-${Date.now().toString().slice(-8)}`,
      date: `${DEMO_DATE}T12:30:00`,
      cashierId: user.id,
      cashier: user.name,
      items: cart.map((item) => ({ ...item })),
      payment,
      subtotal,
      tax,
      total,
      status: 'Completed',
    }
    dispatch(addSale(sale))
    dispatch(reduceStock(cart))
    dispatch(clearCart())
    setCheckout(false)
    setReceipt(sale)
    toast('Demo sale completed. Inventory and sales history updated.')
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
              placeholder="Search products or enter SKU..."
            />
            <ScanBarcode size={22} />
          </div>
          <div className="category-pills" aria-label="Product category filters">
            {[
              'All items',
              ...categories
                .filter((c) => c.status === 'Active')
                .map((c) => c.name),
            ].map((name) => (
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
          <div className="product-grid">
            {filtered.map((product) => {
              const quantity =
                cart.find((i) => i.id === product.id)?.quantity || 0
              return (
                <button
                  key={product.id}
                  className={`product-card ${quantity ? 'in-cart' : ''}`}
                  disabled={product.stock === 0 || quantity >= product.stock}
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
          {!filtered.length && <EmptyState title="No products found" />}
        </div>
        <Card className="order-panel">
          <div className="order-heading">
            <h2>
              Current order <span>{itemCount}</span>
            </h2>
            <button
              className="icon-button"
              aria-label="Clear order"
              disabled={!cart.length}
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
                          disabled={item.quantity >= stock}
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
              <span>Tax ({settings.taxRate}%)</span>
              <strong>{money(tax)}</strong>
            </div>
            <div className="order-grand-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            <Button
              disabled={!cart.length}
              onClick={() => {
                setCheckoutError('')
                setCheckout(true)
              }}
            >
              <CreditCard size={18} />
              Checkout <ArrowRight size={17} />
            </Button>
            <p>Demo checkout · No payment will be collected</p>
          </div>
        </Card>
      </div>
      {checkout && (
        <Modal title="Complete your sale" onClose={() => setCheckout(false)}>
          <div className="checkout-total">
            <span>Total to pay</span>
            <strong>{money(total)}</strong>
            <small>{itemCount} items in this order</small>
          </div>
          <p className="field-label">Payment method</p>
          <div className="payment-options">
            {[
              ['Cash', Banknote],
              ['Credit Card', CreditCard],
              ['Debit Card', CreditCard],
              ['Mobile Pay', Smartphone],
            ].map(([name, Icon]) => (
              <button
                key={name}
                className={payment === name ? 'selected' : ''}
                onClick={() => setPayment(name)}
              >
                <Icon size={21} />
                {name}
                {payment === name && <Check size={14} />}
              </button>
            ))}
          </div>
          <p className="mock-note">
            This records a sale in the demo workspace only. No actual payment is
            processed.
          </p>
          {checkoutError && (
            <p role="alert" className="form-error">
              {checkoutError}
            </p>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setCheckout(false)}>
              Back
            </Button>
            <Button onClick={completeSale}>
              Complete demo sale <Check size={16} />
            </Button>
          </div>
        </Modal>
      )}
      {receipt && (
        <Modal title="Sale completed" onClose={() => setReceipt(null)}>
          <div className="receipt-success">
            <span>
              <Check size={28} />
            </span>
            <h3>Thank you for shopping fresh!</h3>
            <p>{receipt.id}</p>
          </div>
          <div className="receipt-items">
            {receipt.items.map((item) => (
              <div key={item.id}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <strong>{money(item.price * item.quantity)}</strong>
              </div>
            ))}
            <div>
              <span>Tax</span>
              <strong>{money(receipt.tax)}</strong>
            </div>
            <div className="receipt-total">
              <strong>Total · {receipt.payment}</strong>
              <strong>{money(receipt.total)}</strong>
            </div>
          </div>
          <p className="mock-note text-center">{settings.receiptFooter}</p>
          <Button className="w-full mt-5" onClick={() => setReceipt(null)}>
            Start a new order <ArrowRight size={16} />
          </Button>
        </Modal>
      )}
    </>
  )
}
