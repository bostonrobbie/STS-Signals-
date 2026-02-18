import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  RotateCcw,
  Bug,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
  retryCount: number;
}

/**
 * Enhanced Error Boundary with:
 * - User-friendly error messages
 * - Detailed diagnostics for debugging
 * - Copy error details functionality
 * - Common error pattern detection
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log error for debugging
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);

    // Report to error tracking service if available
    if (typeof window !== "undefined" && (window as any).reportError) {
      (window as any).reportError(error, errorInfo);
    }
  }

  /**
   * Analyze error and provide user-friendly message
   */
  getErrorAnalysis(): {
    title: string;
    description: string;
    suggestion: string;
  } {
    const error = this.state.error;
    const errorMessage = error?.message || "";
    const errorStack = error?.stack || "";

    // Check for common error patterns
    if (errorMessage.includes("is not defined")) {
      const match = errorMessage.match(/(\w+) is not defined/);
      const varName = match?.[1] || "Variable";
      return {
        title: "Missing Import or Variable",
        description: `The code tried to use "${varName}" but it wasn't imported or defined.`,
        suggestion:
          "This is usually caused by a missing import statement. The development team has been notified.",
      };
    }

    if (
      errorMessage.includes("Cannot read properties of undefined") ||
      errorMessage.includes("Cannot read property")
    ) {
      return {
        title: "Data Not Available",
        description:
          "The page tried to access data that hasn't loaded yet or doesn't exist.",
        suggestion:
          "Try refreshing the page. If the problem persists, some data may be missing.",
      };
    }

    if (errorMessage.includes("Cannot read properties of null")) {
      return {
        title: "Missing Component Reference",
        description:
          "A component tried to access something that no longer exists.",
        suggestion: "Try refreshing the page. This usually resolves the issue.",
      };
    }

    if (errorMessage.includes("Network") || errorMessage.includes("fetch")) {
      return {
        title: "Network Error",
        description: "There was a problem connecting to the server.",
        suggestion: "Check your internet connection and try again.",
      };
    }

    if (errorMessage.includes("Maximum update depth exceeded")) {
      return {
        title: "Infinite Loop Detected",
        description: "The page got stuck in a loop while updating.",
        suggestion:
          "This is a bug that needs to be fixed. Please report it to support.",
      };
    }

    if (errorStack.includes("useQuery") || errorStack.includes("useMutation")) {
      return {
        title: "Data Fetching Error",
        description: "There was a problem loading or saving data.",
        suggestion:
          "Try refreshing the page. If the problem persists, the server may be experiencing issues.",
      };
    }

    // Default error message
    return {
      title: "Something Went Wrong",
      description: errorMessage || "An unexpected error occurred.",
      suggestion:
        "Try refreshing the page. If the problem persists, please contact support.",
    };
  }

  /**
   * Generate error report for copying
   */
  getErrorReport(): string {
    const { error, errorInfo } = this.state;
    const timestamp = new Date().toISOString();
    const userAgent =
      typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
    const url =
      typeof window !== "undefined" ? window.location.href : "Unknown";

    return `
=== Error Report ===
Time: ${timestamp}
URL: ${url}
Browser: ${userAgent}

Error: ${error?.name || "Unknown"}: ${error?.message || "No message"}

Stack Trace:
${error?.stack || "No stack trace"}

Component Stack:
${errorInfo?.componentStack || "No component stack"}
`.trim();
  }

  handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(this.getErrorReport());
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error("Failed to copy error:", err);
    }
  };

  handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const analysis = this.getErrorAnalysis();
      const { copied, showDetails } = this.state;

      return (
        <div className="flex items-center justify-center min-h-screen p-4 sm:p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl">
            {/* Error Icon */}
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            {/* User-friendly Error Message */}
            <h1 className="text-2xl font-semibold text-foreground mb-2 text-center">
              {analysis.title}
            </h1>
            <p className="text-muted-foreground text-center mb-2 max-w-md">
              {analysis.description}
            </p>
            <p className="text-sm text-muted-foreground/70 text-center mb-6 max-w-md">
              {analysis.suggestion}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center mb-6">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer transition-opacity"
                )}
              >
                <RotateCcw size={16} />
                Reload Page
              </button>

              <button
                onClick={this.handleRetry}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-secondary text-secondary-foreground",
                  "hover:opacity-90 cursor-pointer transition-opacity"
                )}
              >
                <Bug size={16} />
                Try Again
              </button>
            </div>

            {/* Technical Details Toggle */}
            <button
              onClick={() => this.setState({ showDetails: !showDetails })}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              {showDetails ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
              {showDetails ? "Hide" : "Show"} Technical Details
            </button>

            {/* Technical Details */}
            {showDetails && (
              <div className="w-full">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Error Details
                  </span>
                  <button
                    onClick={this.handleCopyError}
                    className={cn(
                      "flex items-center gap-1 text-xs px-2 py-1 rounded",
                      "bg-muted hover:bg-muted/80 transition-colors"
                    )}
                  >
                    {copied ? (
                      <>
                        <Check size={12} className="text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copy Error
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 w-full rounded-lg bg-muted/50 border border-border overflow-auto max-h-64">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono">
                    <span className="text-destructive font-semibold">
                      {this.state.error?.name}: {this.state.error?.message}
                    </span>
                    {"\n\n"}
                    {this.state.error?.stack?.split("\n").slice(1).join("\n")}
                  </pre>
                </div>

                {this.state.errorInfo?.componentStack && (
                  <div className="mt-4">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      Component Stack
                    </span>
                    <div className="mt-2 p-4 w-full rounded-lg bg-muted/50 border border-border overflow-auto max-h-32">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Support Link */}
            <p className="text-xs text-muted-foreground/50 mt-6 text-center">
              If this keeps happening, please contact support with the error
              details above.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
