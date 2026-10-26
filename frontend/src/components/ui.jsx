import {
  createContext,
  cloneElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  Search,
  X,
} from 'lucide-react'
import { initials } from '../utils/format'

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  )
}
export function Badge({ children, tone }) {
  const inferred = ['Low Stock', 'Out of Stock', 'Inactive'].includes(children)
    ? 'rose'
    : ['Cashier', 'Debit Card'].includes(children)
      ? 'blue'
      : 'green'
  return <span className={`badge badge-${tone || inferred}`}>{children}</span>
}
export function Avatar({ name, className = '' }) {
  return (
    <span className={`avatar ${className}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
export function ProductName({ product, detail = false }) {
  return (
    <div className="product-name">
      <span
        className={`product-thumb tint-${product.color || 'green'}`}
        aria-hidden="true"
      >
        {product.icon}
      </span>
      <span>
        <span className="font-semibold text-ink">{product.name}</span>
        {detail && (
          <small>
            {product.sku} · {product.unit}
          </small>
        )}
      </span>
    </div>
  )
}
export function PageHeading({ title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  )
}
export function Card({ children, className = '', title, action, icon: Icon }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-heading">
          <h2>
            {Icon && <Icon size={17} />}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'green',
  trend,
  note,
  down = false,
}) {
  return (
    <Card className="stat-card">
      <div className={`stat-icon tint-${color}`}>
        <Icon size={23} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="stat-label">{label}</p>
        <strong className="stat-value">{value}</strong>
        <div className="stat-foot">
          {trend && (
            <span className={down ? 'text-rose-500' : 'text-brand'}>
              {down ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
              {trend}
            </span>
          )}
          <span>{note || 'vs. previous period'}</span>
        </div>
      </div>
    </Card>
  )
}
export function Field({ label, children, hint, className = '', ...props }) {
  const id = useId()
  const controlProps = {
    id,
    'aria-labelledby': `${id}-label`,
    'aria-describedby': hint ? `${id}-hint` : undefined,
  }
  return (
    <label className={`field ${className}`} htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      {children ? (
        cloneElement(children, controlProps)
      ) : (
        <input {...controlProps} {...props} />
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  )
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}) {
  return (
    <div className={`search-input ${className}`}>
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
export function EmptyState({
  title = 'No results found',
  description = 'Try a different search or update your filters.',
  icon: Icon = PackageOpen,
  children,
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  )
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose()
        }
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  )
}
export function DataTable({
  columns,
  data,
  pageSize = 7,
  emptyTitle,
  caption = 'Records',
  pagination,
}) {
  const [page, setPage] = useState(1)
  const limit = pagination?.size || pageSize
  const total = pagination?.totalElements ?? data.length
  const pages = Math.max(1, Math.ceil(total / limit))
  const current = Math.min(pagination ? pagination.page + 1 : page, pages)
  const changePage = (next) =>
    pagination ? pagination.onPageChange(next - 1) : setPage(next)
  const visible = pagination
    ? data
    : data.slice((current - 1) * limit, current * limit)
  useEffect(() => {
    setPage(1)
  }, [data])
  return (
    <div className="table-container">
      <div className="table-scroll">
        <table>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={column.className}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && <EmptyState title={emptyTitle} />}
      <div className="table-footer">
        <span>
          Showing{' '}
          <strong>
            {data.length ? (current - 1) * limit + 1 : 0}–
            {data.length ? Math.min(current * limit, total) : 0}
          </strong>{' '}
          of <strong>{total}</strong> results
        </span>
        <div className="pagination">
          <button
            aria-label="Previous page"
            disabled={current === 1}
            onClick={() => changePage(current - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          {[...new Set([1, pages, current - 1, current, current + 1])]
            .filter((n) => n >= 1 && n <= pages)
            .sort((a, b) => a - b)
            .map((n, i, list) => (
              <span key={n} className="contents">
                {i > 0 && n - list[i - 1] > 1 && (
                  <span className="px-1">…</span>
                )}
                <button
                  aria-label={`Page ${n}`}
                  aria-current={n === current ? 'page' : undefined}
                  className={n === current ? 'active' : ''}
                  onClick={() => changePage(n)}
                >
                  {n}
                </button>
              </span>
            ))}
          <button
            aria-label="Next page"
            disabled={current === pages}
            onClick={() => changePage(current + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
const ToastContext = createContext(null)
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])
  return (
    <ToastContext.Provider
      value={(message) => setToast({ message, id: Date.now() })}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  )
}
export const useToast = () => useContext(ToastContext)
