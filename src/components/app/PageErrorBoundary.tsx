import { Component, type ReactNode } from "react";
import { reportFailure } from "../../lib/failures/reportFailure";
import { useT } from "../../lib/i18n/i18n";
import { isReloadingForRelease } from "../../lib/reloadForNewRelease";

const classes = {
  card: "card p-6",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "mt-2 text-sm text-zinc-600",
  button: "btnPrimary mt-4",
} as const;

const PageFailed = () => {
  const t = useT();

  return (
    <div className={classes.card} role="alert">
      <h1 className={classes.title}>{t("common.pageFailedTitle")}</h1>
      <p className={classes.text}>{t("common.pageFailedText")}</p>
      <button type="button" className={classes.button} onClick={() => window.location.reload()}>
        {t("common.pageFailedReload")}
      </button>
    </div>
  );
};

type PageErrorBoundaryProps = {
  // Changing this (moving to another page) clears a failure.
  resetKey: string;
  children: ReactNode;
};

type PageErrorBoundaryState = { failed: boolean };

// Keeps the top bar and footer on screen when a page cannot be downloaded or
// crashes, so one bad page never leaves a blank screen. React only offers this
// as a class. Playbook: docs/support/site/page-loading.md.
class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): PageErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    if (isReloadingForRelease()) return;

    console.error("PAGE-001: a page failed to load or crashed.", error);
    reportFailure("load", error, "page");
  }

  componentDidUpdate(previous: PageErrorBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return isReloadingForRelease() ? null : <PageFailed />;
  }
}

export default PageErrorBoundary;
