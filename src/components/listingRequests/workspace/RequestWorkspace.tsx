import type { ReactNode } from "react";
import { useT } from "../../../lib/i18n/i18n";
import { useWorkspace, WorkspaceProvider, type WorkspaceMobileTab } from "./WorkspaceContext";
type RequestWorkspaceProps = {
  header: ReactNode;
  nextStep: ReactNode;
  conversation: ReactNode;
  sections: ReactNode;
  footer?: ReactNode;
};

const classes = {
  page: "space-y-4 sm:space-y-5",
  // The flexible second row absorbs the tall side column so the next-step card and chat stay together.
  grid: "grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-5",
  next: "lg:col-start-1 lg:row-start-1",
  tabs:
    "sticky top-[84px] z-20 grid grid-cols-2 gap-1 rounded-full border border-[var(--hairline-strong)] bg-[rgb(var(--surface)/0.92)] p-1 shadow-[var(--shadow-sm)] backdrop-blur lg:hidden",
  tab: "rounded-full px-3 py-1.5 text-sm font-semibold transition",
  tabActive: "bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent-text))]",
  tabIdle: "text-zinc-600 hover:text-zinc-900",
  main: "min-w-0 lg:col-start-1 lg:row-start-2 lg:block",
  side:
    "card min-w-0 divide-y divide-[var(--hairline)] overflow-hidden hover:shadow-[var(--shadow-md)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block",
} as const;

const tabs = [
  { id: "messages", label: "workspace.messages" },
  { id: "project", label: "workspace.project" },
] as const satisfies readonly { id: WorkspaceMobileTab; label: string }[];

const WorkspaceBody = ({ header, nextStep, conversation, sections, footer }: RequestWorkspaceProps) => {
  const t = useT();
  const { mobileTab, setMobileTab } = useWorkspace();
  return (
    <div className={classes.page}>
      {header}

      <div className={classes.grid}>
        <div className={classes.next}>{nextStep}</div>

        <div className={classes.tabs} role="tablist" aria-label={t("workspace.views")}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab.id}
              className={`${classes.tab} ${mobileTab === tab.id ? classes.tabActive : classes.tabIdle}`}
              onClick={() => setMobileTab(tab.id)}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>

        {/* Both panes stay mounted on mobile so switching tabs never loses a draft message or form. */}
        <div className={`${classes.main} ${mobileTab === "messages" ? "" : "max-lg:hidden"}`}>
          {conversation}
        </div>

        <aside
          aria-label={t("workspace.details")}
          className={`${classes.side} ${mobileTab === "project" ? "" : "max-lg:hidden"}`}
        >
          {sections}
        </aside>
      </div>

      {footer}
    </div>
  );
};

const RequestWorkspace = (props: RequestWorkspaceProps) => (
  <WorkspaceProvider>
    <WorkspaceBody {...props} />
  </WorkspaceProvider>
);

export default RequestWorkspace;
