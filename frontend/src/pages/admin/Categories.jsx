import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Grid2X2, Pencil, Plus } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  PageHeading,
  SearchInput,
  useToast,
} from '../../components/ui'
import { saveCategory } from '../../store/slices/productSlice'

export default function Categories() {
  const categories = useSelector((state) => state.products.categories),
    products = useSelector((state) => state.products.items)
  const [query, setQuery] = useState(''),
    [editing, setEditing] = useState(null),
    [error, setError] = useState('')
  const dispatch = useDispatch(),
    toast = useToast()
  const filtered = useMemo(
    () =>
      categories.filter((c) =>
        `${c.name} ${c.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [categories, query],
  )
  const open = (category) => {
    setEditing(category)
    setError('')
  }
  return (
    <>
      <PageHeading
        title="Categories"
        description="A place for everything your customers love."
      >
        <Button
          onClick={() =>
            open({
              name: '',
              description: '',
              icon: '📦',
              color: 'green',
              status: 'Active',
            })
          }
        >
          <Plus size={17} />
          Add category
        </Button>
      </PageHeading>
      <div className="category-summary">
        <span className="stat-icon tint-green">
          <Grid2X2 size={24} />
        </span>
        <div>
          <strong>{categories.length} categories</strong>
          <p>Bringing a little order to your shelves.</p>
        </div>
        <span>{products.length} products in your catalog</span>
      </div>
      <Card>
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search categories..."
          />
        </div>
        <DataTable
          data={filtered}
          pageSize={8}
          caption="Product categories"
          columns={[
            {
              key: 'name',
              label: 'Category',
              render: (c) => (
                <div className="product-name">
                  <span className={`product-thumb tint-${c.color}`}>
                    {c.icon}
                  </span>
                  <strong>{c.name}</strong>
                </div>
              ),
            },
            { key: 'description', label: 'Description' },
            {
              key: 'products',
              label: 'Products',
              render: (c) =>
                products.filter((p) => p.category === c.name).length,
            },
            {
              key: 'status',
              label: 'Status',
              render: (c) => <Badge>{c.status}</Badge>,
            },
            {
              key: 'actions',
              label: 'Actions',
              className: 'text-right',
              render: (c) => (
                <button
                  className="icon-button"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => open({ ...c })}
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
          title={editing.id ? 'Edit category' : 'Add category'}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!editing.name.trim())
                return setError('Enter a category name.')
              if (
                categories.some(
                  (c) =>
                    c.name.toLowerCase() ===
                      editing.name.trim().toLowerCase() && c.id !== editing.id,
                )
              )
                return setError('This category already exists.')
              dispatch(saveCategory({ ...editing, name: editing.name.trim() }))
              toast('Category saved.')
              setEditing(null)
            }}
          >
            <div className="form-grid">
              <Field
                label="Category name"
                className="col-span-full"
                required
                maxLength={50}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
              <Field
                label="Description"
                className="col-span-full"
                required
                maxLength={120}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
              <Field label="Symbol">
                <select
                  value={editing.icon}
                  onChange={(e) =>
                    setEditing({ ...editing, icon: e.target.value })
                  }
                >
                  {['📦', '🥬', '🥛', '🥐', '🥩', '🧃', '🍿', '🧴', '🌾'].map(
                    (icon) => (
                      <option key={icon}>{icon}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value })
                  }
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </Field>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save category</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
