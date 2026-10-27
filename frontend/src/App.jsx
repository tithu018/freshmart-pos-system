import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'
import { ToastProvider } from './components/ui'
import AuthSession from './components/AuthSession'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthSession>
            <AppRoutes />
          </AuthSession>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
