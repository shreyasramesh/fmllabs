"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getOneLiner, getTryThis } from "@/lib/mental-models-utils";
import { GenerateRelevantMessageButton } from "@/components/SharedIcons";
import { playSelectionChime } from "@/lib/selection-chime";
import { TTSButton } from "@/components/TTSButton";
import { useTtsHighlight } from "@/components/TtsHighlightContext";
import { TtsHighlightedText } from "@/components/TtsHighlightedText";

export interface MentalModel {
  id: string;
  name: string;
  quick_introduction: string;
  in_more_detail: string;
  why_this_is_important: string;
  when_to_use: string[];
  how_can_you_spot_it: Record<string, string>;
  examples: Record<string, string>;
  real_world_implications: string | Record<string, string>;
  professional_application: Record<string, string>;
  how_can_this_be_misapplied: Record<string, string>;
  related_content: string[];
  one_liner?: string;
  try_this?: string[];
  ask_yourself?: string[];
}

const TRUNCATE_LENGTH = 180;

function formatLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ExpandableText({
  text,
  defaultExpanded = false,
}: {
  text: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const shouldTruncate = text.length > TRUNCATE_LENGTH;

  return (
    <div>
      <div
        className={`relative text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed ${
          !expanded && shouldTruncate ? "max-h-[4.5rem] overflow-hidden" : ""
        }`}
      >
        <p className={!expanded && shouldTruncate ? "line-clamp-3" : ""}>
          {text}
        </p>
        {!expanded && shouldTruncate && (
          <div
            className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent pointer-events-none"
            aria-hidden
          />
        )}
      </div>
      {shouldTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-neutral-600 dark:text-neutral-400 text-xs font-medium uppercase underline underline-offset-2 hover:no-underline"
        >
          {expanded ? "COLLAPSE" : "EXPAND"}
        </button>
      )}
    </div>
  );
}

