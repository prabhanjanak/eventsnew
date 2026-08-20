import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/admin/events";
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || "An unexpected application condition occurred.";
      const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack || "";

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#0A0A0E] relative overflow-hidden font-sans">
          {/* Ambient Subtle Background Lighting (No Red) */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-600/15 via-violet-600/10 to-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Centered Glassmorphic Error Container */}
          <div className="relative z-10 w-full max-w-xl backdrop-blur-2xl bg-[#121218]/85 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-center space-y-6">
            
            {/* Top Indicator Badge (Muted Indigo/Violet Glass - Avoids Harsh Red) */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>System Diagnostic Monitor</span>
            </div>

            {/* Error Icon & Title */}
            <div className="space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 shadow-inner">
                <AlertTriangle className="w-7 h-7 text-indigo-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Interface State Notice
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                The application encountered an unexpected state while rendering this view. Your session and saved data remain completely safe.
              </p>
            </div>

            {/* Glassmorphic Error Explanation Box */}
            <div className="text-left bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                <span>Issue Summary</span>
                <span className="text-indigo-400">Captured Event</span>
              </div>
              <p className="text-xs font-mono text-zinc-200 break-words leading-relaxed">
                {errorMessage}
              </p>

              {errorStack && (
                <div className="pt-2 border-t border-white/5">
                  <button
                    onClick={this.toggleDetails}
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Terminal className="w-3 h-3 text-indigo-400" />
                    <span>{this.state.showDetails ? "Hide technical stack" : "Show technical details"}</span>
                  </button>
                  {this.state.showDetails && (
                    <pre className="mt-2 text-[10px] font-mono text-zinc-400 bg-black/60 p-3 rounded-xl max-h-40 overflow-auto whitespace-pre-wrap leading-relaxed border border-white/5">
                      {errorStack}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 border-none"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border-white/10 transition-all flex items-center justify-center gap-2"
              >
                <Home className="w-3.5 h-3.5 text-zinc-400" />
                <span>Events Directory</span>
              </Button>
            </div>

            {/* Footer Notice */}
            <div className="text-[11px] text-zinc-400">
              Sankara Multi-Event Platform • Version 3.0 Stabilized
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
