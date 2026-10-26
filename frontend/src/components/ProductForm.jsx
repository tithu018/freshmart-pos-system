import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { saveCatalogProduct } from '../store/slices/catalogSlice'
import { Button, Field, Modal, useToast } from './ui'

export default function ProductForm({ product, onClose }) {
  const { categories, saving } = useSelector((state) => state.catalog)
  const [form, setForm] = useState(
    product
      ? { ...product, barcode: product.barcode || '' }
      : {
          name: '',
          sku: '',
          barcode: '',
          categoryId: categories[0]?.id || '',
          price: '',
          description: '',
          status: 'ACTIVE',
          unit: 'each',
          icon: '📦',
          color: 'green',
        },
  )
  const [error, setError] = useState('')
  const dispatch = useDispatch(),
    toast = useToast()
  const field = (name) => ({
    value: form[name],
    disabled: saving,
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  })
  const close = () => {
    if (!saving) onClose()
  }
  return (
    <Modal
      title={product ? 'Edit product' : 'Add a fresh product'}
      onClose={close}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          if (!form.name.trim() || !form.sku.trim())
            return setError('Enter a product name and SKU.')
          if (!form.categoryId)
            return setError('Create and select a category first.')
          try {
            await dispatch(saveCatalogProduct(form)).unwrap()
            toast(
              product ? 'Product updated.' : 'Product added to your catalog.',
            )
            onClose()
          } catch (failure) {
            setError(failure.message || 'Unable to save the product.')
          }
        }}
      >
        <p className="form-intro">
          Keep your shelves and your catalog in sync.
        </p>
        {!categories.length && (
          <p role="alert" className="form-error">
            Add a category before creating a product.
          </p>
        )}
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
            <select required {...field('categoryId')}>
              <option value="" disabled>
                Select a category
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Barcode" maxLength={64} {...field('barcode')} />
          <Field
            label="Price ($)"
            type="number"
            min="0.01"
            max="9999999999.99"
            step="0.01"
            required
            {...field('price')}
          />
          <Field label="Unit" required maxLength={30} {...field('unit')} />
          <Field label="Status">
            <select {...field('status')}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
          <Field
            label="Description"
            className="col-span-full"
            maxLength={1000}
            {...field('description')}
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
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={close}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !categories.length}>
            {saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
