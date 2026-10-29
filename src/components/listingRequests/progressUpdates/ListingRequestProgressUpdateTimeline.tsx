import { hasErrorMessage } from "../../../lib/errorMessage";
import type {
  ListingRequestProgressUpdateKind,
} from "../../../hooks/creatorRequests/useCreateListingRequestProgressUpdate";
import type {
  ListingRequestProgressUpdateRow,
} from "../../../hooks/creatorRequests/useListingRequestProgressUpdates";
import { useLanguage, useT, type Translate } from "../../../lib/i18n/i18n";
type ListingRequestProgressUpdateTimelineProps = {
  updates: ListingRequestProgressUpdateRow[];
  isLoading?: boolean;
  error?: unknown;
};

const classes = {
  section: "space-y-4",
  list: "space-y-4",
  item:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-4",
  itemHeader:
    "flex flex-wrap items-start justify-between gap-3",
  itemHeading: "space-y-1",
  itemTitle: "text-sm font-extrabold text-zinc-900",
  itemDate: "text-xs text-zinc-500",
  body: "mt-3 whitespace-pre-wrap text-sm text-zinc-700",
  badges: "flex flex-wrap items-center gap-2",
  badge:
    "inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",
  progressBadge:
    "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800",
  empty:
    "notice noticeNeutral",
  loading:
    "notice noticeNeutral",
  error:
    "notice noticeError",
} as const;

const updateKindKeys = {
  progress: "updateKind.progress",
  milestone: "updateKind.milestone",
  delay: "updateKind.delay",
  final_preview: "updateKind.final_preview",
} as const satisfies Record<ListingRequestProgressUpdateKind, string>;

const formatDate = (value: string, language: string): string =>
  new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getErrorMessage = (error: unknown, t: Translate): string =>
  hasErrorMessage(error)
    ? error.message
    : t("updates.loadFailed");

const sortUpdatesNewestFirst = (
  updates: ListingRequestProgressUpdateRow[]
): ListingRequestProgressUpdateRow[] =>
  [...updates].sort((firstUpdate, secondUpdate) =>
    secondUpdate.created_at.localeCompare(
      firstUpdate.created_at
    )
  );

const ListingRequestProgressUpdateTimeline = ({
  updates,
  isLoading = false,
  error,
}: ListingRequestProgressUpdateTimelineProps) => {
  const t = useT();
  const language = useLanguage();
  const sortedUpdates = sortUpdatesNewestFirst(updates);

  return (
    <div>
      <div className={classes.section}>

        {isLoading && (
          <div className={classes.loading}>
            {t("updates.loading")}
          </div>
        )}
        
        {!isLoading && Boolean(error) && (
          <div className={classes.error}>
            {getErrorMessage(error, t)}
          </div>
        )}

        {!isLoading &&
          !error &&
          sortedUpdates.length === 0 && (
            <div className={classes.empty}>
              {t("updates.empty")}
            </div>
          )}

        {!isLoading &&
          !error &&
          sortedUpdates.length > 0 && (
            <div className={classes.list}>
              {sortedUpdates.map((update) => (
                <article
                  className={classes.item}
                  key={update.id}
                >
                  <div className={classes.itemHeader}>
                    <div className={classes.itemHeading}>
                      <h3 className={classes.itemTitle}>
                        {update.title}
                      </h3>

                      <div className={classes.itemDate}>
                        {formatDate(update.created_at, language)}
                      </div>
                    </div>

                    <div className={classes.badges}>
                      <span className={classes.badge}>
                        {t(updateKindKeys[update.update_kind])}
                      </span>

                      {update.progress_percent !== null && (
                        <span className={classes.progressBadge}>
                          {t("updates.percent", { percent: update.progress_percent })}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className={classes.body}>
                    {update.body}
                  </p>
                </article>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};

export default ListingRequestProgressUpdateTimeline;