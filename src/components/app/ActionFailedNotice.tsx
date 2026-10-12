type ActionFailedNoticeProps = {
  onDismiss: () => void;
};

const classes = {
  wrap: "fixed inset-x-0 bottom-4 z-50 flex justify-center px-4",
  card: "card flex max-w-xl flex-wrap items-center gap-3 p-4 shadow-lg",
  text: "min-w-0 flex-1 basis-64 text-sm text-zinc-700",
  actions: "flex items-center gap-2",
  btnPrimary: "btnPrimary btnSm",
  btnOutline: "btnOutline btnSm",
} as const;

// Shown after something a person tried did not go through. Often that means
// the page is out of date: the other person on a commission acted first. The
// page is not reloaded for them, because that would throw away anything they
// were typing; they choose when.
const ActionFailedNotice = ({ onDismiss }: ActionFailedNoticeProps) => (
  <div className={classes.wrap}>
    <div className={classes.card} role="status">
      <p className={classes.text}>
        That did not go through. If something here has changed since you opened the page,
        reload it to see the latest. Anything you have typed and not saved will be lost.
      </p>

      <div className={classes.actions}>
        <button
          className={classes.btnPrimary}
          type="button"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>

        <button className={classes.btnOutline} type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  </div>
);

export default ActionFailedNotice;
