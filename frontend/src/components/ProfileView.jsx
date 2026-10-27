import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Check,
  Mail,
  MapPin,
  Pencil,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { saveProfile, restoreSession } from '../store/slices/authSlice'
import { Avatar, Badge, Button, Card, Field, PageHeading, useToast } from './ui'

export default function ProfileView() {
  const user = useSelector((state) => state.auth.user),
    [form, setForm] = useState({
      name: user.name,
      email: user.email,
      phone: user.phone,
    }),
    [editing, setEditing] = useState(false),
    [error, setError] = useState('')
  const dispatch = useDispatch(),
    toast = useToast(),
    admin = user.role === 'admin'
  const saving = useSelector((state) => state.auth.profileSaving)
  useEffect(() => {
    dispatch(restoreSession())
  }, [dispatch])
  useEffect(() => {
    if (!editing)
      setForm({ name: user.name, email: user.email, phone: user.phone || '' })
  }, [user.name, user.email, user.phone, editing])
  const field = (name) => ({
    value: form[name],
    readOnly: !editing || saving,
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  })
  return (
    <>
      <PageHeading
        title="My Profile"
        description="A little about the person behind the great work."
      />
      <div className="profile-layout">
        <Card className="profile-summary">
          <div className="profile-cover">
            <span />
            <span />
            <span />
          </div>
          <Avatar name={user.name} className="profile-avatar" />
          <h2>{user.name}</h2>
          <p>{admin ? 'Store Manager' : 'Store Cashier'}</p>
          <Badge>{admin ? 'Admin' : 'Cashier'}</Badge>
          <div className="profile-summary-details">
            <span>
              <Mail size={16} />
              {user.email}
            </span>
            <span>
              <MapPin size={16} />
              FreshMart · Main Branch
            </span>
            <span>
              <ShieldCheck size={16} />
              {admin ? 'Administrator workspace' : 'Cashier workspace'}
            </span>
          </div>
          <div className="profile-quote">
            A friendly face makes all the difference.
            <br />
            <span>Thanks for being part of FreshMart.</span>
          </div>
        </Card>
        <Card
          className="profile-form"
          title="Personal Information"
          icon={UserRound}
          action={
            !editing && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil size={14} />
                Edit profile
              </Button>
            )
          }
        >
          <p className="form-intro">
            Update your name and phone number. Contact an Admin to change your
            login email or role.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!form.name.trim()) return setError('Please enter your name.')
              setError('')
              try {
                await dispatch(saveProfile(form)).unwrap()
                setEditing(false)
                toast('Profile saved.')
              } catch (error) {
                setError(error.message || 'Unable to save profile.')
              }
            }}
          >
            <div className="form-grid">
              <Field
                label="Full name"
                className="col-span-full"
                required
                maxLength={80}
                {...field('name')}
              />
              <Field
                label="Email address"
                type="email"
                required
                {...field('email')}
                readOnly
              />
              <Field
                label="Phone number"
                type="tel"
                required
                {...field('phone')}
              />
              <Field
                label="Role"
                value={admin ? 'Admin (Store Manager)' : 'Cashier'}
                readOnly
              />
              <Field label="Employee ID" value={user.id} readOnly />
              <Field
                label="Store"
                className="col-span-full"
                value="FreshMart — Main Branch, Colombo"
                readOnly
              />
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {editing && (
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false)
                    setError('')
                    setForm({
                      name: user.name,
                      email: user.email,
                      phone: user.phone,
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <Check size={16} />
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
            )}
          </form>
          <div className="profile-access">
            <ShieldCheck size={20} />
            <div>
              <strong>
                {admin ? 'Administrator access' : 'Cashier access'}
              </strong>
              <p>
                {admin
                  ? 'Manage your catalog, team, customers, and store operations.'
                  : 'Access your dashboard, point of sale, and your own sales history.'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
