"use client";
import * as React from "react";

/** A ref that always holds the latest committed `value`, for handlers that outlive a render. */
export function useLatest<T>(value: T): React.RefObject<T> {
  const ref = React.useRef(value);
  React.useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
