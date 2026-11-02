import { useEffect, useState } from "react";

// `value`, once it has stopped changing for `delayMs`. Search boxes use this so
// the database is asked once when typing pauses, not once per letter.
export const useDebouncedValue = <Value,>(value: Value, delayMs = 300): Value => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);

    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
};
