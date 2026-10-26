import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { loadCatalog } from '../store/slices/catalogSlice'

export default function useCatalog() {
  const dispatch = useDispatch()
  const catalog = useSelector((state) => state.catalog)
  const admin = useSelector((state) => state.auth.user?.role === 'admin')
  useEffect(() => {
    dispatch(loadCatalog())
  }, [dispatch])
  return { ...catalog, admin, dispatch, reload: () => dispatch(loadCatalog()) }
}
