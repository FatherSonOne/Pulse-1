import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import './AIFeatureErrorBoundary.css';

interface Props {
  children: ReactNode;
  featureName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallbackUI?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class AIFeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error details
    console.error(`[AIFeatureErrorBoundary] ${this.props.featureName || 'AI Feature'} crashed:`, error);
    console.error('[AIFeatureErrorBoundary] Component stack:', errorInfo.componentStack);

    // Log error to external service if needed
    this.logErrorToService(error, errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo): void => {
    // In production, send to error tracking service (Sentry, LogRocket, etc.)
    const errorData = {
      featureName: this.props.featureName || 'AI Feature',
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      retryCount: this.state.retryCount
    };

    // TODO: Send to error tracking service
    // Example: Sentry.captureException(error, { extra: errorData });
  };

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: this.state.retryCount + 1
    });
  };

  handleDismiss = (): void => {
    // For non-critical AI features, allow user to dismiss the error
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback UI if provided
      if (this.props.fallbackUI) {
        return this.props.fallbackUI;
      }

      // Default fallback UI
      return (
        <div className="ai-feature-error-boundary">
          <div className="ai-error-container">
            <div className="ai-error-icon">
              <AlertTriangle size={32} />
            </div>

            <div className="ai-error-content">
              <h3 className="ai-error-title">
                {this.props.featureName || 'AI Feature'} Unavailable
              </h3>

              <p className="ai-error-message">
                This AI-powered feature encountered an error and could not load.
                {this.state.retryCount > 0 && (
                  <span className="retry-count"> (Retry attempt {this.state.retryCount})</span>
                )}
              </p>

              {import.meta.env.DEV && this.state.error && (
                <details className="ai-error-details">
                  <summary>Error Details (Dev Mode)</summary>
                  <pre className="ai-error-stack">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div className="ai-error-actions">
                <button
                  onClick={this.handleRetry}
                  className="ai-error-button retry"
                  title="Try to reload this feature"
                >
                  <RefreshCw size={16} />
                  <span>Retry</span>
                </button>

                <button
                  onClick={this.handleDismiss}
                  className="ai-error-button dismiss"
                  title="Hide this error message"
                >
                  <X size={16} />
                  <span>Dismiss</span>
                </button>
              </div>

              <p className="ai-error-note">
                The rest of the application is working normally. You can continue using other features.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AIFeatureErrorBoundary;
