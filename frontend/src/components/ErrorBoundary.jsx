import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Something went wrong</h2>
          <p className="text-sm text-slate-500 max-w-md text-center">
            {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
          </p>
          <button onClick={() => { this.setState({ error: null }); window.location.reload() }}
            className="btn-primary flex items-center gap-2 mt-2">
            <RefreshCw size={16} />
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary