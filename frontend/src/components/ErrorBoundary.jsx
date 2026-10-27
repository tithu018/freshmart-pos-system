import { Component } from 'react'
import Brand from './Brand'
import { Button } from './ui'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="auth-loading" role="alert">
        <Brand />
        <h1>Unable to display this page</h1>
        <p>
          Reload FreshMart to try again. A pending checkout will be recovered.
        </p>
        <Button onClick={() => window.location.reload()}>
          Reload FreshMart
        </Button>
      </div>
    )
  }
}
