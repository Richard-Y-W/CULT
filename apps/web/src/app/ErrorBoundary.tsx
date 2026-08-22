import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * No error boundary existed anywhere in the frontend (pre-live audit
 * finding): a missing/malformed API field on a market-critical numeric
 * value (e.g. `asset.analytics.betaHeart.toFixed(2)` with no optional
 * chaining) would throw during render and blank the whole page with no
 * recovery, no user-visible error, and no way back except a manual reload.
 * This does not fix the missing optional chaining at each call site -- it
 * bounds the blast radius so one page's render bug can never take down the
 * shell (header/mode switcher/search stay usable) and always shows the user
 * something actionable instead of a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CULT render error", error, info.componentStack);
  }
  render() {
    if (this.state.error)
      return (
        <div className="render-error">
          <h2>This screen hit a rendering error.</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      );
    return this.props.children;
  }
}
