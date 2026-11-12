import {
  applicationOfferingLabel,
  normaliseOfferings,
} from "../../domain/creatorApplication/creatorApplication";
import { useT } from "../../lib/i18n/i18n";

// What someone offers, as tags (20261112_197). "Something else" shows the
// description they wrote instead of the words "Something else".

const defaultClasses = {
  list: "flex flex-wrap gap-1.5",
  tag: "rounded-full bg-[rgb(var(--ink)/0.06)] px-2.5 py-0.5 text-xs font-medium text-zinc-700",
} as const;

type OfferingTagsProps = {
  offerings: readonly unknown[] | null | undefined;
  other?: string | null;
  label: string;
  className?: string;
  tagClassName?: string;
};

const OfferingTags = ({ offerings, other, label, className, tagClassName }: OfferingTagsProps) => {
  const t = useT();
  const chosen = normaliseOfferings(offerings);

  if (chosen.length === 0) return null;

  return (
    <ul className={className ?? defaultClasses.list} aria-label={label}>
      {chosen.map((offering) => (
        <li key={offering} className={tagClassName ?? defaultClasses.tag}>
          {offering === "other" && other?.trim() ? other.trim() : t(applicationOfferingLabel(offering))}
        </li>
      ))}
    </ul>
  );
};

export default OfferingTags;
