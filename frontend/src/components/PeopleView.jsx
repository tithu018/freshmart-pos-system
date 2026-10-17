import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Pencil,
  Plus,
  UsersRound,
  UserCheck,
  HeartHandshake,
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
import { savePerson } from '../store/slices/managementSlice'
import { money } from '../utils/format'

export default function PeopleView({ type }) {
  const people = useSelector((state) => state.management[type]),
    customers = type === 'customers'
  const [query, setQuery] = useState(''),
    [editing, setEditing] = useState(null),
    [status, setStatus] = useState('All statuses'),
    [error, setError] = useState('')
  const dispatch = useDispatch(),
    toast = useToast()
  const filtered = useMemo(
    () =>
      people.filter(
        (p) =>
          `${p.name} ${p.email} ${p.phone}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (status === 'All statuses' || status === p.status),
      ),
    [people, query, status],
  )
  const open = (person) => {
    setError('')
    setEditing({ ...person })
  }
  const field = (name) => ({
    value: editing[name],
    onChange: (e) => setEditing({ ...editing, [name]: e.target.value }),
  })
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
          onClick={() =>
            open({
              name: '',
              email: '',
              phone: '',
              status: 'Active',
              ...(customers
                ? { visits: 0, spent: 0 }
                : { role: 'cashier', shift: 'Morning' }),
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
          value={people.length}
          icon={UsersRound}
          note={
            customers
              ? 'Part of your FreshMart community'
              : 'Making every day a little fresher'
          }
        />
        <StatCard
          label={customers ? 'Active Customers' : 'Active Employees'}
          value={people.filter((p) => p.status === 'Active').length}
          icon={UserCheck}
          color="blue"
          note="Ready for another great day"
        />
        <StatCard
          label={customers ? 'Customer Spending' : 'Cashiers'}
          value={
            customers
              ? money(people.reduce((s, p) => s + p.spent, 0))
              : people.filter((p) => p.role === 'cashier').length
          }
          icon={HeartHandshake}
          color="amber"
          note={
            customers
              ? 'Lifetime demo purchases'
              : 'At the heart of every checkout'
          }
        />
      </div>
      <Card>
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={`Search ${type}...`}
          />
          <select
            aria-label="Filter people status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All statuses</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
        <DataTable
          data={filtered}
          caption={customers ? 'Customers' : 'Employees'}
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
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            ...(customers
              ? [
                  { key: 'visits', label: 'Visits' },
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
                      <Badge tone={p.role === 'admin' ? 'purple' : 'blue'}>
                        {p.role === 'admin' ? 'Admin' : 'Cashier'}
                      </Badge>
                    ),
                  },
                  { key: 'shift', label: 'Shift' },
                ]),
            {
              key: 'status',
              label: 'Status',
              render: (p) => <Badge>{p.status}</Badge>,
            },
            {
              key: 'actions',
              label: '',
              render: (p) => (
                <button
                  className="icon-button"
                  aria-label={`Edit ${p.name}`}
                  onClick={() => open(p)}
                >
                  <Pencil size={15} />
                </button>
              ),
            },
          ]}
        />
      </Card>
      {editing && (
        <Modal
          title={`${editing.id ? 'Edit' : 'Add'} ${customers ? 'customer' : 'employee'}`}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!editing.name.trim()) return setError('Please enter a name.')
              if (
                people.some(
                  (p) =>
                    p.email.toLowerCase() ===
                      editing.email.trim().toLowerCase() && p.id !== editing.id,
                )
              )
                return setError('This email is already in use.')
              dispatch(
                savePerson({
                  type,
                  person: {
                    ...editing,
                    name: editing.name.trim(),
                    email: editing.email.trim(),
                  },
                }),
              )
              toast(`${customers ? 'Customer' : 'Employee'} saved.`)
              setEditing(null)
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
              />
              <Field label="Phone" type="tel" required {...field('phone')} />
              {!customers && (
                <>
                  <Field label="Role">
                    <select {...field('role')}>
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                    </select>
                  </Field>
                  <Field label="Shift">
                    <select {...field('shift')}>
                      <option>Morning</option>
                      <option>Evening</option>
                    </select>
                  </Field>
                </>
              )}
              <Field label="Status">
                <select {...field('status')}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </Field>
            </div>
            {!customers && (
              <p className="mock-note">
                This updates the team directory only. Login access is not
                connected in this demo.
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
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Save {customers ? 'customer' : 'employee'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
