import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for ADK-related errors
 * Catches errors in ADK agent components and displays a fallback UI
 */
export class ADKErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('ADK Error Boundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-destructive mb-1">ADK Agent Error</h3>
              <p className="text-sm text-muted-foreground mb-3">
                An error occurred while using the ADK agent. Please try again or select a different agent.
              </p>
              {this.state.error && (
                <p className="text-xs text-muted-foreground font-mono mb-3">
                  {this.state.error.message}
                </p>
              )}
              <button
                onClick={this.handleReset}
                className="px-3 py-1.5 text-sm rounded-md bg-background border border-border hover:bg-accent"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

