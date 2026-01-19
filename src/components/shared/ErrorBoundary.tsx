import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing.
 * 
 * Especially important for Android/mobile where certain features
 * (WebRTC, AudioContext, etc.) may not be fully supported.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log error details
    console.error(`[ErrorBoundary] ${this.props.componentName || 'Component'} crashed:`, error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    
    // Log platform info for debugging
    console.error('[ErrorBoundary] Platform:', {
      isNative: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      userAgent: navigator.userAgent
    });
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="h-full w-full flex items-center justify-center p-6 bg-gray-50 dark:bg-zinc-900">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <i className="fa fa-exclamation-triangle text-red-500 text-2xl"></i>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Something went wrong
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {this.props.componentName 
                ? `The ${this.props.componentName} encountered an error.`
                : 'This feature encountered an error.'}
              {Capacitor.isNativePlatform() && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  Some features may not be fully supported on mobile devices.
                </span>
              )}
            </p>

            {/* Error details (dev mode only) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="text-left text-xs bg-gray-100 dark:bg-zinc-800 rounded-lg p-3 mt-4">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400 font-medium">
                  Error Details
                </summary>
                <pre className="mt-2 overflow-auto text-red-600 dark:text-red-400 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors"
              >
                <i className="fa fa-refresh mr-2"></i>
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                <i className="fa fa-rotate-right mr-2"></i>
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.FC<P> {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary componentName={componentName}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
