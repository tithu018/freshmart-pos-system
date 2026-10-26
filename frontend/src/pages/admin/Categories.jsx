import { useMemo, useState } from 'react'
import { Grid2X2, Pencil, Plus, Trash2 } from 'lucide-react'
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
import {
  saveCatalogCategory,
  deleteCatalogCategory,
} from '../../store/slices/catalogSlice'
import useCatalog from '../../hooks/useCatalog'
import CatalogFeedback from '../../components/CatalogFeedback'
import CatalogDeleteDialog from '../../components/CatalogDeleteDialog'

export default function Categories() {
  const catalog = useCatalog()
  const {
    categories,
    products,
    admin,
    dispatch,
    loading,
    saving,
    error: loadError,
  } = catalog
  const [query, setQuery] = useState(''),
    [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [error, setError] = useState('')
  const toast = useToast()
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
  const close = () => {
    if (!saving) setEditing(null)
  }
  const field = (name) => ({
    value: editing[name],
    disabled: saving,
    onChange: (e) => setEditing({ ...editing, [name]: e.target.value }),
  })
  return (
    <>
      <PageHeading
        title="Categories"
        description="A place for everything your customers love."
      >
        {admin && (
          <Button
            disabled={loading || !!loadError || saving}
            onClick={() =>
              open({
                name: '',
                description: '',
                icon: '📦',
                color: 'green',
                status: 'ACTIVE',
              })
            }
          >
            <Plus size={17} />
            Add category
          </Button>
        )}
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
        <CatalogFeedback {...catalog} />
        {!loading && !loadError && (
          <DataTable
            data={filtered}
            pageSize={8}
            caption="Product categories"
            emptyTitle={
              categories.length ? 'No results found' : 'No categories yet'
            }
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
              { key: 'productCount', label: 'Products' },
              {
                key: 'status',
                label: 'Status',
                render: (c) => (
                  <Badge>{c.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
                ),
              },
              ...(admin
                ? [
                    {
                      key: 'actions',
                      label: 'Actions',
                      className: 'text-right',
                      render: (c) => (
                        <>
                          <button
                            className="icon-button"
                            disabled={saving}
                            aria-label={`Edit ${c.name}`}
                            onClick={() => open({ ...c })}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-button"
                            disabled={saving}
                            aria-label={`Delete ${c.name}`}
                            onClick={() => setDeleting(c)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Card>
      {admin && editing && (
        <Modal
          title={editing.id ? 'Edit category' : 'Add category'}
          onClose={close}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setError('')
              if (!editing.name.trim())
                return setError('Enter a category name.')
              try {
                await dispatch(saveCatalogCategory(editing)).unwrap()
                toast('Category saved.')
                setEditing(null)
              } catch (failure) {
                setError(failure.message || 'Unable to save the category.')
              }
            }}
          >
            <div className="form-grid">
              <Field
                label="Category name"
                className="col-span-full"
                required
                maxLength={50}
                {...field('name')}
              />
              <Field
                label="Description"
                className="col-span-full"
                maxLength={120}
                {...field('description')}
              />
              <Field label="Symbol">
                <select {...field('icon')}>
                  {['📦', '🥬', '🥛', '🥐', '🥩', '🧃', '🍿', '🧴', '🌾'].map(
                    (icon) => (
                      <option key={icon}>{icon}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Status">
                <select {...field('status')}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
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
                disabled={saving}
                onClick={close}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save category'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {admin && deleting && (
        <CatalogDeleteDialog
          item={deleting}
          kind="category"
          action={deleteCatalogCategory}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
