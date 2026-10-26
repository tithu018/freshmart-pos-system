import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowDownUp,
  Boxes,
  Download,
  History,
  PackageCheck,
  Settings2,
  TriangleAlert,
} from 'lucide-react'
import {
  loadInventory,
  selectInventorySummary,
} from '../../store/slices/inventorySlice'
import {
  Badge,
  Button,
  Card,
  DataTable,
  PageHeading,
  ProductName,
  SearchInput,
  StatCard,
} from '../../components/ui'
import StockAdjustmentForm from '../../components/StockAdjustmentForm'
import StockHistory from '../../components/StockHistory'
import { downloadCsv, money, stockStatus } from '../../utils/format'

export default function Inventory() {
  const {
    items: products,
    loading,
    loaded,
    error,
    saving,
  } = useSelector((state) => state.inventory)
  const summary = useSelector(selectInventorySummary)
  const admin = useSelector((state) => state.auth.user?.role === 'admin')
  const dispatch = useDispatch()
  const [params, setParams] = useSearchParams(),
    query = params.get('q') || '',
    status = params.get('status') || 'All stock'
  const [category, setCategory] = useState(''),
    [editing, setEditing] = useState(null),
    [history, setHistory] = useState(undefined)
  const categories = useMemo(
    () =>
      [
        ...new Map(
          products.map((p) => [
            p.categoryId,
            { id: p.categoryId, name: p.category },
          ]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  )
  const filterParam = (key, value) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next)
  }
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          `${p.name} ${p.sku} ${p.barcode || ''}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (!category || p.categoryId === category) &&
          (status === 'All stock' ||
            (status === 'Needs Attention'
              ? p.stock === 0 || p.stock < p.minStock
              : stockStatus(p) === status)),
      ),
    [products, query, category, status],
  )
  const unavailable = !loaded || !!error
  return (
    <>
      <PageHeading
        title="Inventory"
        description="Healthy shelves. Happy customers. Stay one step ahead."
      >
        {admin && (
          <Button variant="secondary" onClick={() => setHistory(null)}>
            <History size={16} />
            Stock history
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={unavailable || loading}
          onClick={() =>
            downloadCsv('freshmart-inventory.csv', [
              [
                'Product',
                'SKU',
                'Category',
                'Current stock',
                'Minimum stock',
                'Status',
              ],
              ...filtered.map((p) => [
                p.name,
                p.sku,
                p.category,
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
          value={unavailable ? '—' : summary.units}
          icon={Boxes}
          note="Across your entire store"
        />
        <StatCard
          label="Inventory Value"
          value={unavailable ? '—' : money(summary.value)}
          icon={PackageCheck}
          color="blue"
          note="At current selling prices"
        />
        <StatCard
          label="Needs Attention"
          value={unavailable ? '—' : summary.lowStock + summary.outOfStock}
          icon={TriangleAlert}
          color="amber"
          note={
            unavailable
              ? 'Stock levels unavailable'
              : `${summary.lowStock} low stock · ${summary.outOfStock} out of stock`
          }
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
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter inventory status"
              value={status}
              onChange={(e) => filterParam('status', e.target.value)}
            >
              {[
                'All stock',
                'In Stock',
                'Low Stock',
                'Out of Stock',
                'Needs Attention',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        {loading || (!loaded && !error) ? (
          <p role="status" className="p-4 text-muted">
            Loading inventory…
          </p>
        ) : error ? (
          <div className="p-4">
            <p role="alert" className="form-error">
              {error}
            </p>
            <Button
              variant="secondary"
              onClick={() => dispatch(loadInventory())}
            >
              Try again
            </Button>
          </div>
        ) : (
          <DataTable
            data={filtered}
            caption="Inventory levels"
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
                key: 'stock',
                label: 'Current Stock',
                render: (p) => (
                  <strong
                    className={
                      p.stock === 0 || p.stock < p.minStock
                        ? 'text-rose-500'
                        : ''
                    }
                  >
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
              ...(admin
                ? [
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (p) => (
                        <>
                          <button
                            className="text-link"
                            disabled={saving}
                            aria-label={`Adjust ${p.name}`}
                            onClick={() => setEditing({ product: p })}
                          >
                            <ArrowDownUp size={14} /> Adjust
                          </button>
                          <button
                            className="icon-button"
                            disabled={saving}
                            aria-label={`Threshold for ${p.name}`}
                            onClick={() =>
                              setEditing({ product: p, threshold: true })
                            }
                          >
                            <Settings2 size={15} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`History for ${p.name}`}
                            onClick={() => setHistory(p)}
                          >
                            <History size={15} />
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
        <StockAdjustmentForm {...editing} onClose={() => setEditing(null)} />
      )}
      {admin && history !== undefined && (
        <StockHistory product={history} onClose={() => setHistory(undefined)} />
      )}
    </>
  )
}
