import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import {
  Download,
  Package,
  Pencil,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  DataTable,
  PageHeading,
  ProductName,
  SearchInput,
} from '../../components/ui'
import ProductForm from '../../components/ProductForm'
import { downloadCsv, money, stockStatus } from '../../utils/format'

export default function Products() {
  const products = useSelector((state) => state.products.items),
    categories = useSelector((state) => state.products.categories)
  const [params, setParams] = useSearchParams(),
    query = params.get('q') || ''
  const [category, setCategory] = useState('All categories'),
    [status, setStatus] = useState('All statuses'),
    [editing, setEditing] = useState(undefined)
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()) &&
          (category === 'All categories' || p.category === category) &&
          (status === 'All statuses' || stockStatus(p) === status),
      ),
    [products, query, category, status],
  )
  return (
    <>
      <PageHeading
        title="Products"
        description="A well-stocked store starts with a great catalog."
      >
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv('freshmart-products.csv', [
              ['Product', 'SKU', 'Category', 'Price', 'Stock', 'Status'],
              ...filtered.map((p) => [
                p.name,
                p.sku,
                p.category,
                p.price,
                p.stock,
                stockStatus(p),
              ]),
            ])
          }
        >
          <Download size={16} />
          Export
        </Button>
        <Button onClick={() => setEditing(null)}>
          <Plus size={17} />
          Add product
        </Button>
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
            placeholder="Search products or SKU..."
          />
          <div className="table-filters">
            <select
              aria-label="Filter category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>All categories</option>
              {categories.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              aria-label="Filter stock status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {['All statuses', 'In Stock', 'Low Stock', 'Out of Stock'].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
            <SlidersHorizontal size={17} className="text-muted" />
          </div>
        </div>
        <DataTable
          data={filtered}
          caption="Product catalog"
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
              key: 'stock',
              label: 'Stock',
              render: (p) => (
                <span
                  className={
                    p.stock < p.minStock ? 'text-rose-500 font-semibold' : ''
                  }
                >
                  {p.stock}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (p) => <Badge>{stockStatus(p)}</Badge>,
            },
            {
              key: 'actions',
              label: 'Actions',
              className: 'text-right',
              render: (p) => (
                <button
                  className="icon-button"
                  aria-label={`Edit ${p.name}`}
                  onClick={() => setEditing(p)}
                >
                  <Pencil size={15} />
                </button>
              ),
            },
          ]}
        />
      </Card>
      {editing !== undefined && (
        <ProductForm product={editing} onClose={() => setEditing(undefined)} />
      )}
    </>
  )
}
