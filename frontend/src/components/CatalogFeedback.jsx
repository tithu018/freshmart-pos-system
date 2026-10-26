import { Button } from './ui'

export default function CatalogFeedback({ loading, error, reload }) {
  if (loading)
    return (
      <p className="p-4 text-muted" role="status">
        Loading catalog…
      </p>
    )
  if (error)
    return (
      <div className="p-4">
        <p className="form-error" role="alert">
          {error}
        </p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  return null
}
