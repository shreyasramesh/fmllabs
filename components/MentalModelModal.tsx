"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getOneLiner, getTryThis } from "@/lib/mental-models-utils";
import { GenerateRelevantMessageButton } from "@/components/SharedIcons";

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
}: {
  label: string;
  content: string;
  defaultExpanded?: boolean;
  dir?: "rtl" | "ltr";
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-3 pl-5 pr-3 text-left text-sm transition-colors duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 rounded-lg gap-2"
      >
        <span className="font-medium text-foreground pr-4 flex-1 min-w-0">
          {formatLabel(label)}
        </span>
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
          {content}
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
  onDeleteCustom,
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
  onDeleteCustom?: (id: string) => void;
  isSavedInConcepts?: boolean;
  canSaveToConcepts?: boolean;
  messages?: { role: string; content: string }[];
  onSendMessage?: (text: string) => void;
  isRtl?: boolean;
}) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const [feedbackGiven, setFeedbackGiven] = useState<"helpful" | "not-helpful" | "removed" | null>(null);
  const [reflection, setReflection] = useState("");
  const [reflectionSaved, setReflectionSaved] = useState(false);
  /** When false, show hint + pencil; when true, show textarea + Save note */
  const [reflectionEditorOpen, setReflectionEditorOpen] = useState(false);
  const [savedCelebration, setSavedCelebration] = useState(false);
  const [generateModal, setGenerateModal] = useState<{
    suggestion: string;
    generatedText: string;
    loading: boolean;
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setFeedbackGiven(null);
    setReflection("");
    setReflectionSaved(false);
    setReflectionEditorOpen(false);
    setSavedCelebration(false);
    setGenerateModal(null);
    setDeleteConfirmOpen(false);
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
        className="relative rounded-3xl shadow-xl w-full max-w-lg sm:max-w-[var(--modal-mental-model-max-w)] max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col bg-background border border-neutral-200 dark:border-neutral-700"
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
            </div>
            <div className="flex items-center gap-1">
              {model.id.startsWith("custom_") && onDeleteCustom && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-500 hover:text-red-600 transition-colors"
                  aria-label="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
        </div>

        <div className="relative flex-1 min-h-0 overflow-y-auto p-4">
          <div className="space-y-8 pb-4 divide-y divide-neutral-200 dark:divide-neutral-700 [&>*]:pt-8 [&>*:first-child]:pt-0">
          {!model.id.startsWith("custom_") && (
            <div className="flex flex-col items-center pb-8">
              <div className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 w-full max-w-md aspect-[4/3] bg-neutral-100 dark:bg-neutral-800">
                <img
                  src={`/images/${model.id.replace(/_/g, "-")}.png`}
                  alt={model.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          <div className="divide-y divide-neutral-200 dark:divide-neutral-700 [&>*]:py-6 [&>*:first-child]:pt-0">
            <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  The big idea
                </p>
                <blockquote className="border-l-4 border-neutral-400 dark:border-neutral-500 pl-5 py-3 text-lg font-medium text-foreground italic leading-relaxed mt-2" dir={isRtl ? "rtl" : undefined}>
                  &ldquo;{getOneLiner(model)}&rdquo;
                </blockquote>
              </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Meet the concept
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 text-base leading-relaxed mt-2" dir={isRtl ? "rtl" : undefined}>
                  {model.quick_introduction}
                </p>
              </div>
              {relevanceContext && (
                <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-4">
                  <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                    Why this matters for your decision
                  </p>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 italic">
                    &ldquo;{relevanceContext}&rdquo;
                  </p>
                </div>
              )}
            </div>

          {tryThisItems.length > 0 && (
            <div className="space-y-6">
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
                        {prompt}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
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
            </div>
          )}

          <div className="space-y-6">
              <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  When to use it
                </p>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-2">
                  This lens is especially useful when:
                </p>
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
              </div>
            </div>

          {askYourselfItems.length > 0 && (
            <div className="space-y-6">
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
                        {q}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
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
            </div>
          )}

          {canSaveToConcepts && (
            <div className="space-y-6">
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
                    reflectionEditorOpen ? (
                      <div>
                        <label
                          htmlFor="reflection"
                          className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1"
                        >
                          Optional: How might this apply to your situation?
                        </label>
                        <textarea
                          id="reflection"
                          value={reflection}
                          onChange={(e) => setReflection(e.target.value)}
                          placeholder="Jot a quick note..."
                          rows={3}
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        />
                        <div className="flex flex-wrap justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReflectionEditorOpen(false);
                              setReflection("");
                            }}
                            className="px-3 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            Cancel
                          </button>
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
                                if (res.ok) {
                                  setReflectionSaved(true);
                                  setReflectionEditorOpen(false);
                                }
                              } catch {
                                /* ignore */
                              }
                            }}
                            disabled={!reflection.trim()}
                            className="px-3 py-2 rounded-xl bg-foreground text-background text-sm font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                          >
                            Save note
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <p className="text-xs text-neutral-600 dark:text-neutral-400">
                          Add a personal note (optional).
                        </p>
                        <button
                          type="button"
                          onClick={() => setReflectionEditorOpen(true)}
                          className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors shrink-0"
                          aria-label="Add note"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                            <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                      </div>
                    )
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
                <div className="flex flex-row items-center gap-2">
                  <button
                    onClick={handleSaveToLibrary}
                    className="flex-1 px-5 py-3 rounded-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-sm transition-all duration-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 active:scale-[0.98]"
                  >
                    Add to Favorites
                  </button>
                  <button
                    onClick={handleNotHelpful}
                    className="shrink-0 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors border-0 outline-none focus:outline-none focus:ring-0"
                  >
                    Skip for now
                  </button>
                </div>
              )}

              </div>
            </div>
          )}

          <div className="space-y-6">
              <div className="rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-4">
                  Dive deeper
                </p>
                <div className="rounded-2xl bg-white dark:bg-neutral-900 overflow-hidden min-w-0">
                  <AccordionItem
                    label="In more detail"
                    content={model.in_more_detail}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                  />
                  <AccordionItem
                    label="Why is it important?"
                    content={model.why_this_is_important}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                  />
                  <AccordionItem
                    label="How can you spot it?"
                    content={Object.entries(model.how_can_you_spot_it ?? {})
                      .map(([k, v]) => `${formatLabel(k)}: ${v}`)
                      .join("\n\n")}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                  />
                  <AccordionItem
                    label="Examples"
                    content={Object.entries(model.examples ?? {})
                      .map(([k, v]) => `${formatLabel(k)}: ${v}`)
                      .join("\n\n")}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                  />
                  <AccordionItem
                    label="Real world implications"
                    content={implications}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                  />
                  <AccordionItem
                    label="Professional application"
                    content={Object.entries(model.professional_application ?? {})
                      .map(([k, v]) => `${formatLabel(k)}: ${v}`)
                      .join("\n\n")}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
                  />
                  <AccordionItem
                    label="How this can be misapplied"
                    content={Object.entries(model.how_can_this_be_misapplied ?? {})
                      .map(([k, v]) => `${formatLabel(k)}: ${v}`)
                      .join("\n\n")}
                    defaultExpanded={false}
                    dir={isRtl ? "rtl" : undefined}
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
              </div>
            </div>
          </div>
          </div>
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

      {deleteConfirmOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 rounded-3xl"
          onClick={() => setDeleteConfirmOpen(false)}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-2xl shadow-xl max-w-sm w-full p-5 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-base">Delete this mental model?</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              &quot;{model.name}&quot; will be permanently removed. The agent will no longer use it.
            </p>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/me/mental-models/${model.id}`, {
                      method: "DELETE",
                    });
                    if (res.ok) {
                      setDeleteConfirmOpen(false);
                      onDeleteCustom?.(model.id);
                      handleClose();
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                className="px-3 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
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
