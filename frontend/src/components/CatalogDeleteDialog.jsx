import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Button, Modal, useToast } from './ui'

export default function CatalogDeleteDialog({ item, kind, action, onClose }) {
  const dispatch = useDispatch(),
    toast = useToast()
  const saving = useSelector((state) => state.catalog.saving)
  const [error, setError] = useState('')
  return (
    <Modal
      title={`Delete ${kind}`}
      onClose={() => {
        if (!saving) onClose()
      }}
    >
      <p>
        Delete <strong>{item.name}</strong>? This cannot be undone.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={saving}
          onClick={async () => {
            setError('')
            try {
              await dispatch(action(item.id)).unwrap()
              toast(`${kind === 'product' ? 'Product' : 'Category'} deleted.`)
              onClose()
            } catch (failure) {
              setError(failure.message || 'Unable to delete. Please try again.')
            }
          }}
        >
          {saving ? 'Deleting…' : `Delete ${kind}`}
        </Button>
      </div>
    </Modal>
  )
}
