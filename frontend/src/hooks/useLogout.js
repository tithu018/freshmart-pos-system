import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../store/slices/authSlice'
import { useToast } from '../components/ui'

export default function useLogout() {
  const dispatch = useDispatch(),
    navigate = useNavigate(),
    toast = useToast()
  const pending = useSelector((state) => state.auth.status === 'signingOut')
  return {
    pending,
    signOut: async () => {
      try {
        await dispatch(logout()).unwrap()
        navigate('/login', { replace: true })
      } catch (error) {
        toast(error.message || 'Unable to sign out. Please try again.')
      }
    },
  }
}
