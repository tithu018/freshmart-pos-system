import { Navigate, Outlet, Route, Routes, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Layout from '../components/Layout'
import Login from '../pages/auth/Login'
import AdminDashboard from '../pages/admin/Dashboard'
import AdminPOS from '../pages/admin/POS'
import Products from '../pages/admin/Products'
import Categories from '../pages/admin/Categories'
import Inventory from '../pages/admin/Inventory'
import Sales from '../pages/admin/Sales'
import Customers from '../pages/admin/Customers'
import Employees from '../pages/admin/Employees'
import Reports from '../pages/admin/Reports'
import Settings from '../pages/admin/Settings'
import AdminProfile from '../pages/admin/Profile'
import CashierDashboard from '../pages/cashier/Dashboard'
import CashierPOS from '../pages/cashier/POS'
import SalesHistory from '../pages/cashier/SalesHistory'
import CashierProfile from '../pages/cashier/Profile'
import { EmptyState } from '../components/ui'

// UI routing follows the verified server session; API permissions are enforced in Spring Security.
function RoleGuard({ role }) {
  const user = useSelector((state) => state.auth.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to="/unauthorized" replace />
  return <Outlet />
}
function Unauthorized() {
  const user = useSelector((state) => state.auth.user)
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="not-found">
      <EmptyState
        title="This workspace isn’t available to your account"
        description={`You are signed in as ${user.role === 'admin' ? 'an Admin' : 'a Cashier'}. Please use your assigned workspace.`}
      >
        <Link className="btn btn-primary mt-5" to={`/${user.role}/dashboard`}>
          Back to my dashboard
        </Link>
      </EmptyState>
    </div>
  )
}
function HomeRedirect() {
  const user = useSelector((state) => state.auth.user)
  return <Navigate to={user ? `/${user.role}/dashboard` : '/login'} replace />
}
function NotFound() {
  const user = useSelector((state) => state.auth.user)
  return (
    <div className="not-found">
      <EmptyState
        title="This aisle is a little empty"
        description="We couldn’t find that page. Let’s get you back to familiar shelves."
      >
        <Link
          className="btn btn-primary mt-5"
          to={user ? `/${user.role}/dashboard` : '/login'}
        >
          Back to FreshMart
        </Link>
      </EmptyState>
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route element={<RoleGuard role="admin" />}>
        <Route path="/admin" element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="pos" element={<AdminPOS />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales" element={<Sales />} />
          <Route path="customers" element={<Customers />} />
          <Route path="employees" element={<Employees />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
      <Route element={<RoleGuard role="cashier" />}>
        <Route path="/cashier" element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CashierDashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="pos" element={<CashierPOS />} />
          <Route path="sales-history" element={<SalesHistory />} />
          <Route path="profile" element={<CashierProfile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
