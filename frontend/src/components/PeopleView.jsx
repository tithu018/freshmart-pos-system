import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Pencil,
  Plus,
  UsersRound,
  UserCheck,
  HeartHandshake,
  History,
  Power,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  PageHeading,
  SearchInput,
  StatCard,
  useToast,
} from './ui'
import {
  loadEmployees,
  loadCustomers,
  savePerson,
} from '../store/slices/peopleSlice'
import { restoreSession, sessionExpired } from '../store/slices/authSlice'
import { money } from '../utils/format'
import CustomerHistory from './CustomerHistory'

export default function PeopleView({ type }) {
  const customers = type === 'customers'
  const state = useSelector((state) => state.people)
  const result = state[type],
    loading = state[`${type}Loading`],
    loadError = state[`${type}Error`],
    saving = state.saveLoading
  const user = useSelector((state) => state.auth.user)
  const [query, setQuery] = useState(''),
    [editing, setEditing] = useState(null),
    [status, setStatus] = useState(''),
    [role, setRole] = useState('')
  const [page, setPage] = useState(0),
    [error, setError] = useState(''),
    [history, setHistory] = useState(null)
  const dispatch = useDispatch(),
    toast = useToast()
  const load = customers ? loadCustomers : loadEmployees
  const filters = {
    q: query,
    enabled: status,
    ...(customers ? {} : { role }),
    page,
    size: 10,
  }
  const refresh = () => dispatch(load(filters))
  useEffect(() => {
    const refresh = () =>
      dispatch(
        (type === 'customers' ? loadCustomers : loadEmployees)({
          q: query,
          enabled: status,
          ...(type === 'customers' ? {} : { role }),
          page,
          size: 10,
        }),
      )
    const timer = setTimeout(refresh, 200)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [dispatch, type, query, status, role, page, user.id])
  const open = (person) => {
    setError('')
    setEditing({
      ...person,
      email: person.email || '',
      phone: person.phone || '',
      password: '',
    })
  }
  const field = (name) => ({
    value: editing[name],
    onChange: (e) => setEditing({ ...editing, [name]: e.target.value }),
    disabled: saving,
  })
  const save = async (person) => {
    setError('')
    try {
      const saved = await dispatch(savePerson({ type, person })).unwrap()
      if (!customers && saved.id === user.id) {
        if (
          saved.role.toLowerCase() !== user.role ||
          saved.email !== user.email ||
          person.password
        ) {
          dispatch(sessionExpired())
          return
        }
        dispatch(restoreSession())
      }
      setEditing(null)
      toast(`${customers ? 'Customer' : 'Employee'} saved.`)
      refresh()
    } catch (error) {
      setError(error.message || 'Unable to save these details.')
    }
  }
  const summary = !loading && !loadError ? result?.summary : null
  const people = !loading && !loadError ? result?.content || [] : []
  return (
    <>
      <PageHeading
        title={customers ? 'Customers' : 'Employees'}
        description={
          customers
            ? 'The familiar faces that make your store special.'
            : 'Great people. A great store. Meet your team.'
        }
      >
        <Button
          disabled={saving}
          onClick={() =>
            open({
              name: '',
              email: '',
              phone: '',
              enabled: true,
              role: 'CASHIER',
            })
          }
        >
          <Plus size={17} />
          Add {customers ? 'customer' : 'employee'}
        </Button>
      </PageHeading>
      <div className="stats-grid stats-three">
        <StatCard
          label={customers ? 'Total Customers' : 'Team Members'}
          value={summary?.total ?? '—'}
          icon={UsersRound}
          note={
            customers
              ? 'Part of your FreshMart community'
              : 'Making every day a little fresher'
          }
        />
        <StatCard
          label={customers ? 'Active Customers' : 'Active Employees'}
          value={summary?.active ?? '—'}
          icon={UserCheck}
          color="blue"
          note="Ready for another great day"
        />
        <StatCard
          label={customers ? 'Customer Spending' : 'Cashiers'}
          value={
            summary
              ? customers
                ? money(summary.spending)
                : summary.cashiers
              : '—'
          }
          icon={HeartHandshake}
          color="amber"
          note={
            customers
              ? 'Lifetime linked purchases'
              : 'At the heart of every checkout'
          }
        />
      </div>
      <Card>
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value)
              setPage(0)
            }}
            placeholder={`Search ${type}...`}
          />
          <select
            aria-label="Filter people status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(0)
            }}
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {!customers && (
            <select
              aria-label="Filter employee role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value)
                setPage(0)
              }}
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="CASHIER">Cashier</option>
            </select>
          )}
        </div>
        {loading && (
          <p role="status" className="p-4 text-muted">
            Loading {type}…
          </p>
        )}
        {loadError && (
          <div className="p-4">
            <p role="alert" className="form-error">
              {loadError}
            </p>
            <Button variant="secondary" onClick={refresh}>
              Retry {type}
            </Button>
          </div>
        )}
        {error && !editing && (
          <p role="alert" className="p-4 form-error">
            {error}
          </p>
        )}
        <DataTable
          data={people}
          caption={customers ? 'Customers' : 'Employees'}
          emptyTitle={
            loading
              ? 'Loading records…'
              : loadError
                ? 'Records unavailable'
                : 'No matching records'
          }
          pagination={{
            page,
            size: 10,
            totalElements: result?.totalElements || 0,
            onPageChange: setPage,
          }}
          columns={[
            {
              key: 'name',
              label: customers ? 'Customer' : 'Employee',
              render: (p) => (
                <div className="person-cell">
                  <Avatar name={p.name} />
                  <div>
                    <strong>{p.name}</strong>
                    <small>{p.id}</small>
                  </div>
                </div>
              ),
            },
            { key: 'email', label: 'Email', render: (p) => p.email || '—' },
            { key: 'phone', label: 'Phone' },
            ...(customers
              ? [
                  { key: 'visits', label: 'Purchases' },
                  {
                    key: 'spent',
                    label: 'Total Spent',
                    render: (p) => <strong>{money(p.spent)}</strong>,
                  },
                ]
              : [
                  {
                    key: 'role',
                    label: 'Role',
                    render: (p) => (
                      <Badge tone={p.role === 'ADMIN' ? 'purple' : 'blue'}>
                        {p.role === 'ADMIN' ? 'Admin' : 'Cashier'}
                      </Badge>
                    ),
                  },
                  {
                    key: 'joinedAt',
                    label: 'Joined',
                    render: (p) =>
                      new Intl.DateTimeFormat('en-US', {
                        timeZone: 'Asia/Colombo',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }).format(new Date(p.joinedAt)),
                  },
                ]),
            {
              key: 'enabled',
              label: 'Status',
              render: (p) => <Badge>{p.enabled ? 'Active' : 'Inactive'}</Badge>,
            },
            {
              key: 'actions',
              label: '',
              render: (p) => (
                <div className="flex gap-1">
                  {customers && (
                    <button
                      className="icon-button"
                      aria-label={`Purchase history for ${p.name}`}
                      onClick={() => setHistory(p)}
                    >
                      <History size={15} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    disabled={saving}
                    aria-label={`Edit ${p.name}`}
                    onClick={() => open(p)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={saving || (!customers && p.id === user.id)}
                    aria-label={`${p.enabled ? 'Deactivate' : 'Activate'} ${p.name}`}
                    onClick={() => save({ ...p, enabled: !p.enabled })}
                  >
                    <Power size={15} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {editing && (
        <Modal
          title={`${editing.id ? 'Edit' : 'Add'} ${customers ? 'customer' : 'employee'}`}
          onClose={() => {
            if (!saving) setEditing(null)
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save(editing)
            }}
          >
            <div className="form-grid">
              <Field
                label="Full name"
                className="col-span-full"
                required
                maxLength={100}
                {...field('name')}
              />
              <Field
                label={customers ? 'Email address (optional)' : 'Email address'}
                type="email"
                required={!customers}
                maxLength={254}
                {...field('email')}
              />
              <Field
                label="Phone"
                type="tel"
                required={customers}
                maxLength={40}
                {...field('phone')}
              />
              {!customers && (
                <>
                  <Field label="Role">
                    <select {...field('role')}>
                      <option value="CASHIER">Cashier</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </Field>
                  <Field
                    label={
                      editing.id
                        ? 'New password (optional)'
                        : 'Initial password'
                    }
                    type="password"
                    autoComplete="new-password"
                    required={!editing.id}
                    minLength={12}
                    maxLength={72}
                    {...field('password')}
                  />
                </>
              )}
              <Field label="Status">
                <select
                  disabled={saving || (!customers && editing.id === user.id)}
                  value={String(editing.enabled)}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      enabled: e.target.value === 'true',
                    })
                  }
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            </div>
            {!customers && (
              <p className="mock-note">
                Use at least 12 characters for new passwords. Role, status,
                email and password changes require signing in again. Leave the
                password blank to keep it unchanged.
              </p>
            )}
            {customers && (
              <p className="mock-note">
                Inactive customers retain their purchase history and cannot be
                selected for new sales.
              </p>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? 'Saving…'
                  : `Save ${customers ? 'customer' : 'employee'}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {history && (
        <CustomerHistory
          key={history.id}
          customer={history}
          onClose={() => setHistory(null)}
        />
      )}
    </>
  )
}
