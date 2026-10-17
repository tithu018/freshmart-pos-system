import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Box,
  Check,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
} from 'lucide-react'
import { demoLogin } from '../../store/slices/authSlice'
import { demoUsers } from '../../data/mockData'
import Brand from '../../components/Brand'
import GroceryIllustration from '../../components/GroceryIllustration'
import { Button } from '../../components/ui'

export default function Login() {
  const [role, setRole] = useState('admin'),
    [email, setEmail] = useState(demoUsers.admin.email),
    [password, setPassword] = useState('freshmart'),
    [show, setShow] = useState(false)
  const dispatch = useDispatch(),
    navigate = useNavigate(),
    user = useSelector((state) => state.auth.user)
  if (user) return <Navigate to={`/${user.role}/dashboard`} replace />
  const chooseRole = (value) => {
    setRole(value)
    setEmail(demoUsers[value].email)
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="eyebrow">
            <Leaf size={14} /> FRESH THINKING. SMARTER RETAIL.
          </span>
          <h1>
            Your store.
            <br />A little <span>smarter.</span>
            <br />A lot fresher.
          </h1>
          <p>
            Good things happen when your store runs smoothly.
            <br className="hidden xl:block" /> Meet your everyday partner in
            smarter retail.
          </p>
          <div className="login-features">
            {[
              [
                ShoppingCart,
                'Fast & easy checkout',
                'Less waiting. More happy customers.',
                'green',
              ],
              [
                Box,
                'Inventory in harmony',
                'Know what’s in stock, at a glance.',
                'blue',
              ],
              [
                BarChart3,
                'Insights that matter',
                'A clearer picture of your every day.',
                'amber',
              ],
            ].map(([Icon, title, description, color]) => (
              <div key={title}>
                <span className={`feature-icon tint-${color}`}>
                  <Icon size={23} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
          <GroceryIllustration />
        </div>
        <div className="login-proof">
          <span>
            <Users size={19} />
            <strong>
              1,000+<small>Happy store owners</small>
            </strong>
          </span>
          <span>
            <Store size={19} />
            <strong>
              50+<small>Stores worldwide</small>
            </strong>
          </span>
          <span>
            <Sparkles size={19} />
            <strong>
              4.8/5<small>Customer happiness</small>
            </strong>
          </span>
        </div>
      </div>
      <div className="login-form-side">
        <span className="login-top-note">
          <ShieldCheck size={15} /> Your everyday retail companion
        </span>
        <div className="login-card">
          <span className="welcome-icon">👋</span>
          <h2>Welcome back!</h2>
          <p>Let’s make today a fresh start.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              dispatch(demoLogin(role))
              navigate(`/${role}/dashboard`)
            }}
          >
            <label className="field">
              <span>Email address</span>
              <div className="input-icon">
                <Mail size={17} />
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>
            <label className="field">
              <span>Password</span>
              <div className="input-icon">
                <LockKeyhole size={17} />
                <input
                  required
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <fieldset className="role-field">
              <legend>Choose your workspace</legend>
              <div className="role-options">
                {[
                  ['admin', 'Admin', 'Manage your store', ShieldCheck],
                  ['cashier', 'Cashier', 'Make every sale', ShoppingCart],
                ].map(([value, label, text, Icon]) => (
                  <label
                    key={value}
                    className={role === value ? 'selected' : ''}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={role === value}
                      onChange={() => chooseRole(value)}
                    />
                    <Icon size={20} />
                    <strong>{label}</strong>
                    <small>{text}</small>
                    <span className="role-check">
                      {role === value && <Check size={10} />}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" className="login-submit">
              Sign in to FreshMart <ArrowRight size={17} />
            </Button>
          </form>
          <div className="demo-info">
            <div>
              <span className="demo-info-icon">
                <Sparkles size={18} />
              </span>
              <strong>Take a look around</strong>
              <BadgeText />
            </div>
            <p>
              This is a frontend demo. Choose a role and use the prefilled
              details, or enter any email and password.
            </p>
            <small>No account needed. Changes reset on refresh.</small>
          </div>
        </div>
        <p className="login-copyright">
          © 2026 FreshMart POS. All rights reserved.
          <br />
          <span>Fresh possibilities. Every day.</span>
        </p>
      </div>
    </div>
  )
}
function BadgeText() {
  return <span className="demo-label">DEMO</span>
}
