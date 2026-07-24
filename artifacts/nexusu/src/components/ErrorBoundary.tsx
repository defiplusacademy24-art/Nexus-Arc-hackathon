import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  stack?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Unknown error',
      stack: error?.stack,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Nexusu] Uncaught render error:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false, message: '', stack: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#030F1F]">
          <div className="text-center px-6 py-16 max-w-lg">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#2E3B4B]/40 flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-7 h-7 text-slate-400 dark:text-white/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-display font-bold text-[#030F1F] dark:text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-500 dark:text-white/50 mb-4 text-sm leading-relaxed">
              An unexpected error occurred while loading this screen.
            </p>
            {this.state.message && (
              <pre className="mb-6 text-left text-xs leading-relaxed text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3 overflow-auto max-h-40">
                {this.state.message}
              </pre>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => window.location.assign('/dashboard')}
                className="bg-[#6393C4] hover:bg-[#5289B8] text-white px-8 py-3 rounded-full text-sm font-semibold transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  this.reset();
                  window.location.reload();
                }}
                className="border border-stone-200 dark:border-white/15 text-stone-600 dark:text-white/70 px-8 py-3 rounded-full text-sm font-semibold transition-colors hover:bg-stone-50 dark:hover:bg-white/5"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
