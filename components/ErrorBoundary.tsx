'use client';

import { Component, ReactNode } from 'react';
import { isServerActionError, handleServerActionError, promptRefreshOnServerActionError } from '@/lib/utils/serverActionErrorHandler';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  isServerActionError: boolean;
  shouldRefresh: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, isServerActionError: false, shouldRefresh: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const isServerActionErr = isServerActionError(error);
    const shouldRefresh = isServerActionErr && promptRefreshOnServerActionError(error);
    
    // Handle Server Action errors defensively
    if (isServerActionErr) {
      const handled = handleServerActionError(error);
      console.warn('[ErrorBoundary] Server Action error detected:', handled);
    }

    return { 
      hasError: true, 
      error, 
      isServerActionError: isServerActionErr,
      shouldRefresh: shouldRefresh || false,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log Server Action errors with additional context
    if (isServerActionError(error)) {
      const handled = handleServerActionError(error);
      console.error('[ErrorBoundary] Server Action error caught:', {
        error,
        handled,
        errorInfo,
      });
    } else {
      // Log error to error reporting service in production
      if (process.env.NODE_ENV === 'production') {
        // TODO: Send to error reporting service (e.g., Sentry, LogRocket)
        // errorReportingService.captureException(error, { extra: errorInfo });
      } else {
        console.error('Error caught by boundary:', error, errorInfo);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Custom message for Server Action errors
      const errorMessage = this.state.isServerActionError
        ? this.state.shouldRefresh
          ? 'The page needs to be refreshed to sync with the server. This usually happens after a code update.'
          : 'An action failed because it\'s no longer available. Please refresh the page and try again.'
        : 'We\'re sorry, but something unexpected happened. Please try refreshing the page.';

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border-2 border-red-500 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              {this.state.isServerActionError ? 'Action Unavailable' : 'Something went wrong'}
            </h2>
            <p className="text-gray-700 mb-4">
              {errorMessage}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined, isServerActionError: false, shouldRefresh: false });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Refresh Page
              </button>
              {this.state.isServerActionError && (
                <button
                  onClick={() => {
                    // Clear browser cache and reload
                    if ('caches' in window) {
                      caches.keys().then((names) => {
                        names.forEach((name) => caches.delete(name));
                      });
                    }
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Clear Cache & Refresh
                </button>
              )}
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-600">Error details</summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                  {this.state.isServerActionError && '\n\n[Server Action Error - Usually caused by stale client references]'}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

