import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { restoreSession, sessionExpired } from '../store/slices/authSlice'
import Brand from './Brand'

export default function AuthSession({ children }) {
  const dispatch = useDispatch()
  const { status, user, expiresAt } = useSelector((state) => state.auth)
  const { pathname } = useLocation()

  useEffect(() => {
    dispatch(restoreSession())
  }, [dispatch])
  useEffect(() => {
    if (!user) return
    const remaining = Date.parse(expiresAt) - Date.now()
    const timer = setTimeout(
      () => dispatch(sessionExpired()),
      Math.max(0, remaining),
    )
    const check = () => {
      if (document.visibilityState === 'visible') dispatch(restoreSession())
    }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [dispatch, user?.id, expiresAt])
  useEffect(() => {
    if (user && status === 'authenticated') dispatch(restoreSession())
  }, [dispatch, pathname, user?.id])

  if (status === 'initializing')
    return (
      <div className="auth-loading" role="status">
        <Brand />
        <p>Checking your session…</p>
      </div>
    )
  return children
}
