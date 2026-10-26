import type { ReactElement } from "react";

type KeptPlaceholderProps = {
  // One <input> or <textarea> with a placeholder.
  children: ReactElement<{ placeholder?: string; value?: unknown }>;
};

// Keeps a field's example in view once someone starts typing: the
// placeholder shows inside the field while it is empty, and the same text
// sits underneath it, small and grey, once it is not, so it can still be
// read and copied. A field with no value prop falls back to CSS
// (.keptPlaceholder in ui.css), which needs the text straight after it.
//
// The text is hidden from screen readers: where a label wraps the field it
// would otherwise become part of the field's name.
const KeptPlaceholder = ({ children }: KeptPlaceholderProps) => {
  const { placeholder, value } = children.props;
  const filled = value === undefined || String(value ?? "").length > 0;

  return (
    <>
      {children}
      {placeholder && filled && (
        <span aria-hidden="true" className="keptPlaceholder">
          {placeholder}
        </span>
      )}
    </>
  );
};

export default KeptPlaceholder;
