import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { saveProduct } from '../store/slices/productSlice'
import { Button, Field, Modal, useToast } from './ui'

export default function ProductForm({ product, onClose }) {
  const categories = useSelector((state) => state.products.categories),
    products = useSelector((state) => state.products.items)
  const [form, setForm] = useState(
    product || {
      name: '',
      sku: '',
      category: categories[0].name,
      price: '',
      stock: 0,
      minStock: 10,
      unit: 'each',
      icon: '📦',
      color: 'green',
    },
  )
  const [error, setError] = useState(''),
    dispatch = useDispatch(),
    toast = useToast()
  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  })
  return (
    <Modal
      title={product ? 'Edit product' : 'Add a fresh product'}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!form.name.trim() || !form.sku.trim())
            return setError('Enter a product name and SKU.')
          if (
            products.some(
              (p) =>
                p.sku.toLowerCase() === form.sku.trim().toLowerCase() &&
                p.id !== form.id,
            )
          )
            return setError('A product with this SKU already exists.')
          dispatch(
            saveProduct({
              ...form,
              name: form.name.trim(),
              sku: form.sku.trim().toUpperCase(),
              price: Number(form.price),
              stock: Number(form.stock),
              minStock: Number(form.minStock),
            }),
          )
          toast(product ? 'Product updated.' : 'Product added to your catalog.')
          onClose()
        }}
      >
        <p className="form-intro">
          Keep your shelves and your catalog in sync.
        </p>
        <div className="form-grid">
          <Field
            label="Product name"
            className="col-span-full"
            required
            maxLength={80}
            {...field('name')}
          />
          <Field
            label="SKU"
            required
            maxLength={30}
            placeholder="e.g. FRU-015"
            {...field('sku')}
          />
          <Field label="Category">
            <select {...field('category')}>
              {categories.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Price ($)"
            type="number"
            min="0.01"
            step="0.01"
            required
            {...field('price')}
          />
          <Field label="Unit" required {...field('unit')} />
          <Field
            label="Opening stock"
            type="number"
            min="0"
            step="1"
            required
            {...field('stock')}
          />
          <Field
            label="Low stock threshold"
            type="number"
            min="1"
            step="1"
            required
            {...field('minStock')}
          />
          <Field label="Product symbol">
            <select {...field('icon')}>
              {[
                '📦',
                '🍌',
                '🍎',
                '🥛',
                '🍞',
                '🍗',
                '🍚',
                '🥤',
                '🍊',
                '🥚',
                '🍟',
                '💧',
                '🥦',
                '🥐',
                '🧴',
              ].map((icon) => (
                <option key={icon}>{icon}</option>
              ))}
            </select>
          </Field>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
