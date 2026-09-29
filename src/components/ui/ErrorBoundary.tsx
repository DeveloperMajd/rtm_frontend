import { Component, type ErrorInfo, type ReactNode } from 'react'
import ServerErrorPage from './ServerErrorPage'

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

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return this.props.fallback ?? <ServerErrorPage />
  }
}

export default ErrorBoundary
