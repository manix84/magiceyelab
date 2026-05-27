import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout";
import { ServerErrorPage } from "./ErrorPage";

type AppErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundaryInner extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("MagicEyeLab render error", error, errorInfo);
  }

  componentDidUpdate(previousProps: AppErrorBoundaryProps) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppLayout>
          <ServerErrorPage />
        </AppLayout>
      );
    }

    return this.props.children;
  }
}

type AppErrorBoundaryWrapperProps = {
  children: ReactNode;
};

export function AppErrorBoundary({ children }: AppErrorBoundaryWrapperProps) {
  const location = useLocation();
  const resetKey = `${location.pathname}${location.search}${location.hash}`;

  return (
    <AppErrorBoundaryInner resetKey={resetKey}>
      {children}
    </AppErrorBoundaryInner>
  );
}
