"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { MentionInput, type ConceptGroupOption, type CustomConceptOption, type LongTermMemoryOption, type MentalModelOption } from "@/components/MentionInput";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import type { LanguageCode } from "@/lib/languages";

type MentionTranslations = {
  mentalModels: string;
  longTermMemory: string;
  customConcepts: string;
  myGroups: string;
  hint: string;
  noResults: string;
  mentalModelSuffix: string;
  memorySuffix: string;
  conceptSuffix: string;
  groupSuffix: string;
};

type PreviewMap = Map<string, { oneLiner?: string; quickIntro?: string }>;

interface ChatComposerProps {
  value: string;
  syncRevision: number;
  inputRef: React.RefObject<HTMLDivElement | null>;
  disabled: boolean;
  isLoading: boolean;
  canSubmit: boolean;
  language: LanguageCode;
  placeholder: string;
  placeholderMobile?: string;
  mentalModels: MentalModelOption[];
  longTermMemories: LongTermMemoryOption[];
  customConcepts: CustomConceptOption[];
  conceptGroups: ConceptGroupOption[];
  mentionTranslations: MentionTranslations;
  previewMap: PreviewMap;
  onDraftChange: (value: string) => void;
  onSend: (value: string) => void;
  onMentalModelClick?: (id: string) => void;
  onLtmClick?: (id: string) => void;
  onCustomConceptClick?: (id: string) => void;
  onConceptGroupClick?: (id: string) => void;
  /** When false, hides speech-to-text (e.g. new chat or 1:1 mentor thread). Default true. */
  showVoiceButton?: boolean;
}

export const ChatComposer = memo(function ChatComposer({
  value,
  syncRevision,
  inputRef,
  disabled,
  isLoading,
  canSubmit,
  language,
  placeholder,
  placeholderMobile,
  mentalModels,
  longTermMemories,
  customConcepts,
  conceptGroups,
  mentionTranslations,
  previewMap,
  onDraftChange,
  onSend,
  onMentalModelClick,
  onLtmClick,
  onCustomConceptClick,
  onConceptGroupClick,
  showVoiceButton = true,
}: ChatComposerProps) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);

  useEffect(() => {
    draftRef.current = value;
    setDraft(value);
  }, [syncRevision, value]);

  const updateDraft = useCallback((nextValue: string) => {
    draftRef.current = nextValue;
    setDraft(nextValue);
    onDraftChange(nextValue);
  }, [onDraftChange]);

  const handleSend = useCallback(() => {
    if (disabled || isLoading || !canSubmit) return;
    const trimmed = draftRef.current.trim();
    if (!trimmed) return;
    onSend(draftRef.current);
  }, [canSubmit, disabled, isLoading, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      (e.key === "Enter" && !e.shiftKey) ||
      (e.metaKey && e.key === "Enter") ||
      (e.ctrlKey && e.key === "Enter")
    ) {
      e.preventDefault();
      if (!canSubmit) return;
      handleSend();
    }
  }, [canSubmit, handleSend]);

  const handleVoiceInput = useCallback((text: string) => {
    const nextValue = draftRef.current ? `${draftRef.current} ${text}` : text;
    updateDraft(nextValue);
  }, [updateDraft]);

  const sendDisabled = disabled || isLoading || !draft.trim();

  return (
    <div
      className="flex min-h-[52px] w-full min-w-0 max-w-2xl items-stretch overflow-visible rounded-2xl border-[1px] border-neutral-400/80 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900 sm:min-h-[60px] lg:max-w-4xl py-1.5 sm:py-2 pr-1 sm:pr-1.5"
      data-tour="input-area"
    >
      <div className="flex-1 min-w-0 flex items-stretch px-3">
        <MentionInput
          inputRef={inputRef}
          value={draft}
          onChange={updateDraft}
          onKeyDown={handleKeyDown}
          mentalModels={mentalModels}
          longTermMemories={longTermMemories}
          customConcepts={customConcepts}
          conceptGroups={conceptGroups}
          mentionTranslations={mentionTranslations}
          placeholder={placeholder}
          placeholderMobile={placeholderMobile}
          disabled={disabled}
          placeholderTopAligned
          className="w-full pl-0 pr-0 border-0 rounded-none bg-transparent shadow-none resize-none focus:outline-none focus:ring-0 focus:border-0 text-sm sm:text-base transition-all duration-200 placeholder:text-neutral-500 dark:placeholder:text-neutral-500 text-foreground min-h-[1.75rem] max-h-36 py-1 sm:py-1.5 leading-5 sm:leading-6 whitespace-pre-wrap break-words overflow-x-hidden overflow-y-auto"
          onMentalModelClick={onMentalModelClick}
          onLtmClick={onLtmClick}
          onCustomConceptClick={onCustomConceptClick}
          onConceptGroupClick={onConceptGroupClick}
          previewMap={previewMap}
        />
      </div>
      <div
        className={`relative shrink-0 pl-2 pr-3 sm:pr-4 flex flex-col ${
          showVoiceButton ? "w-[108px] sm:w-[120px]" : "w-[60px] sm:w-16"
        }`}
      >
        <div className={`flex items-center gap-1 ${showVoiceButton ? "" : "justify-stretch"}`}>
          {showVoiceButton ? (
            <div className="flex-1">
              <VoiceInputButton
                onTranscription={handleVoiceInput}
                language={language}
                disabled={disabled}
                ariaLabel="Voice input"
                compactStopWhileListening
                className="!w-full !min-h-10 !min-w-0 !rounded-xl !border-[1px] !border-neutral-400/80 dark:!border-neutral-700 !bg-neutral-50/80 dark:!bg-neutral-900/45 hover:!border-accent/80 dark:hover:!border-accent/70 hover:!bg-accent/10 dark:hover:!bg-accent/20"
              />
            </div>
          ) : null}
          <button
            onClick={handleSend}
            disabled={sendDisabled}
            aria-label="Send message"
            className={`flex items-center justify-center gap-1.5 h-10 min-w-[2.75rem] rounded-xl bg-accent text-white transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${
              showVoiceButton ? "flex-1" : "w-full"
            }`}
          >
            {isLoading ? (
              <span aria-label="Sending" className="text-sm leading-none">
                ...
              </span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
