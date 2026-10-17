import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Bell, Check, ReceiptText, Store } from 'lucide-react'
import { Button, Card, Field, PageHeading, useToast } from '../../components/ui'
import { saveSettings } from '../../store/slices/managementSlice'

export default function Settings() {
  const settings = useSelector((state) => state.management.settings),
    [form, setForm] = useState({ ...settings })
  const dispatch = useDispatch(),
    toast = useToast(),
    field = (name) => ({
      value: form[name],
      onChange: (e) => setForm({ ...form, [name]: e.target.value }),
    })
  return (
    <>
      <PageHeading
        title="Settings"
        description="Make FreshMart feel right for your store."
      />
      <form
        className="settings-layout"
        onSubmit={(e) => {
          e.preventDefault()
          dispatch(saveSettings({ ...form, taxRate: Number(form.taxRate) }))
          toast('Store settings saved for this demo session.')
        }}
      >
        <div className="settings-main">
          <Card title="Store Details" icon={Store}>
            <p className="form-intro">
              The little details behind your everyday business.
            </p>
            <div className="form-grid">
              <Field label="Store name" required {...field('storeName')} />
              <Field
                label="Contact email"
                type="email"
                required
                {...field('email')}
              />
              <Field
                label="Phone number"
                type="tel"
                required
                {...field('phone')}
              />
              <Field label="Store address" required {...field('address')} />
            </div>
          </Card>
          <Card title="Checkout & Receipts" icon={ReceiptText}>
            <p className="form-intro">
              These preferences apply to new demo sales.
            </p>
            <div className="form-grid">
              <Field
                label="Sales tax (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                hint="Applied to your POS subtotal at checkout."
                {...field('taxRate')}
              />
              <Field
                label="Currency"
                value="USD — US Dollar ($)"
                readOnly
                hint="Demo catalog prices are in USD."
              />
              <Field label="Receipt footer" className="col-span-full">
                <textarea
                  rows={3}
                  maxLength={200}
                  required
                  {...field('receiptFooter')}
                />
              </Field>
            </div>
          </Card>
          <Card title="Notifications" icon={Bell}>
            <label className="toggle-row">
              <span>
                <strong>Low stock alerts</strong>
                <small>
                  A friendly heads-up when products need restocking.
                </small>
              </span>
              <input
                type="checkbox"
                className="toggle"
                checked={form.lowStockAlerts}
                onChange={(e) =>
                  setForm({ ...form, lowStockAlerts: e.target.checked })
                }
              />
            </label>
          </Card>
          <div className="settings-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setForm({ ...settings })
                toast('Unsaved changes discarded.')
              }}
            >
              Discard changes
            </Button>
            <Button type="submit">
              <Check size={16} />
              Save changes
            </Button>
          </div>
        </div>
        <aside className="settings-aside">
          <span className="stat-icon tint-green">
            <Store size={25} />
          </span>
          <h2>A store that’s yours.</h2>
          <p>
            Keep your details up to date and your checkout just the way you like
            it.
          </p>
          <div>
            <strong>Demo workspace</strong>
            <p>
              Settings are held in memory and reset when you refresh the page.
            </p>
          </div>
        </aside>
      </form>
    </>
  )
}
