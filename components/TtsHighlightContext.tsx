"use client";

import { createContext, useContext } from "react";

export type TtsHighlightState =
  | { messageIndex: number; charEnd: number }
  | { textId: string; charEnd: number }
  | null;

export type TtsHighlightContextValue = {
  ttsHighlight: TtsHighlightState;
  setTtsHighlight: (v: TtsHighlightState) => void;
};

export const TtsHighlightContext = createContext<TtsHighlightContextValue | null>(null);

export function useTtsHighlight() {
  const ctx = useContext(TtsHighlightContext);
  if (!ctx) return null;
  return ctx;
}
