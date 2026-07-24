import { useState } from "react";

/* Standard controlled/uncontrolled hybrid: a component works standalone
   (internal state) or as one half of a synced pair when a parent passes
   `value`/`onChange` — used to link ResearchNetworkGraph and ResearchAreas
   without duplicating hover-tracking logic in both. */
export function useControllableState<T>(
  value: T | undefined,
  onChange: ((value: T) => void) | undefined,
  defaultValue: T
): [T, (value: T) => void] {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const set = (next: T) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return [current, set];
}
