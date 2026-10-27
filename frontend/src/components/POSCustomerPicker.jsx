import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { UserRound } from 'lucide-react'
import { Badge, Button, Modal, SearchInput } from './ui'
import { loadCustomerOptions } from '../store/slices/peopleSlice'
import { setCustomer } from '../store/slices/cartSlice'

export default function POSCustomerPicker({ locked }) {
  const dispatch = useDispatch()
  const selected = useSelector((state) => state.cart.customer)
  const {
    lookup,
    lookupLoading: loading,
    lookupError: error,
  } = useSelector((state) => state.people)
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('')
  useEffect(() => {
    if (!open) return
    const timeout = setTimeout(() => dispatch(loadCustomerOptions(query)), 200)
    return () => clearTimeout(timeout)
  }, [dispatch, open, query])
  const choose = (customer) => {
    dispatch(setCustomer(customer))
    setOpen(false)
  }
  return (
    <>
      <div className="walk-in">
        <UserRound size={17} />
        <span>{selected?.name || 'Walk-in customer'}</span>
        <Badge tone="neutral">{selected ? 'Customer' : 'Guest'}</Badge>
        <button
          type="button"
          className="text-link"
          disabled={locked}
          onClick={() => setOpen(true)}
        >
          {selected ? 'Change' : 'Select customer'}
        </button>
      </div>
      {open && (
        <Modal title="Select customer" onClose={() => setOpen(false)}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search customer name or phone..."
          />
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => choose(null)}
          >
            Use guest checkout
          </Button>
          {loading && (
            <p role="status" className="p-4 text-muted">
              Loading customers…
            </p>
          )}
          {error && (
            <div>
              <p role="alert" className="form-error">
                {error}
              </p>
              <Button onClick={() => dispatch(loadCustomerOptions(query))}>
                Retry customers
              </Button>
            </div>
          )}
          {!loading && !error && lookup?.length === 0 && (
            <p className="p-4 text-muted">No active customers found.</p>
          )}
          {!loading &&
            !error &&
            lookup?.map((customer) => (
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 py-4 text-left"
                key={customer.id}
                onClick={() => choose(customer)}
              >
                <strong>{customer.name}</strong>
                <span className="text-muted">{customer.phone}</span>
              </button>
            ))}
          <p className="mt-4 text-xs text-muted">
            Showing up to 20 active customers. Refine your search to find
            someone else.
          </p>
        </Modal>
      )}
    </>
  )
}
