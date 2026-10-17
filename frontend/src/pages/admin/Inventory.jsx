import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowDownUp,
  Boxes,
  Download,
  PackageCheck,
  TriangleAlert,
} from 'lucide-react'
import { adjustStock } from '../../store/slices/productSlice'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Modal,
  PageHeading,
  ProductName,
  SearchInput,
  StatCard,
  useToast,
} from '../../components/ui'
import { downloadCsv, money, stockStatus } from '../../utils/format'

export default function Inventory() {
  const products = useSelector((state) => state.products.items),
    categories = useSelector((state) => state.products.categories)
  const [params, setParams] = useSearchParams(),
    query = params.get('q') || '',
    status = params.get('status') || 'All stock'
  const [category, setCategory] = useState('All categories'),
    [editing, setEditing] = useState(null),
    [stock, setStock] = useState(0)
  const dispatch = useDispatch(),
    toast = useToast()
  const filterParam = (key, value) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next)
  }
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()) &&
          (category === 'All categories' || p.category === category) &&
          (status === 'All stock' ||
            (status === 'Low Stock'
              ? p.stock < p.minStock
              : stockStatus(p) === status)),
      ),
    [products, query, category, status],
  )
  return (
    <>
      <PageHeading
        title="Inventory"
        description="Healthy shelves. Happy customers. Stay one step ahead."
      >
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv('freshmart-inventory.csv', [
              ['Product', 'SKU', 'Current stock', 'Minimum stock', 'Status'],
              ...filtered.map((p) => [
                p.name,
                p.sku,
                p.stock,
                p.minStock,
                stockStatus(p),
              ]),
            ])
          }
        >
          <Download size={16} />
          Export inventory
        </Button>
      </PageHeading>
      <div className="stats-grid stats-three">
        <StatCard
          label="Units in Stock"
          value={products.reduce((sum, p) => sum + p.stock, 0)}
          icon={Boxes}
          note="Across your entire store"
        />
        <StatCard
          label="Inventory Value"
          value={money(products.reduce((sum, p) => sum + p.stock * p.price, 0))}
          icon={PackageCheck}
          color="blue"
          note="At current selling prices"
        />
        <StatCard
          label="Needs Attention"
          value={products.filter((p) => p.stock < p.minStock).length}
          icon={TriangleAlert}
          color="amber"
          note="Below the minimum stock level"
        />
      </div>
      <Card>
        <div className="table-toolbar">
          <SearchInput
            value={query}
            onChange={(value) => filterParam('q', value)}
            placeholder="Search inventory or SKU..."
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
              aria-label="Filter inventory status"
              value={status}
              onChange={(e) => filterParam('status', e.target.value)}
            >
              {['All stock', 'In Stock', 'Low Stock', 'Out of Stock'].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </div>
        </div>
        <DataTable
          data={filtered}
          caption="Inventory levels"
          columns={[
            {
              key: 'name',
              label: 'Product',
              render: (p) => <ProductName product={p} detail />,
            },
            { key: 'category', label: 'Category' },
            {
              key: 'stock',
              label: 'Current Stock',
              render: (p) => (
                <strong className={p.stock < p.minStock ? 'text-rose-500' : ''}>
                  {p.stock}
                </strong>
              ),
            },
            { key: 'minStock', label: 'Min. Stock' },
            {
              key: 'status',
              label: 'Status',
              render: (p) => <Badge>{stockStatus(p)}</Badge>,
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (p) => (
                <button
                  className="text-link"
                  onClick={() => {
                    setEditing(p)
                    setStock(p.stock)
                  }}
                >
                  <ArrowDownUp size={14} /> Adjust
                </button>
              ),
            },
          ]}
        />
      </Card>
      {editing && (
        <Modal title="Adjust stock" onClose={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              dispatch(adjustStock({ id: editing.id, stock: Number(stock) }))
              toast(`Stock updated for ${editing.name}.`)
              setEditing(null)
            }}
          >
            <ProductName product={editing} detail />
            <p className="form-intro mt-5">
              Enter the total quantity currently on your shelves.
            </p>
            <Field
              label="New stock quantity"
              type="number"
              min="0"
              step="1"
              required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Update stock</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
