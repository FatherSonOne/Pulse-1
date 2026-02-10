import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  featureName: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Specialized Error Boundary for Message Enhancement features.
 * Provides a compact inline fallback UI that doesn't disrupt the chat experience.
 */
export class MessageEnhancementErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[MessageEnhancement] ${this.props.featureName} failed:`, error);
    console.error('[MessageEnhancement] Stack:', errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <i className="fa-solid fa-plug-circle-exclamation text-amber-500 text-lg"></i>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {this.props.featureName} unavailable
            </p>
            <button
              onClick={this.handleRetry}
              className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap lazy-loaded enhancement bundles with error boundary
 */
export function withEnhancementErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureName: string
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const WithBoundary: React.FC<P> = (props: P) => (
    <MessageEnhancementErrorBoundary featureName={featureName}>
      <WrappedComponent {...props} />
    </MessageEnhancementErrorBoundary>
  );

  WithBoundary.displayName = `withEnhancementErrorBoundary(${displayName})`;
  return WithBoundary;
}

export default MessageEnhancementErrorBoundary;
