import {
  OFF_SITE_OTHER_MAX_LENGTH,
  offSiteDeliveryMethodLabels,
  offSiteDeliveryMethods,
  type OffSiteDeliveryFormState,
  type OffSiteDeliveryMethod,
} from "../../domain/listings/offSiteDelivery";

type OffSiteDeliveryFieldsProps = {
  // Keeps the ids apart when two forms are on one page.
  idPrefix: string;
  value: OffSiteDeliveryFormState;
  error?: string;
  disabled?: boolean;
  onChange: (value: OffSiteDeliveryFormState) => void;
};

const classes = {
  wrap: "space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4",
  row: "flex items-start gap-3",
  checkbox: "mt-1 h-4 w-4 rounded border-zinc-300",
  label: "text-sm font-semibold text-zinc-800",
  warning: "notice noticeWarning",
  methods: "space-y-2",
  legend: "formLabel",
  methodLabel: "text-sm text-zinc-800",
  input: "formControl",
  help: "formHint",
  errorText: "formError",
} as const;

// "Provided off site" on the milestone and final delivery forms. Ticking it
// opens the list of ways the work was sent; the answer is saved with the
// submission and written into the commission's chat.
const OffSiteDeliveryFields = ({
  idPrefix,
  value,
  error,
  disabled = false,
  onChange,
}: OffSiteDeliveryFieldsProps) => {
  const toggleMethod = (method: OffSiteDeliveryMethod, checked: boolean) =>
    onChange({
      ...value,
      methods: checked
        ? [...value.methods, method]
        : value.methods.filter((current) => current !== method),
    });

  return (
    <div className={classes.wrap}>
      <label className={classes.row}>
        <input
          checked={value.provided}
          className={classes.checkbox}
          disabled={disabled}
          type="checkbox"
          onChange={(event) =>
            onChange({ ...value, provided: event.currentTarget.checked })
          }
        />

        <span className={classes.label}>Provided off site</span>
      </label>

      <p className={classes.warning}>
        Images or work you send outside Made for Stream, for example by email, Discord
        or text message, are not protected by Made for Stream. They carry no watermark,
        we hold no copy of them, and we cannot confirm that they arrived. If you did send
        this work another way, tick the box and say how, so the commission&rsquo;s chat
        keeps a record of where it went. Confirming that the buyer received it is up to
        you.
      </p>

      {value.provided && (
        <fieldset className={classes.methods} disabled={disabled}>
          <legend className={classes.legend}>How did you send it?</legend>

          {offSiteDeliveryMethods.map((method) => (
            <label className={classes.row} key={method}>
              <input
                checked={value.methods.includes(method)}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  toggleMethod(method, event.currentTarget.checked)
                }
              />

              <span className={classes.methodLabel}>
                {offSiteDeliveryMethodLabels[method]}
              </span>
            </label>
          ))}

          {value.methods.includes("other") && (
            <div>
              <label className={classes.legend} htmlFor={`${idPrefix}-off-site-other`}>
                Which way?
              </label>

              <input
                className={classes.input}
                id={`${idPrefix}-off-site-other`}
                maxLength={OFF_SITE_OTHER_MAX_LENGTH}
                value={value.other}
                onChange={(event) =>
                  onChange({ ...value, other: event.currentTarget.value })
                }
              />

              <p className={classes.help}>
                Name the service or method only. The buyer sees this in the chat.
              </p>
            </div>
          )}

          <p className={classes.help}>
            The chat will say the work was also sent this way. It is your statement, not
            proof of delivery.
          </p>
        </fieldset>
      )}

      {error && (
        <p className={classes.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default OffSiteDeliveryFields;
