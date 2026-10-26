import {
  BarChart3,
  Boxes,
  ChevronRight,
  CircleHelp,
  Grid2X2,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  UsersRound,
  Users,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import useLogout from '../hooks/useLogout'
import Brand from './Brand'
import { Avatar, useToast } from './ui'

export const adminLinks = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['pos', 'Point of Sale', ShoppingCart],
  ['products', 'Products', Package],
  ['categories', 'Categories', Grid2X2],
  ['inventory', 'Inventory', Boxes],
  ['sales', 'Sales', ShoppingBag],
  ['customers', 'Customers', UsersRound],
  ['employees', 'Employees', Users],
  ['reports', 'Reports', BarChart3],
  ['settings', 'Settings', Settings],
  ['profile', 'My Profile', UserRound],
]
export const cashierLinks = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['products', 'Products', Package],
  ['categories', 'Categories', Grid2X2],
  ['pos', 'Point of Sale', ShoppingCart],
  ['sales-history', 'Sales History', History],
  ['profile', 'My Profile', UserRound],
]

export default function Sidebar({ open, onClose, mobile }) {
  const { signOut, pending } = useLogout()
  const ref = useRef(null)
  useEffect(() => {
    if (!open || !mobile) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const focusable = () =>
      Array.from(ref.current.querySelectorAll('a, button')).filter(
        (element) => element.getClientRects().length > 0,
      )
    focusable()[0]?.focus()
    document.body.style.overflow = 'hidden'
    const trapFocus = (event) => {
      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0],
        last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const sidebar = ref.current
    sidebar.addEventListener('keydown', trapFocus)
    return () => {
      document.body.style.overflow = previousOverflow
      sidebar.removeEventListener('keydown', trapFocus)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open, mobile])
  const user = useSelector((state) => state.auth.user)
  const lowStock = useSelector(
    (state) =>
      state.products.items.filter((item) => item.stock < item.minStock).length,
  )
  const toast = useToast()
  const links = user.role === 'admin' ? adminLinks : cashierLinks
  return (
    <>
      <button
        className={`sidebar-backdrop ${open ? 'is-open' : ''}`}
        aria-label="Close navigation"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside
        ref={ref}
        className={`sidebar ${open ? 'is-open' : ''}`}
        aria-label="Main navigation"
        inert={mobile && !open}
        role={mobile && open ? 'dialog' : undefined}
        aria-modal={mobile && open ? true : undefined}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="store-switch">
          <span className="store-icon">
            <ShoppingBag size={18} />
          </span>
          <div>
            <strong>FreshMart Store</strong>
            <span>Main Branch · Colombo</span>
          </div>
          <span className="status-dot" />
        </div>
        <div className="nav-label">
          WORKSPACE <span>{user.role === 'admin' ? 'ADMIN' : 'CASHIER'}</span>
        </div>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={`/${user.role}/${path}`}
              onClick={onClose}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {path === 'inventory' && lowStock > 0 && (
                <span className="nav-count">{lowStock}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <CircleHelp size={21} />
            <strong>A little help?</strong>
            <p>Your store, running smoothly.</p>
            <button
              onClick={() =>
                toast(
                  'Demo guide: choose a page, explore the mock data, or try a sale in Point of Sale.',
                )
              }
            >
              Quick guide <ChevronRight size={14} />
            </button>
          </div>
          <div className="sidebar-account">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <span>
                {user.role === 'admin' ? 'Store Manager' : 'Store Cashier'}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={signOut}
              disabled={pending}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
