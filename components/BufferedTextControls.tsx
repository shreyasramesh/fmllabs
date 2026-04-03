"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type BufferedBaseProps = {
  value: string;
  syncRevision: number;
  onValueChange: (value: string) => void;
  onImmediateValueChange?: (value: string) => void;
  debounceMs?: number;
};

type BufferedInputProps = BufferedBaseProps &
  Omit<React.ComponentPropsWithoutRef<"input">, "value" | "defaultValue" | "onChange">;

type BufferedTextareaProps = BufferedBaseProps &
  Omit<React.ComponentPropsWithoutRef<"textarea">, "value" | "defaultValue" | "onChange">;

function useBufferedValue(
  value: string,
  syncRevision: number,
  onValueChange: (value: string) => void,
  onImmediateValueChange?: (value: string) => void,
  debounceMs = 120
) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(
    (nextValue?: string) => {
      const resolvedValue = nextValue ?? draftRef.current;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      onValueChange(resolvedValue);
    },
    [onValueChange]
  );

  useEffect(() => {
    draftRef.current = value;
    setDraft(value);
  }, [syncRevision, value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const updateDraft = useCallback(
    (nextValue: string) => {
      draftRef.current = nextValue;
      setDraft(nextValue);
      onImmediateValueChange?.(nextValue);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        onValueChange(nextValue);
      }, debounceMs);
    },
    [debounceMs, onImmediateValueChange, onValueChange]
  );

  return { draft, flush, updateDraft };
}

export function BufferedInput({
  value,
  syncRevision,
  onValueChange,
  onImmediateValueChange,
  debounceMs,
  onBlur,
  ...props
}: BufferedInputProps) {
  const { draft, flush, updateDraft } = useBufferedValue(
    value,
    syncRevision,
    onValueChange,
    onImmediateValueChange,
    debounceMs
  );

  return (
    <input
      {...props}
      value={draft}
      onChange={(e) => updateDraft(e.target.value)}
      onBlur={(e) => {
        flush(e.target.value);
        onBlur?.(e);
      }}
    />
  );
}

export function BufferedTextarea({
  value,
  syncRevision,
  onValueChange,
  onImmediateValueChange,
  debounceMs,
  onBlur,
  ...props
}: BufferedTextareaProps) {
  const { draft, flush, updateDraft } = useBufferedValue(
    value,
    syncRevision,
    onValueChange,
    onImmediateValueChange,
    debounceMs
  );

  return (
    <textarea
      {...props}
      value={draft}
      onChange={(e) => updateDraft(e.target.value)}
      onBlur={(e) => {
        flush(e.target.value);
        onBlur?.(e);
      }}
    />
  );
}
