import { Component, type ErrorInfo, type ReactNode } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { ServerErrorPage } from "./ErrorPage";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
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
