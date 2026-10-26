import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  TriangleAlert,
  UserRound,
  LogOut,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from './ui'
import useLogout from '../hooks/useLogout'
import { selectLowStock } from '../store/slices/inventorySlice'

export default function Header({ onMenu }) {
  const { signOut, pending } = useLogout()
  const user = useSelector((state) => state.auth.user)
  const lowStockItems = useSelector(selectLowStock)
  const inventoryAvailable = useSelector(
    (state) => state.inventory.loaded && !state.inventory.error,
  )
  const lowStockCount = inventoryAvailable ? lowStockItems.length : 0
  const alerts = useSelector(
    (state) => state.management.settings.lowStockAlerts,
  )
  const [search, setSearch] = useState(''),
    [panel, setPanel] = useState(null)
  const ref = useRef(null),
    navigate = useNavigate()
  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setPanel(null)
    }
    const escape = (event) => {
      if (event.key === 'Escape') setPanel(null)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  return (
    <header className="header">
      <button
        className="icon-button mobile-menu"
        aria-label="Open navigation"
        onClick={onMenu}
      >
        <Menu size={22} />
      </button>
      <form
        className="header-search"
        onSubmit={(event) => {
          event.preventDefault()
          navigate(
            `/${user.role}/${user.role === 'admin' ? 'products' : 'pos'}?q=${encodeURIComponent(search)}`,
          )
          setSearch('')
        }}
      >
        <Search size={17} />
        <input
          aria-label="Search product catalog"
          placeholder="Search products, SKUs, and more..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <kbd>↵</kbd>
      </form>
      <div className="header-right" ref={ref}>
        <span className="demo-pill">
          <span /> Connected workspace
        </span>
        <div className="relative">
          <button
            className="icon-button notification-button"
            aria-label="Notifications"
            aria-expanded={panel === 'notifications'}
            onClick={() =>
              setPanel(panel === 'notifications' ? null : 'notifications')
            }
          >
            <Bell size={20} />
            {alerts && lowStockCount > 0 && (
              <span className="notification-dot" />
            )}
          </button>
          {panel === 'notifications' && (
            <div className="header-popover notification-popover">
              <h3>
                Notifications <span>{alerts && lowStockCount > 0 ? 1 : 0}</span>
              </h3>
              {alerts && lowStockCount ? (
                <>
                  <div className="notification-content">
                    <span className="tint-amber">
                      <TriangleAlert size={20} />
                    </span>
                    <div>
                      <strong>{lowStockCount} products need attention</strong>
                      <p>Stock is running low on a few store essentials.</p>
                    </div>
                  </div>
                  <Link
                    to={`/${user.role}/inventory?status=Needs%20Attention`}
                    onClick={() => setPanel(null)}
                  >
                    View inventory →
                  </Link>
                </>
              ) : (
                <p className="p-4 text-muted">
                  {inventoryAvailable
                    ? 'You’re all caught up.'
                    : 'Stock alerts are unavailable. Open Inventory to retry.'}
                </p>
              )}
            </div>
          )}
        </div>
        <span className="header-divider" />
        <div className="relative">
          <button
            className="user-menu"
            aria-label="Account menu"
            aria-expanded={panel === 'account'}
            onClick={() => setPanel(panel === 'account' ? null : 'account')}
          >
            <Avatar name={user.name} />
            <span>
              <strong>{user.name}</strong>
              <small>
                {user.role === 'admin' ? 'Store Manager' : 'Store Cashier'}
              </small>
            </span>
            <ChevronDown size={15} />
          </button>
          {panel === 'account' && (
            <div className="header-popover account-popover">
              <Link to={`/${user.role}/profile`} onClick={() => setPanel(null)}>
                <UserRound size={16} /> My profile
              </Link>
              <button onClick={signOut} disabled={pending}>
                <LogOut size={16} /> {pending ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