function AccordionItem({
  label,
  content,
  defaultExpanded = false,
  dir,
  textId,
}: {
  label: string;
  content: string;
  defaultExpanded?: boolean;
  dir?: "rtl" | "ltr";
  textId?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const tts = useTtsHighlight();

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-3 pl-5 pr-3 text-left text-sm transition-colors duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 rounded-lg gap-2"
      >
        <span className="font-medium text-foreground pr-4 flex-1 min-w-0">
          {formatLabel(label)}
        </span>
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <TTSButton
            text={content}
            showOnHover={false}
            ariaLabel={`Listen to ${label}`}
            onTtsProgress={textId && tts ? (charEnd) => tts.setTtsHighlight({ textId, charEnd }) : undefined}
            onTtsEnd={textId && tts ? () => tts.setTtsHighlight(null) : undefined}
          />
        </div>
        <span
          className={`shrink-0 text-lg transition-transform duration-200 ${
            expanded ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      {expanded && (
        <p className="pb-3 pl-5 pr-3 text-neutral-800 dark:text-neutral-200 text-sm leading-relaxed break-words" dir={dir}>
          {textId && tts?.ttsHighlight && "textId" in tts.ttsHighlight && tts.ttsHighlight.textId === textId ? (
            <TtsHighlightedText text={content} charEnd={tts.ttsHighlight.charEnd} />
          ) : (
            content
          )}
        </p>
      )}
    </div>
  );
}

export function MentalModelModal({
  model,
  onClose,
  sessionId,
  relevanceContext,
  onTagAdded,
  onOpenRelated,
  onSavedToLibrary,
  isSavedInConcepts = false,
  canSaveToConcepts = true,
  messages = [],
  onSendMessage,
  isRtl = false,
}: {
  model: MentalModel | null;
  onClose: () => void;
  sessionId?: string | null;
  relevanceContext?: string | null;
  onTagAdded?: (updatedSession?: { _id: string; mentalModelTags?: string[] }) => void;
  onOpenRelated?: (id: string) => void;
  onSavedToLibrary?: () => void;
  isSavedInConcepts?: boolean;
  canSaveToConcepts?: boolean;
  messages?: { role: string; content: string }[];
  onSendMessage?: (text: string) => void;
  isRtl?: boolean;
}) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);
  const tts = useTtsHighlight();

  const [feedbackGiven, setFeedbackGiven] = useState<"helpful" | "not-helpful" | "removed" | null>(null);
  const [reflection, setReflection] = useState("");
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const [step, setStep] = useState(0);
  const [savedCelebration, setSavedCelebration] = useState(false);
  const [generateModal, setGenerateModal] = useState<{
    suggestion: string;
    generatedText: string;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    setFeedbackGiven(null);
    setReflection("");
    setReflectionSaved(false);
    setStep(0);
    setSavedCelebration(false);
    setGenerateModal(null);
  }, [model?.id]);

  // Add tag to conversation when modal opens (regardless of feedback)
  useEffect(() => {
    if (!model || !sessionId) return;
    fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentalModelTag: model.id }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((updatedSession) => {
        if (updatedSession) onTagAdded?.(updatedSession);
      })
      .catch(() => {});
  }, [model?.id, sessionId, onTagAdded]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  if (!model) return null;

  const implications =
    typeof model.real_world_implications === "string"
      ? model.real_world_implications
      : Object.entries(model.real_world_implications ?? {})
          .map(([k, v]) => `${formatLabel(k)}: ${v}`)
          .join("\n\n");

  const whyPoints = model.why_this_is_important
    .split(/(?<=[.!])\s+/)
    .filter((s) => s.trim().length > 0);

  const askYourselfItems = model.ask_yourself
    ? (Array.isArray(model.ask_yourself)
        ? model.ask_yourself.map((q) =>
            typeof q === "string"
              ? q
              : typeof q === "object" && q !== null
                ? Object.values(q as Record<string, unknown>)[0]
                : String(q)
          )
        : []
      ).filter((s): s is string => typeof s === "string")
    : [];

  const tryThisItems = getTryThis(model);
  const steps = [
    "image",
    "idea",
    "concept",
    ...(tryThisItems.length > 0 ? (["try"] as const) : []),
    "when",
    ...(askYourselfItems.length > 0 ? (["ask"] as const) : []),
    ...(canSaveToConcepts ? (["own"] as const) : []),
    "dive",
  ];
  const totalSteps = steps.length;
  const currentStepKey = steps[Math.min(step, totalSteps - 1)];

  const goNext = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSaveToLibrary = async () => {
    try {
      const res = await fetch("/api/me/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: model.id }),
      });
      if (res.ok) {
        onSavedToLibrary?.();
        setFeedbackGiven("helpful");
        setSavedCelebration(true);
        setTimeout(() => setSavedCelebration(false), 1500);
      }
    } catch {
      setFeedbackGiven(null);
    }
  };

  const handleNotHelpful = () => {
    setFeedbackGiven("not-helpful");
  };

  const handleRemoveFromLibrary = async () => {
    try {
      const res = await fetch(`/api/me/concepts/${model.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onSavedToLibrary?.();
        setFeedbackGiven("removed");
      }
    } catch {
      setFeedbackGiven(null);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="relative rounded-3xl shadow-xl w-full max-w-lg sm:max-w-[min(90vw,900px)] max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col bg-background border border-neutral-200 dark:border-neutral-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2
              id="modal-title"
              className="font-semibold text-lg truncate pr-2"
            >
                {model.name}
              </h2>
              <div className="mt-2 flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      playSelectionChime();
                      setStep(i);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      i === step
                        ? "w-6 bg-neutral-600 dark:bg-neutral-400"
                        : i < step
                          ? "w-1.5 bg-neutral-400/60 dark:bg-neutral-500/60"
                          : "w-1.5 bg-neutral-300 dark:bg-neutral-600"
                    }`}
                    aria-label={`Step ${i + 1} of ${totalSteps}`}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
        </div>

        <div className="relative flex-1 min-h-[min(400px,55vh)] overflow-y-auto p-4">
          {currentStepKey === "image" && (
            <div className="animate-fade-in-up flex flex-col items-center justify-center min-h-[min(350px,50vh)]">
              <div className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 w-full max-w-md aspect-[4/3] bg-neutral-100 dark:bg-neutral-800">
                <img
                  src={`/images/${model.id.replace(/_/g, "-")}.png`}
                  alt={model.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={goNext}
                className="mt-6 px-5 py-2.5 rounded-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-[0.98]"
              >
                Next →
              </button>
            </div>
          )}

          {currentStepKey === "idea" && (
            <div className="animate-fade-in-up space-y-6">
              <div className="group/tts rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    The big idea
                  </p>
                  <TTSButton
                    text={getOneLiner(model)}
                    showOnHover={false}
                    ariaLabel="Listen"
                    onTtsProgress={tts ? (charEnd) => tts.setTtsHighlight({ textId: `mm-${model.id}-one-liner`, charEnd }) : undefined}
                    onTtsEnd={tts ? () => tts.setTtsHighlight(null) : undefined}
                  />
                </div>
                <blockquote className="border-l-4 border-neutral-400 dark:border-neutral-500 pl-5 py-3 text-lg font-medium text-foreground italic leading-relaxed mt-2" dir={isRtl ? "rtl" : undefined}>
                  &ldquo;{tts?.ttsHighlight && "textId" in tts.ttsHighlight && tts.ttsHighlight.textId === `mm-${model.id}-one-liner` ? (
                    <TtsHighlightedText text={getOneLiner(model)} charEnd={tts.ttsHighlight.charEnd} />
                  ) : (
                    getOneLiner(model)
                  )}&rdquo;
                </blockquote>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={goBack}
                  className="px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                  aria-label="Back"
                >
                  ← Back
                </button>
                <button
                  onClick={goNext}
                  className="px-5 py-2.5 rounded-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-[0.98]"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {currentStepKey === "concept" && (
            <div className="animate-fade-in-up space-y-6">
              <div className="group/tts rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    Meet the concept
                  </p>
                  <TTSButton
                    text={model.quick_introduction}
                    showOnHover={false}
                    ariaLabel="Listen"
                    onTtsProgress={tts ? (charEnd) => tts.setTtsHighlight({ textId: `mm-${model.id}-quick-intro`, charEnd }) : undefined}
                    onTtsEnd={tts ? () => tts.setTtsHighlight(null) : undefined}
                  />
                </div>
                <p className="text-neutral-700 dark:text-neutral-300 text-base leading-relaxed mt-2" dir={isRtl ? "rtl" : undefined}>
                  {tts?.ttsHighlight && "textId" in tts.ttsHighlight && tts.ttsHighlight.textId === `mm-${model.id}-quick-intro` ? (
                    <TtsHighlightedText text={model.quick_introduction} charEnd={tts.ttsHighlight.charEnd} />
                  ) : (
                    model.quick_introduction
                  )}
                </p>
              </div>
              {relevanceContext && (
                <div className="group/tts rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      Why this matters for your decision
                    </p>
                    <TTSButton
                      text={relevanceContext}
                      showOnHover={false}
                      ariaLabel="Listen"
                      onTtsProgress={tts ? (charEnd) => tts.setTtsHighlight({ textId: `mm-${model.id}-relevance`, charEnd }) : undefined}
                      onTtsEnd={tts ? () => tts.setTtsHighlight(null) : undefined}
                    />
                  </div>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 italic">
                    &ldquo;{tts?.ttsHighlight && "textId" in tts.ttsHighlight && tts.ttsHighlight.textId === `mm-${model.id}-relevance` ? (
                      <TtsHighlightedText text={relevanceContext} charEnd={tts.ttsHighlight.charEnd} />
                    ) : (
                      relevanceContext
                    )}&rdquo;
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={goBack}
                  className="px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                  aria-label="Back"
                >
                  ← Back
                </button>
                <button
                  onClick={goNext}
                  className="px-5 py-2 rounded-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-[0.98]"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {currentStepKey === "try" && (
            <div className="animate-fade-in-up space-y-6">
              <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Try it
                </p>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-2">
                  A few prompts to put this into practice:
                </p>
              </div>
              <ul className="space-y-3">
                {tryThisItems.map((prompt, i) => (
                  <li
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 rounded-2xl bg-white dark:bg-neutral-900 px-4 py-3 border border-neutral-200 dark:border-neutral-700"
                  >
                    <div className="flex items-start gap-3 min-w-0 sm:min-w-0 sm:flex-1">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 pt-0.5 min-w-0" dir={isRtl ? "rtl" : undefined}>
                        {tts?.ttsHighlight && "textId" in tts.ttsHighlight && tts.ttsHighlight.textId === `mm-${model.id}-try-${i}` ? (
                          <TtsHighlightedText text={prompt} charEnd={tts.ttsHighlight.charEnd} />
                        ) : (
                          prompt
                        )}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <TTSButton
                          text={prompt}
                          showOnHover={false}
                          ariaLabel="Listen"
                          className="shrink-0"
                          onTtsProgress={tts ? (charEnd) => tts.setTtsHighlight({ textId: `mm-${model.id}-try-${i}`, charEnd }) : undefined}
                          onTtsEnd={tts ? () => tts.setTtsHighlight(null) : undefined}
                        />
                        {onSendMessage && (
                          <GenerateRelevantMessageButton
                            label="Generate Relevant Message"
                            expandOnHover={false}
                            aria-label="Generate Relevant Message"
                            className="shrink-0"
                            onClick={async () => {
                              setGenerateModal({
                                suggestion: prompt,
                                generatedText: "",
                                loading: true,
                              });
                              try {
                                const res = await fetch("/api/generate-relevant-prompt", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    suggestion: prompt,
                                    messages: messages.map((m) => ({
                                      role: m.role,
                                      content: m.content,
                                    })),
                                  }),
                                });
                                const data = await res.json();
                                setGenerateModal((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        generatedText: data.text ?? prompt,
                                        loading: false,
                                      }
                                    : null
                                );
                              } catch {
                                setGenerateModal((prev) =>
                                  prev
                                    ? { ...prev, generatedText: prompt, loading: false }
                                    : null
                                );
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={goBack}
                  className="px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                  aria-label="Back"
                >
                  ← Back
                </button>
                <button
                  onClick={goNext}
                  className="px-5 py-2 rounded-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-[0.98]"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {currentStepKey === "when" && (
            <div className="animate-fade-in-up space-y-6">
              <div className="group/tts rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    When to use it
                  </p>
                  <TTSButton
                    text={model.when_to_use.map((t) => formatLabel(t)).join(". ")}
                    showOnHover={false}
                    ariaLabel="Listen"
                    onTtsProgress={tts ? (charEnd) => tts.setTtsHighlight({ textId: `mm-${model.id}-when-to-use`, charEnd }) : undefined}
                    onTtsEnd={tts ? () => tts.setTtsHighlight(null) : undefined}
                  />
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-2">
                  This lens is especially useful when:
                </p>
                {tts?.ttsHighlight && "textId" in tts.ttsHighlight && tts.ttsHighlight.textId === `mm-${model.id}-when-to-use` ? (
                  <p className="text-neutral-800 dark:text-neutral-200 text-sm mt-3" dir={isRtl ? "rtl" : undefined}>
                    <TtsHighlightedText text={model.when_to_use.map((t) => formatLabel(t)).join(". ")} charEnd={tts.ttsHighlight.charEnd} />
                  </p>
                ) : (
                <div className="flex flex-wrap gap-2 mt-3">
                {model.when_to_use.map((tag) => (
                  <span
                    key={tag}
                    className="px-4 py-2 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-sm font-medium"
                    dir={isRtl ? "rtl" : undefined}
                  >
                    {formatLabel(tag)}
                  </span>
                ))}
                </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={goBack}
                    className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={goNext}
                    className="px-5 py-2 rounded-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-[0.98]"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStepKey === "ask" && (
            <div className="animate-fade-in-up space-y-6">
              <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Ask yourself
                </p>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-2">
                  Questions to sharpen your thinking:
                </p>
              </div>
              <ul className="space-y-3">
                {askYourselfItems.map((q, i) => (
                  <li
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 rounded-2xl bg-white dark:bg-neutral-900 px-4 py-3 border border-neutral-200 dark:border-neutral-700"
                  >
                    <div className="flex items-start gap-3 min-w-0 sm:flex-1">
                      <span className="text-neutral-500 mt-0.5 shrink-0">?</span>
                      <span className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 pt-0.5 min-w-0" dir={isRtl ? "rtl" : undefined}>
                        {tts?.ttsHighlight && "textId" in tts.ttsHighlight && tts.ttsHighlight.textId === `mm-${model.id}-ask-${i}` ? (
                          <TtsHighlightedText text={q} charEnd={tts.ttsHighlight.charEnd} />
                        ) : (
                          q
                        )}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <TTSButton
                          text={q}
                          showOnHover={false}
                          ariaLabel="Listen"
                          className="shrink-0"
                          onTtsProgress={tts ? (charEnd) => tts.setTtsHighlight({ textId: `mm-${model.id}-ask-${i}`, charEnd }) : undefined}
                          onTtsEnd={tts ? () => tts.setTtsHighlight(null) : undefined}
                        />
                        {onSendMessage && (
                          <GenerateRelevantMessageButton
                            label="Generate Relevant Message"
                            expandOnHover={false}
                            aria-label="Generate Relevant Message"
                            className="shrink-0"
                            onClick={async () => {
                              setGenerateModal({
                                suggestion: q,
                                generatedText: "",
                                loading: true,
                              });
                              try {
                                const res = await fetch("/api/generate-relevant-prompt", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    suggestion: q,
                                    messages: messages.map((m) => ({
                                      role: m.role,
                                      content: m.content,
                                    })),
                                  }),
                                });
                                const data = await res.json();
                                setGenerateModal((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        generatedText: data.text ?? q,
                                        loading: false,
                                      }
                                    : null
                                );
                              } catch {
                                setGenerateModal((prev) =>
                                  prev
                                    ? { ...prev, generatedText: q, loading: false }
                                    : null
                                );
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={goBack}
                  className="px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                  aria-label="Back"
                >
                  ← Back
                </button>
                <button
                  onClick={goNext}
                  className="px-5 py-2 rounded-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-[0.98]"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {currentStepKey === "own" && (
            <div className="animate-fade-in-up space-y-6">
              <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Own it
                </p>

                {isSavedInConcepts ? (
                  feedbackGiven === "removed" ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Removed from Concept Gems.
                    </p>
                  ) : (
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-2 mb-4">
                      This is in your Concept Gems. Remove it?
                    </p>
                  )
                ) : (
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-2">
                    Add this to your Concept Gems to revisit anytime?
                  </p>
                )}

                {feedbackGiven === "helpful" ? (
                <div className="space-y-4">
                  <div
                    className={`flex items-center gap-2 rounded-2xl p-4 transition-all duration-300 ${
                      savedCelebration
                        ? "bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-400 dark:border-neutral-500 animate-pulse"
                        : "bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                    }`}
                  >
                    <span className={`text-2xl ${savedCelebration ? "animate-pulse" : ""}`}>{savedCelebration ? "✨" : "✓"}</span>
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {savedCelebration
                        ? "Nice! Added to your gems."
                        : "Added to your Concept Gems."}
                    </p>
                  </div>
                  {!reflectionSaved ? (
                    <div>
                      <label
                        htmlFor="reflection"
                        className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1"
                      >
                        Optional: How might this apply to your situation?
                      </label>
                      <div className="flex gap-2">
                        <textarea
                          id="reflection"
                          value={reflection}
                          onChange={(e) => setReflection(e.target.value)}
                          placeholder="Jot a quick note..."
                          rows={2}
                          className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!reflection.trim()) return;
                            try {
                              const res = await fetch(
                                `/api/me/concepts/${model.id}`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    reflection: reflection.trim(),
                                  }),
                                }
                              );
                              if (res.ok) setReflectionSaved(true);
                            } catch {
                              /* ignore */
                            }
                          }}
                          disabled={!reflection.trim()}
                          className="px-3 py-2 rounded-xl bg-foreground text-background text-sm font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shrink-0"
                        >
                          Save note
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500">Note saved.</p>
                  )}
                </div>
              ) : feedbackGiven === "not-helpful" ? (
                <p className="text-sm text-neutral-500">
                  No problem. You can add it later from Concept Gems in the sidebar.
                </p>
              ) : feedbackGiven === "removed" ? null : isSavedInConcepts ? (
                <button
                  onClick={handleRemoveFromLibrary}
                  className="w-full px-5 py-3 rounded-2xl border-2 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-medium text-sm transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98]"
                >
                  Remove from Concept Gems
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleSaveToLibrary}
                    className="w-full px-5 py-3 rounded-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-[0.98]"
                  >
                    Add to Concept Gems ✨
                  </button>
                  <button
                    onClick={handleNotHelpful}
                    className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                  >
                    Skip for now
                  </button>
                </div>
              )}

                <div className="flex justify-end gap-2 pt-6 mt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <button
                    onClick={goBack}
                    className="px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                    aria-label="Back"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={goNext}
                    className="px-5 py-2 rounded-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-[0.98]"
                  >
                    Dive deeper →
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-5 py-2 rounded-2xl border border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStepKey === "dive" && (
            <div className="animate-fade-in-up space-y-6">
              <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-4">
                  Dive deeper
                </p>
                <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 overflow-hidden min-w-0">
                  <AccordionItem
                    label="In more detail"
                    content={model.in_more_detail}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                    textId={model.id ? `mm-${model.id}-in-more-detail` : undefined}
                  />
                  <AccordionItem
                    label="Why is it important?"
                    content={model.why_this_is_important}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                    textId={model.id ? `mm-${model.id}-why-important` : undefined}
                  />
                  <AccordionItem
                    label="How can you spot it?"
                    content={Object.entries(model.how_can_you_spot_it ?? {})
                      .map(([k, v]) => `${formatLabel(k)}: ${v}`)
                      .join("\n\n")}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                    textId={model.id ? `mm-${model.id}-how-spot` : undefined}
                  />
                  <AccordionItem
                    label="Examples"
                    content={Object.entries(model.examples ?? {})
                      .map(([k, v]) => `${formatLabel(k)}: ${v}`)
                      .join("\n\n")}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                    textId={model.id ? `mm-${model.id}-examples` : undefined}
                  />
                  <AccordionItem
                    label="Real world implications"
                    content={implications}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                    textId={model.id ? `mm-${model.id}-implications` : undefined}
                  />
                  <AccordionItem
                    label="Professional application"
                    content={Object.entries(model.professional_application ?? {})
                      .map(([k, v]) => `${formatLabel(k)}: ${v}`)
                      .join("\n\n")}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                    textId={model.id ? `mm-${model.id}-professional` : undefined}
                  />
                  <AccordionItem
                    label="How this can be misapplied"
                    content={Object.entries(model.how_can_this_be_misapplied ?? {})
                      .map(([k, v]) => `${formatLabel(k)}: ${v}`)
                      .join("\n\n")}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                    textId={model.id ? `mm-${model.id}-misapplied` : undefined}
                  />
                </div>
                {model.related_content?.length > 0 && (
                  <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-700">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                      Related
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {model.related_content.map((id) =>
                        onOpenRelated ? (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onOpenRelated(id)}
                            className="px-2 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                          >
                            {formatLabel(id)}
                          </button>
                        ) : (
                          <span
                            key={id}
                            className="px-2 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs"
                          >
                            {formatLabel(id)}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-6 mt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <button
                    onClick={goBack}
                    className="px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                    aria-label="Back"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-5 py-2 rounded-2xl bg-foreground text-background font-medium text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {generateModal && (
        <div
          className="absolute inset-0 flex items-center justify-center p-4 bg-black/50 z-10"
          onClick={() => setGenerateModal(null)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-3xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="font-semibold text-lg">Edit your message</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Customize the generated message before sending.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {generateModal.loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-neutral-500 dark:text-neutral-400">
                  <span className="inline-block w-4 h-4 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                  Generating...
                </div>
              ) : (
                <textarea
                  value={generateModal.generatedText}
                  onChange={(e) =>
                    setGenerateModal((prev) =>
                      prev ? { ...prev, generatedText: e.target.value } : null
                    )
                  }
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  placeholder="Your message..."
                />
              )}
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setGenerateModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = generateModal.generatedText.trim();
                  if (text && onSendMessage) {
                    onSendMessage(text);
                    setGenerateModal(null);
                  }
                }}
                disabled={generateModal.loading || !generateModal.generatedText.trim()}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
