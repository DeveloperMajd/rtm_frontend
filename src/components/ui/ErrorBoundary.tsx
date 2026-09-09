import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * App-level error boundary. Catches render/lifecycle errors in the tree below
 * it so a single broken screen doesn't blank the whole SPA.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced to the console for now; a real logger (Sentry, etc.) would hook here.
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  handleReload = (): void => {
    window.location.assign('/')
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    return (
      <div className='empty-state' style={{ minHeight: '100dvh', justifyContent: 'center' }}>
        <h1 style={{ fontSize: '1.1rem' }}>Something went wrong</h1>
        <p>The page hit an unexpected error. Reloading usually fixes it.</p>
        <button type='button' className='btn primary' onClick={this.handleReload}>
          Reload app
        </button>
      </div>
    )
  }
}

export default ErrorBoundary
