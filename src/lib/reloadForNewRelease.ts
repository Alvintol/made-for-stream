const STORAGE_KEY = "mfs.reloadedForRelease";
const MIN_GAP_MS = 60_000;

let reloading = false;

// True once a reload has started. The failed download still reaches
// PageErrorBoundary in that moment, and it is not a real failure.
export const isReloadingForRelease = (): boolean => reloading;

// One reload a minute at most, so a page that really is broken cannot reload
// forever.
export const shouldReload = (lastReloadAt: number | null, now: number): boolean =>
  lastReloadAt === null || now - lastReloadAt >= MIN_GAP_MS;

// A release replaces the page files, so someone with the site already open can
// ask for one that no longer exists. Reloading gets them the new release. If it
// doesn't help, the error carries on to PageErrorBoundary.
// Playbook: docs/support/site/page-loading.md.
export const reloadForNewRelease = (event: Event) => {
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(STORAGE_KEY)) || null;
    const now = Date.now();

    if (!shouldReload(lastReloadAt, now)) return;

    window.sessionStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    return;
  }

  reloading = true;
  event.preventDefault();
  window.location.reload();
};
