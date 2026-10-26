import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Download,
  Eye,
  Package,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Modal,
  PageHeading,
  ProductName,
  SearchInput,
} from '../../components/ui'
import ProductForm from '../../components/ProductForm'
import CatalogFeedback from '../../components/CatalogFeedback'
import CatalogDeleteDialog from '../../components/CatalogDeleteDialog'
import useCatalog from '../../hooks/useCatalog'
import { deleteCatalogProduct } from '../../store/slices/catalogSlice'
import { downloadCsv, money } from '../../utils/format'

export default function Products() {
  const catalog = useCatalog()
  const { products, categories, admin, loading, error, saving } = catalog
  const [params, setParams] = useSearchParams(),
    query = params.get('q') || ''
  const [category, setCategory] = useState(''),
    [status, setStatus] = useState('')
  const [editing, setEditing] = useState(undefined),
    [deleting, setDeleting] = useState(null),
    [viewing, setViewing] = useState(null)
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          `${p.name} ${p.sku} ${p.barcode || ''} ${p.description}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (!category || p.categoryId === category) &&
          (!status || p.status === status),
      ),
    [products, query, category, status],
  )
  const statusLabel = (value) => (value === 'ACTIVE' ? 'Active' : 'Inactive')
  return (
    <>
      <PageHeading
        title="Products"
        description="A well-stocked store starts with a great catalog."
      >
        <Button
          variant="secondary"
          disabled={loading || !!error}
          onClick={() =>
            downloadCsv('freshmart-products.csv', [
              [
                'Product',
                'SKU',
                'Barcode',
                'Category',
                'Price',
                'Description',
                'Status',
              ],
              ...filtered.map((p) => [
                p.name,
                p.sku,
                p.barcode,
                p.category,
                p.price,
                p.description,
                statusLabel(p.status),
              ]),
            ])
          }
        >
          <Download size={16} />
          Export
        </Button>
        {admin && (
          <Button
            disabled={loading || !!error || saving}
            onClick={() => setEditing(null)}
          >
            <Plus size={17} />
            Add product
          </Button>
        )}
      </PageHeading>
      <Card>
        <div className="section-tabs">
          <span className="selected">
            <Package size={16} /> All products <b>{products.length}</b>
          </span>
          <span className="section-tabs-note">
            Your everyday essentials, organized.
          </span>
        </div>
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={(value) => setParams(value ? { q: value } : {})}
            placeholder="Search products, SKU or barcode..."
          />
          <div className="table-filters">
            <select
              aria-label="Filter category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter product status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <SlidersHorizontal size={17} className="text-muted" />
          </div>
        </div>
        <CatalogFeedback {...catalog} />
        {!loading && !error && (
          <DataTable
            data={filtered}
            caption="Product catalog"
            emptyTitle={
              products.length ? 'No results found' : 'No products yet'
            }
            columns={[
              {
                key: 'name',
                label: 'Product',
                render: (p) => <ProductName product={p} detail />,
              },
              { key: 'category', label: 'Category' },
              {
                key: 'price',
                label: 'Price',
                render: (p) => <strong>{money(p.price)}</strong>,
              },
              {
                key: 'barcode',
                label: 'Barcode',
                render: (p) => p.barcode || '—',
              },
              {
                key: 'status',
                label: 'Status',
                render: (p) => <Badge>{statusLabel(p.status)}</Badge>,
              },
              {
                key: 'actions',
                label: 'Actions',
                className: 'text-right',
                render: (p) => (
                  <>
                    <button
                      className="icon-button"
                      aria-label={`View ${p.name}`}
                      onClick={() => setViewing(p)}
                    >
                      <Eye size={15} />
                    </button>
                    {admin && (
                      <>
                        <button
                          className="icon-button"
                          disabled={saving}
                          aria-label={`Edit ${p.name}`}
                          onClick={() => setEditing(p)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={saving}
                          aria-label={`Delete ${p.name}`}
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </>
                ),
              },
            ]}
          />
        )}
      </Card>
      {admin && editing !== undefined && (
        <ProductForm product={editing} onClose={() => setEditing(undefined)} />
      )}
      {admin && deleting && (
        <CatalogDeleteDialog
          item={deleting}
          kind="product"
          action={deleteCatalogProduct}
          onClose={() => setDeleting(null)}
        />
      )}
      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          <div className="form-grid">
            {Object.entries({
              SKU: viewing.sku,
              Barcode: viewing.barcode || '—',
              Category: viewing.category,
              Price: money(viewing.price),
              Unit: viewing.unit,
              Status: statusLabel(viewing.status),
              Description: viewing.description || '—',
            }).map(([label, value]) => (
              <div className="field" key={label}>
                <span>{label}</span>
                <p>{value}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
