import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'
import { ToastProvider } from './components/ui'
import AuthSession from './components/AuthSession'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthSession>
          <AppRoutes />
        </AuthSession>
      </ToastProvider>
    </BrowserRouter>
  )
}
