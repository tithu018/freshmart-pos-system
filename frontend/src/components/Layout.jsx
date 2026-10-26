import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import useMediaQuery from '../hooks/useMediaQuery'
import { useDispatch, useSelector } from 'react-redux'
import { loadInventory } from '../store/slices/inventorySlice'
export default function Layout() {
  const dispatch = useDispatch()
  const userId = useSelector((state) => state.auth.user?.id)
  const mobile = useMediaQuery('(max-width: 900px)')
  const [open, setOpen] = useState(false),
    location = useLocation()
  useEffect(() => {
    dispatch(loadInventory())
    const refresh = () => {
      if (document.visibilityState === 'visible') dispatch(loadInventory())
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [dispatch, location.pathname, userId])
  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const close = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open])
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar open={open} onClose={() => setOpen(false)} mobile={mobile} />
      <div className="workspace" inert={mobile && open}>
        <Header onMenu={() => setOpen(true)} />
        <main id="main-content" className="page-content">
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>© 2026 FreshMart POS. Made for a fresher everyday.</span>
          <span>
            <span className="status-dot" /> Signed in ·{' '}
            {/\/(products|categories|inventory)\/?$/.test(location.pathname)
              ? 'Changes are saved'
              : 'Business data remains a demo'}
          </span>
        </footer>
      </div>
    </div>
  )
}
