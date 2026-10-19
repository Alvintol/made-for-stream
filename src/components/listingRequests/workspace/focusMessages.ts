// Asks the commission workspace to show the Messages tab and bring one
// element into view, from anywhere on the page (the project sections sit
// outside the workspace's own state). WorkspaceProvider listens for it.
export const FOCUS_MESSAGES_EVENT = "workspace:focus-messages";

export const focusWorkspaceMessages = (targetId: string): void => {
  window.dispatchEvent(new CustomEvent<string>(FOCUS_MESSAGES_EVENT, { detail: targetId }));
};

// The box above the chat where the buyer confirms work sent off site.
export const OFF_SITE_RECEIPTS_TARGET = "off-site-receipts";
