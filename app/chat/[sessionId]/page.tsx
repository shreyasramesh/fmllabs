"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import {
  parseAssistantMessage,
  parseRelevantContextBlock,
  parseRelevantContextFromStreamStart,
  extractRelevanceContext,
  extractMentalModelIds,
  type RelevantContextItem,
  type RelevantContext,
} from "@/lib/chat-utils";

import { ChatMarkdown } from "@/components/ChatMarkdown";
import {
  MentalModelModal,
  type MentalModel,
} from "@/components/MentalModelModal";
import {
  MentionInput,
  parseMentionsFromMessage,
} from "@/components/MentionInput";
import { UserMessageContent } from "@/components/UserMessageContent";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/components/LanguageProvider";
import { useUserType } from "@/components/UserTypeProvider";
import { LANGUAGES, isRtlLanguage, type LanguageCode } from "@/lib/languages";
import { USER_TYPES, type UserTypeId } from "@/lib/user-types";
import { AIGenerateIcon, GenerateRelevantMessageButton, GhostIcon, SparklesIcon, TrashIcon } from "@/components/SharedIcons";
import { getModalTranslations } from "@/lib/mental-model-modal-translations";
import { playSelectionChime } from "@/lib/selection-chime";
import { stripMarkdown } from "@/lib/strip-markdown";
import { resolveTtsReferenceText } from "@/lib/tts-reference-text";
import { TTSButton } from "@/components/TTSButton";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { useTtsSpeed } from "@/components/TtsSpeedProvider";
import { useBackground } from "@/components/BackgroundProvider";
import Image from "next/image";
import { DefaultIcon } from "@/components/ElementIcons";
import { Clock } from "@/components/Clock";
import { TtsHighlightContext, type TtsHighlightState } from "@/components/TtsHighlightContext";
import { TtsHighlightedText } from "@/components/TtsHighlightedText";
import { FeedbackModal } from "@/components/FeedbackModal";
import { FeatureTour } from "@/components/FeatureTour";
import { ChromeIcon } from "@/components/ChromeIcon";

interface Message {
  role: "user" | "assistant";
  content: string;
  selectedContexts?: {
    mentalModels: RelevantContextItem[];
    longTermMemories: RelevantContextItem[];
    customConcepts: RelevantContextItem[];
    conceptGroups: RelevantContextItem[];
    perspectiveCards?: RelevantContextItem[];
  };
  perspectiveCard?: { name: string; prompt: string };
}

function processMessagesWithContext(msgs: Message[]): Message[] {
  return msgs.map((m) => {
    if (m.role === "assistant" && m.content) {
      const { contentWithoutBlock, relevantContext } =
        parseRelevantContextBlock(m.content);
      return {
        ...m,
        content: contentWithoutBlock,
        selectedContexts: relevantContext ?? undefined,
      };
    }
    return m;
  });
}

interface Session {
  _id: string;
  title: string;
  mentalModelTags?: string[];
  isCollapsed?: boolean;
  longTermMemoryId?: string;
  updatedAt: string;
}

interface LongTermMemoryItem {
  _id: string;
  title: string;
  summary: string;
  enrichmentPrompt: string;
  sourceSessionId: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomConceptItem {
  _id: string;
  title: string;
  summary: string;
  enrichmentPrompt: string;
  createdAt: string;
  updatedAt: string;
}

interface ConceptGroupItem {
  _id: string;
  title: string;
  conceptIds: string[];
  isCustomGroup?: boolean;
  concepts?: CustomConceptItem[];
}

type WeatherFormat = "condition-temp" | "emoji-temp" | "temp-only";
const LETTER_MODAL_TITLE = "a note from the developer";
type ExportDataSection =
  | "settings"
  | "sessions"
  | "messages"
  | "long_term_memory"
  | "custom_concepts"
  | "concept_groups"
  | "nuggets"
  | "transcripts"
  | "saved_mental_models";

const EXPORT_DATA_SECTION_OPTIONS: Array<{
  key: ExportDataSection;
  label: string;
  description: string;
}> = [
  { key: "settings", label: "Settings", description: "Theme, language, voice, and app preferences." },
  { key: "sessions", label: "Sessions", description: "Conversation list and metadata." },
  { key: "messages", label: "Messages", description: "Full chat history for your sessions." },
  { key: "long_term_memory", label: "Long-term memory", description: "Saved memory summaries and prompts." },
  { key: "custom_concepts", label: "Custom concepts", description: "Your created concepts and enrichments." },
  { key: "concept_groups", label: "Concept groups", description: "Groups and linked concept IDs." },
  { key: "nuggets", label: "Nuggets", description: "Saved insights and source notes." },
  { key: "transcripts", label: "Saved transcripts", description: "Video transcript captures." },
  {
    key: "saved_mental_models",
    label: "Saved mental models",
    description: "Limited export: name, quick introduction, and one-liner only.",
  },
];

const DEFAULT_EXPORT_SELECTIONS: Record<ExportDataSection, boolean> = {
  settings: true,
  sessions: true,
  messages: true,
  long_term_memory: true,
  custom_concepts: true,
  concept_groups: true,
  nuggets: true,
  transcripts: true,
  saved_mental_models: true,
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}

function MessageBubble({
  message,
  messageIndex,
  totalMessages,
  isLoading,
  onOptionSelect,
  onRetry,
  onGoBackInTime,
  isLastAssistant,
  isLastUserMessageAndLoading,
  idToName,
  ltmIdToTitle,
  ccIdToTitle,
  cgIdToTitle,
  onMentalModelClick,
  onLtmClick,
  onCustomConceptClick,
  onConceptGroupClick,
  onPerspectiveCardClick,
  previewMap,
  isRtl,
  ttsHighlight,
  onTtsProgress,
  onTtsEnd,
  showTtsButton = true,
}: {
  message: Message;
  messageIndex: number;
  totalMessages: number;
  isLoading: boolean;
  onOptionSelect: (text: string) => void;
  onRetry?: () => void;
  onGoBackInTime?: (index: number, message: Message) => void;
  isLastAssistant: boolean;
  isLastUserMessageAndLoading?: boolean;
  idToName: Map<string, string>;
  ltmIdToTitle: Map<string, string>;
  ccIdToTitle: Map<string, string>;
  cgIdToTitle: Map<string, string>;
  onMentalModelClick: (id: string, sourceMessage?: string) => void;
  onLtmClick: (id: string) => void;
  onCustomConceptClick?: (id: string) => void;
  onConceptGroupClick?: (id: string) => void;
  onPerspectiveCardClick?: (card: { name: string; prompt: string }) => void;
  previewMap?: Map<string, { oneLiner?: string; quickIntro?: string }>;
  isRtl?: boolean;
  ttsHighlight?: number;
  onTtsProgress?: (messageIndex: number, charEnd: number) => void;
  onTtsEnd?: () => void;
  showTtsButton?: boolean;
}) {
  const { text, options } =
    message.role === "assistant"
      ? parseAssistantMessage(message.content)
      : { text: message.content, options: [] };
  const isLastMsg = message.role === "assistant" && isLastAssistant;
  const showOptions =
    message.role === "assistant" &&
    options.length > 0 &&
    isLastMsg;

  const ctx = message.role === "assistant" ? message.selectedContexts : undefined;
  const ctxCount = ctx && ctx.mentalModels.length + ctx.longTermMemories.length + (ctx.customConcepts?.length ?? 0) + (ctx.conceptGroups?.length ?? 0) + (ctx.perspectiveCards?.length ?? 0);
  const assistantPlainText = message.role === "assistant"
    ? resolveTtsReferenceText(text, { idToName, ltmIdToTitle, ccIdToTitle, cgIdToTitle })
    : "";
  const optionPlainTexts = message.role === "assistant"
    ? options.map((option) =>
        resolveTtsReferenceText(option, { idToName, ltmIdToTitle, ccIdToTitle, cgIdToTitle })
      )
    : [];
  const assistantOptionsPrefix = optionPlainTexts.length > 0 ? " Follow-up options: " : "";
  const assistantSpeechText = message.role === "assistant"
    ? (assistantPlainText + assistantOptionsPrefix + optionPlainTexts.join(". ")).trim()
    : text;
  const userPlainText = message.role === "user"
    ? resolveTtsReferenceText(text, { idToName, ltmIdToTitle, ccIdToTitle, cgIdToTitle })
    : "";
  const isAssistantTtsActive =
    message.role === "assistant" && typeof ttsHighlight === "number" && ttsHighlight >= 0;
  const isUserTtsActive =
    message.role === "user" && typeof ttsHighlight === "number" && ttsHighlight >= 0;
  const isSpeakingAssistantBody = isAssistantTtsActive && ttsHighlight < assistantPlainText.length;
  const activeOptionHighlight = (() => {
    if (!isAssistantTtsActive || optionPlainTexts.length === 0) return null;

    let cursor = assistantPlainText.length + assistantOptionsPrefix.length;
    for (let index = 0; index < optionPlainTexts.length; index++) {
      const optionText = optionPlainTexts[index];
      const optionStart = cursor;
      const optionEnd = optionStart + optionText.length;
      const optionRangeEnd = optionEnd + (index < optionPlainTexts.length - 1 ? 2 : 0);

      if (ttsHighlight >= optionStart && ttsHighlight < optionRangeEnd) {
        return {
          index,
          charEnd: Math.min(
            Math.max(ttsHighlight - optionStart, 0),
            Math.max(optionText.length - 1, 0)
          ),
        };
      }

      cursor = optionEnd + (index < optionPlainTexts.length - 1 ? 2 : 0);
    }

    return null;
  })();
  const [ctxExpanded, setCtxExpanded] = useState(false);
  const [ctxReasonPillKey, setCtxReasonPillKey] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const ctxItems: { type: "mm" | "ltm" | "cc" | "cg" | "card"; id: string; title: string; reason: string; prompt?: string }[] = ctx
    ? [
        ...ctx.mentalModels.map(({ id, reason, title }) => ({
          type: "mm" as const,
          id,
          title: title ?? idToName.get(id) ?? id.replace(/_/g, " "),
          reason,
        })),
        ...ctx.longTermMemories.map(({ id, reason, title }) => ({
          type: "ltm" as const,
          id,
          title: title ?? ltmIdToTitle.get(id) ?? "Memory",
          reason,
        })),
        ...(ctx.customConcepts ?? []).map(({ id, reason, title }) => ({
          type: "cc" as const,
          id,
          title: title ?? ccIdToTitle.get(id) ?? "Concept",
          reason,
        })),
        ...(ctx.conceptGroups ?? []).map(({ id, reason, title }) => ({
          type: "cg" as const,
          id,
          title: title ?? cgIdToTitle.get(id) ?? "Domain",
          reason,
        })),
        ...(ctx.perspectiveCards ?? []).map(({ id, reason, title, prompt }) => ({
          type: "card" as const,
          id,
          title: title ?? "Perspective card",
          reason,
          prompt,
        })),
      ]
    : [];

  const openContextFor = useCallback(
    (type: "mm" | "ltm" | "cc" | "cg" | "card", id: string, cardPrompt?: string) => {
      setCtxReasonPillKey(null);
      if (type === "mm") onMentalModelClick(id, text);
      else if (type === "ltm") onLtmClick(id);
      else if (type === "cc") onCustomConceptClick?.(id);
      else if (type === "cg") onConceptGroupClick?.(id);
      else if (type === "card" && onPerspectiveCardClick && cardPrompt) {
        const item = ctxItems.find((i) => i.type === "card" && i.id === id);
        if (item?.title) onPerspectiveCardClick({ name: item.title, prompt: cardPrompt });
      }
    },
    [text, ctxItems, onMentalModelClick, onLtmClick, onCustomConceptClick, onConceptGroupClick, onPerspectiveCardClick]
  );

  const pillStyles = {
    mm: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200/60 dark:border-amber-700/50 hover:bg-amber-200/80 dark:hover:bg-amber-800/50 hover:border-amber-300 dark:hover:border-amber-600/60",
    ltm: "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 border-teal-200/60 dark:border-teal-700/50 hover:bg-teal-200/80 dark:hover:bg-teal-800/50 hover:border-teal-300 dark:hover:border-teal-600/60",
    cc: "bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 border-violet-200/60 dark:border-violet-700/50 hover:bg-violet-200/80 dark:hover:bg-violet-800/50 hover:border-violet-300 dark:hover:border-violet-600/60",
    cg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-200/60 dark:border-emerald-700/50 hover:bg-emerald-200/80 dark:hover:bg-emerald-800/50 hover:border-emerald-300 dark:hover:border-emerald-600/60",
    card: "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-200/60 dark:border-rose-700/50 hover:bg-rose-200/80 dark:hover:bg-rose-800/50 hover:border-rose-300 dark:hover:border-rose-600/60",
  };
  const pillDotColors = {
    mm: "bg-amber-500 dark:bg-amber-400",
    ltm: "bg-teal-500 dark:bg-teal-400",
    cc: "bg-violet-500 dark:bg-violet-400",
    cg: "bg-emerald-500 dark:bg-emerald-400",
    card: "bg-rose-500 dark:bg-rose-400",
  };

  const canGoBack =
    onGoBackInTime &&
    messageIndex < totalMessages - 1 &&
    !isLoading;

  return (
    <div
      className={`group/msg flex flex-col animate-fade-in-up ${
        message.role === "user" ? "items-end" : "items-start"
      }`}
    >
      <div
        className={`group/tts relative max-w-[85%] rounded-3xl px-4 py-3 pr-12 transition-shadow duration-200 ${
          message.role === "user"
            ? "bg-foreground text-background shadow-sm"
            : "bg-background border border-neutral-300 dark:border-neutral-600 shadow-sm text-foreground"
        }`}
        dir={isRtl ? "rtl" : undefined}
      >
        {showTtsButton && (
        <div className="absolute top-2 right-2">
          <TTSButton
              text={message.role === "assistant" ? assistantSpeechText : text}
              plainText={message.role === "assistant" ? assistantSpeechText : userPlainText}
              showOnHover={false}
              layout="vertical"
            ariaLabel="Listen to message"
              onTtsProgress={(charEnd) => onTtsProgress?.(messageIndex, charEnd)}
              onTtsEnd={onTtsEnd}
          />
        </div>
        )}
        {message.role === "user" ? (
          <div className="flex flex-col gap-2">
            <span className="message-bubble-text text-sm md:text-base">
              {isUserTtsActive ? (
                <TtsHighlightedText
                  text={userPlainText}
                  charEnd={ttsHighlight}
                />
              ) : (
              <UserMessageContent
                content={text}
                idToName={idToName}
                ltmIdToTitle={ltmIdToTitle}
                ccIdToTitle={ccIdToTitle}
                cgIdToTitle={cgIdToTitle}
                onMentalModelClick={(id) => onMentalModelClick(id, text)}
                onLtmClick={onLtmClick}
                onCustomConceptClick={onCustomConceptClick}
                onConceptGroupClick={onConceptGroupClick}
                previewMap={previewMap}
              />
              )}
            </span>
            {message.perspectiveCard && (
              <div className="mt-1 pt-2 border-t border-white/20 rounded-b-xl">
                <p className="text-xs font-medium opacity-90 uppercase tracking-wider">{message.perspectiveCard.name}</p>
                <p className="text-sm opacity-95 mt-0.5 leading-relaxed">{message.perspectiveCard.prompt}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="message-bubble-text text-sm md:text-base">
            {message.perspectiveCard && (
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                {message.perspectiveCard.name}
              </p>
            )}
            {text ? (
              <>
                {isSpeakingAssistantBody ? (
                  <TtsHighlightedText
                    text={assistantPlainText}
                    charEnd={ttsHighlight}
                  />
                ) : (
                <ChatMarkdown
                  content={text}
                  idToName={idToName}
                  ltmIdToTitle={ltmIdToTitle}
                  ccIdToTitle={ccIdToTitle}
                  cgIdToTitle={cgIdToTitle}
                  onMentalModelClick={onMentalModelClick}
                  onLtmClick={onLtmClick}
                  onCustomConceptClick={onCustomConceptClick}
                  onConceptGroupClick={onConceptGroupClick}
                  previewMap={previewMap}
                />
                )}
                {isLastMsg && isLoading && (
                  <span
                    className="inline-block w-0.5 h-4 ml-0.5 bg-foreground/80 animate-blink align-middle"
                    aria-hidden
                  />
                )}
                {isLastMsg && text === "Something went wrong." && onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 inline-block px-3 py-1.5 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
                  >
                    Retry
                  </button>
                )}
              </>
            ) : (
              <LoadingDots className="opacity-70" />
            )}
          </div>
        )}
      </div>
      {canGoBack && (
        <button
          type="button"
          onClick={() => onGoBackInTime?.(messageIndex, message)}
          className="mt-1.5 opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 transition-opacity text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 focus:opacity-100"
        >
          Go back to here
        </button>
      )}
      {message.role === "assistant" && ctx && ctxCount !== undefined && (
          <div className="mt-2 max-w-[85%] flex flex-col items-start">
            {ctxExpanded ? (
              <div
                className="w-full rounded-2xl border border-neutral-300 dark:border-neutral-600 bg-gradient-to-br from-neutral-50/95 to-neutral-100/80 dark:from-neutral-800 dark:to-neutral-900 shadow-sm overflow-visible text-foreground"
                onPointerDownCapture={(e) => {
                  if (ctxReasonPillKey && !(e.target as HTMLElement).closest("[data-context-pill]")) {
                    setCtxReasonPillKey(null);
                  }
                }}
              >
                <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-neutral-200/60 dark:border-white/10">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Context used
                  </span>
                  <button
                    type="button"
                    onClick={() => { setCtxExpanded(false); setCtxReasonPillKey(null); }}
                    className="text-xs font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                  >
                    Collapse
                  </button>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {ctxCount === 0 ? (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                      No mental models or memories used
                    </span>
                  ) : (
                    ctxItems.map((item) => {
                      const key = `${item.type}-${item.id}`;
                      const isShowingReason = ctxReasonPillKey === key;
                      return (
                        <div key={key} className="relative" data-context-pill>
                          <button
                            type="button"
                            className={`inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-medium border transition-all duration-200 shadow-sm shrink-0 ${pillStyles[item.type]}`}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              didLongPressRef.current = false;
                              longPressTimerRef.current = setTimeout(() => {
                                longPressTimerRef.current = null;
                                didLongPressRef.current = true;
                                openContextFor(item.type, item.id, item.type === "card" ? item.prompt : undefined);
                              }, 500);
                            }}
                            onPointerUp={() => {
                              if (longPressTimerRef.current) {
                                clearTimeout(longPressTimerRef.current);
                                longPressTimerRef.current = null;
                                if (!didLongPressRef.current) {
                                  setCtxReasonPillKey((prev) => (prev === key ? null : key));
                                }
                              }
                              didLongPressRef.current = false;
                            }}
                            onPointerLeave={() => {
                              if (longPressTimerRef.current) {
                                clearTimeout(longPressTimerRef.current);
                                longPressTimerRef.current = null;
                              }
                              didLongPressRef.current = false;
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            title={item.reason || (item.type === "mm" ? "Hold to open mental model" : item.type === "ltm" ? "Hold to open memory" : item.type === "cc" ? "Hold to open concept" : item.type === "cg" ? "Hold to open domain" : "Applied perspective")}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pillDotColors[item.type]}`} aria-hidden />
                            <span>{item.title}</span>
                          </button>
                          {isShowingReason && (
                            <div
                              className="absolute left-0 right-0 top-full mt-1 z-10 py-2 px-2.5 rounded-lg text-[11px] text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 shadow-lg max-h-32 overflow-y-auto"
                              role="tooltip"
                            >
                              <p className="font-medium text-neutral-500 dark:text-neutral-400 mb-0.5">Why it was used</p>
                              <p className="break-words">{item.reason || "No reason provided"}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCtxExpanded(true)}
                className="inline-flex items-center gap-2 py-1.5 px-3 rounded-xl text-xs font-medium bg-gradient-to-r from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 hover:from-neutral-200 hover:to-neutral-100 dark:hover:from-neutral-700 dark:hover:to-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200 hover:border-neutral-400 dark:hover:border-neutral-500 transition-all duration-200 shadow-sm"
              >
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500" aria-hidden />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 dark:bg-teal-500" aria-hidden />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500" aria-hidden />
                </span>
                Context used ({ctxCount})
              </button>
            )}
          </div>
        )}
      {showOptions && (
        <div className="mt-2 flex flex-col gap-2 max-w-[85%]">
          {options.map((opt, j) => (
            <button
              key={j}
              onClick={() => {
                playSelectionChime();
                onOptionSelect(opt);
              }}
              className="message-bubble-option px-3 py-2 rounded-2xl border border-neutral-300 dark:border-neutral-600 bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm transition-all duration-200 active:scale-[0.98] hover:border-neutral-400 dark:hover:border-neutral-500 text-left opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${j * 80}ms`, animationFillMode: "forwards" }}
            >
              {activeOptionHighlight?.index === j ? (
                <TtsHighlightedText
                  text={optionPlainTexts[j] ?? stripMarkdown(opt).trim()}
                  charEnd={activeOptionHighlight.charEnd}
                />
              ) : (
              <UserMessageContent
                content={opt}
                idToName={idToName}
                ltmIdToTitle={ltmIdToTitle}
                ccIdToTitle={ccIdToTitle}
                cgIdToTitle={cgIdToTitle}
                chipStyle="assistant"
                onMentalModelClick={(id) => onMentalModelClick(id, opt)}
                onLtmClick={onLtmClick}
                onCustomConceptClick={onCustomConceptClick}
                onConceptGroupClick={onConceptGroupClick}
                previewMap={previewMap}
              />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LanguageChangeBanner({ onDismiss }: { onDismiss: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const exitDuration = 250;
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (isExiting) return;
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
    setIsExiting(true);
    setTimeout(onDismiss, exitDuration);
  }, [isExiting, onDismiss]);

  useEffect(() => {
    autoDismissRef.current = setTimeout(dismiss, 5000);
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [dismiss]);

  return (
    <div className="mx-4 mt-2 flex justify-center">
      <div
        className={`max-w-xl w-full px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100 flex items-center justify-between gap-3 ${
          isExiting ? "animate-fade-out-up" : "animate-reveal-down"
        }`}
      >
        <span>Start a new conversation to use your new language and voice style settings.</span>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function LoadingDots({
  className = "",
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <span
      className={`inline-flex gap-0.5 ${className}`}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-bounce-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}

function CopyButton({
  text,
  "aria-label": ariaLabel,
}: {
  text: string;
  "aria-label"?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className="shrink-0 p-2 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-neutral-600 dark:text-neutral-400">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
}

const EXAMPLE_PILLS_BY_LANGUAGE: Record<LanguageCode, string[][]> = {
  en: [
  [
    "Career change",
    "New job offer",
    "Asking for a raise",
    "Quitting my job",
    "Side project",
    "Work-life balance",
    "Toxic workplace",
    "Switching industries",
    "Sticking with a failing project",
    "Negotiating salary",
  ],
  [
    "Relationship decision",
    "Moving to a new city",
    "Buying a house",
    "Big purchase",
    "Retirement planning",
    "Investing money",
    "Conflict with someone",
    "Taking a financial risk",
    "Splitting costs fairly",
    "Letting go of an investment",
  ],
  [
    "Starting a business",
    "Going back to school",
    "Family planning",
    "Health habit",
    "Procrastination",
    "Saying no to something",
    "Sticking to a commitment",
    "Doubting a past decision",
    "Avoiding something I should face",
    "Choosing between two good options",
  ],
  ],
  hi: [
    [
      "कैरियर बदलना",
      "नई नौकरी का ऑफर",
      "वेतन बढ़ाने की बात करना",
      "नौकरी छोड़ना",
      "साइड प्रोजेक्ट",
      "काम और जीवन में संतुलन",
      "विषाक्त कार्यस्थल",
      "इंडस्ट्री बदलना",
      "असफल प्रोजेक्ट में बने रहना",
      "वेतन पर बातचीत",
    ],
    [
      "रिश्ते का फैसला",
      "नए शहर में जाना",
      "घर खरीदना",
      "बड़ी खरीदारी",
      "रिटायरमेंट की योजना",
      "पैसा निवेश करना",
      "किसी से टकराव",
      "वित्तीय जोखिम लेना",
      "खर्च बराबर बांटना",
      "निवेश छोड़ देना",
    ],
    [
      "व्यवसाय शुरू करना",
      "फिर से पढ़ाई करना",
      "परिवार की योजना",
      "स्वास्थ्य की आदत",
      "टालमटोल",
      "किसी चीज़ को ना कहना",
      "प्रतिबद्धता निभाना",
      "पुराने फैसले पर संदेह",
      "जिसका सामना करना चाहिए उससे बचना",
      "दो अच्छे विकल्पों में चुनना",
    ],
  ],
  ta: [
    [
      "தொழில் மாற்றம்",
      "புதிய வேலை வாய்ப்பு",
      "சம்பள உயர்வு கேட்பது",
      "வேலையை விட்டு வெளியேறுவது",
      "பக்க திட்டம்",
      "வேலை-வாழ்க்கை சமநிலை",
      "நச்சு பணியிடம்",
      "துறை மாற்றம்",
      "தோல்வியடைந்த திட்டத்தில் தொடருவது",
      "சம்பள பேச்சுவார்த்தை",
    ],
    [
      "உறவு முடிவு",
      "புதிய நகரத்துக்கு மாற்றம்",
      "வீடு வாங்குவது",
      "பெரிய கொள்முதல்",
      "ஓய்வு திட்டமிடல்",
      "பணம் முதலீடு செய்வது",
      "யாரோடோ மோதல்",
      "நிதி ஆபத்து எடுப்பது",
      "செலவை நியாயமாக பகிர்வு",
      "ஒரு முதலீட்டை விடுவது",
    ],
    [
      "வணிகம் தொடங்குவது",
      "மீண்டும் படிப்பது",
      "குடும்ப திட்டமிடல்",
      "ஆரோக்கிய பழக்கம்",
      "தாமதப்படுத்துதல்",
      "ஒரு விஷயத்திற்கு இல்லை என்று சொல்வது",
      "ஒரு உறுதியை காப்பது",
      "கடந்த முடிவை சந்தேகிப்பது",
      "எதிர்கொள்ள வேண்டியதை தவிர்ப்பது",
      "இரண்டு நல்ல தேர்வுகளில் ஒன்றை தேர்வு செய்வது",
    ],
  ],
  kn: [
    [
      "ವೃತ್ತಿ ಬದಲಾವಣೆ",
      "ಹೊಸ ಉದ್ಯೋಗ ಆಫರ್",
      "ವೇತನ ಹೆಚ್ಚಳ ಕೇಳುವುದು",
      "ಉದ್ಯೋಗ ಬಿಟ್ಟುಹೋಗುವುದು",
      "ಸೈಡ್ ಪ್ರಾಜೆಕ್ಟ್",
      "ಕೆಲಸ-ಜೀವನ ಸಮತೋಲನ",
      "ವಿಷಕಾರಿ ಕೆಲಸದ ಸ್ಥಳ",
      "ಉದ್ಯಮ ಬದಲಾವಣೆ",
      "ವಿಫಲವಾಗುತ್ತಿರುವ ಯೋಜನೆಯಲ್ಲಿ ಉಳಿಯುವುದು",
      "ವೇತನ ಮಾತುಕತೆ",
    ],
    [
      "ಸಂಬಂಧದ ನಿರ್ಧಾರ",
      "ಹೊಸ ನಗರಕ್ಕೆ ಸ್ಥಳಾಂತರ",
      "ಮನೆ ಖರೀದಿಸುವುದು",
      "ದೊಡ್ಡ ಖರೀದಿ",
      "ನಿವೃತ್ತಿ ಯೋಜನೆ",
      "ಹಣ ಹೂಡಿಕೆ",
      "ಯಾರೊಂದಿಗಾದರೂ ಸಂಘರ್ಷ",
      "ಆರ್ಥಿಕ ಅಪಾಯ ತೆಗೆದುಕೊಳ್ಳುವುದು",
      "ವೆಚ್ಚವನ್ನು ನ್ಯಾಯವಾಗಿ ಹಂಚಿಕೊಳ್ಳುವುದು",
      "ಹೂಡಿಕೆಯಿಂದ ಹೊರಬರುವುದು",
    ],
    [
      "ವ್ಯವಹಾರ ಆರಂಭಿಸುವುದು",
      "ಮತ್ತೆ ಓದಲು ಹೋಗುವುದು",
      "ಕುಟುಂಬ ಯೋಜನೆ",
      "ಆರೋಗ್ಯದ ಅಭ್ಯಾಸ",
      "ಮುಂದೂಡುವಿಕೆ",
      "ಯಾವುದಕ್ಕಾದರೂ ಇಲ್ಲ ಎಂದು ಹೇಳುವುದು",
      "ಬದ್ಧತೆಯನ್ನು ಉಳಿಸಿಕೊಳ್ಳುವುದು",
      "ಹಿಂದಿನ ನಿರ್ಧಾರವನ್ನು ಸಂಶಯಿಸುವುದು",
      "ಎದುರಿಸಬೇಕಾದುದನ್ನು ತಪ್ಪಿಸುವುದು",
      "ಎರಡು ಉತ್ತಮ ಆಯ್ಕೆಗಳ ನಡುವೆ ಆರಿಸುವುದು",
    ],
  ],
  ja: [
    [
      "転職",
      "新しい仕事のオファー",
      "昇給をお願いする",
      "仕事を辞める",
      "サイドプロジェクト",
      "ワークライフバランス",
      "有害な職場",
      "業界を変える",
      "失敗しそうなプロジェクトを続ける",
      "給与交渉",
    ],
    [
      "人間関係の決断",
      "新しい街へ引っ越す",
      "家を買う",
      "大きな買い物",
      "退職後の計画",
      "お金を投資する",
      "誰かとの対立",
      "金銭的リスクを取る",
      "費用を公平に分ける",
      "投資を手放す",
    ],
    [
      "起業する",
      "学校に戻る",
      "家族計画",
      "健康習慣",
      "先延ばし",
      "何かを断る",
      "約束を守る",
      "過去の決断を疑う",
      "向き合うべきことを避ける",
      "2つの良い選択肢で迷う",
    ],
  ],
  zh: [
    [
      "换工作",
      "新的工作机会",
      "争取加薪",
      "辞职",
      "副业项目",
      "工作与生活平衡",
      "有毒职场",
      "转换行业",
      "继续一个失败中的项目",
      "薪资谈判",
    ],
    [
      "关系中的决定",
      "搬到新城市",
      "买房",
      "大额消费",
      "退休规划",
      "投资理财",
      "与他人发生冲突",
      "承担财务风险",
      "公平分摊费用",
      "放弃一项投资",
    ],
    [
      "创业",
      "重返校园",
      "家庭规划",
      "健康习惯",
      "拖延症",
      "对某件事说不",
      "坚持承诺",
      "怀疑过去的决定",
      "逃避必须面对的事情",
      "在两个好选择之间做决定",
    ],
  ],
  es: [
    [
      "Cambio de carrera",
      "Nueva oferta de trabajo",
      "Pedir un aumento",
      "Renunciar a mi trabajo",
      "Proyecto paralelo",
      "Equilibrio entre trabajo y vida",
      "Lugar de trabajo tóxico",
      "Cambiar de industria",
      "Seguir en un proyecto fallido",
      "Negociar salario",
    ],
    [
      "Decisión de pareja",
      "Mudarse a una nueva ciudad",
      "Comprar una casa",
      "Compra importante",
      "Planificación de jubilación",
      "Invertir dinero",
      "Conflicto con alguien",
      "Asumir un riesgo financiero",
      "Repartir gastos de forma justa",
      "Dejar una inversión",
    ],
    [
      "Empezar un negocio",
      "Volver a estudiar",
      "Planificación familiar",
      "Hábito de salud",
      "Procrastinación",
      "Decir que no a algo",
      "Cumplir un compromiso",
      "Dudar de una decisión pasada",
      "Evitar algo que debo enfrentar",
      "Elegir entre dos buenas opciones",
    ],
  ],
  ar: [
    [
      "تغيير المسار المهني",
      "عرض عمل جديد",
      "طلب زيادة في الراتب",
      "ترك الوظيفة",
      "مشروع جانبي",
      "التوازن بين العمل والحياة",
      "بيئة عمل سامة",
      "تغيير المجال",
      "الاستمرار في مشروع فاشل",
      "التفاوض على الراتب",
    ],
    [
      "قرار في علاقة",
      "الانتقال إلى مدينة جديدة",
      "شراء منزل",
      "شراء كبير",
      "التخطيط للتقاعد",
      "استثمار المال",
      "خلاف مع شخص",
      "تحمل مخاطرة مالية",
      "تقسيم التكاليف بعدل",
      "التخلي عن استثمار",
    ],
    [
      "بدء مشروع تجاري",
      "العودة إلى الدراسة",
      "التخطيط للعائلة",
      "عادة صحية",
      "المماطلة",
      "قول لا لشيء ما",
      "الالتزام بوعد",
      "الشك في قرار سابق",
      "تجنب أمر يجب مواجهته",
      "الاختيار بين خيارين جيدين",
    ],
  ],
  fr: [
    [
      "Changer de carrière",
      "Nouvelle offre d'emploi",
      "Demander une augmentation",
      "Quitter mon travail",
      "Projet parallèle",
      "Équilibre vie pro-vie perso",
      "Environnement de travail toxique",
      "Changer de secteur",
      "Rester sur un projet en échec",
      "Négocier son salaire",
    ],
    [
      "Décision de couple",
      "Déménager dans une nouvelle ville",
      "Acheter une maison",
      "Achat important",
      "Préparer la retraite",
      "Investir de l'argent",
      "Conflit avec quelqu'un",
      "Prendre un risque financier",
      "Partager les coûts équitablement",
      "Abandonner un investissement",
    ],
    [
      "Lancer une entreprise",
      "Reprendre des études",
      "Planification familiale",
      "Habitude de santé",
      "Procrastination",
      "Dire non à quelque chose",
      "Tenir un engagement",
      "Douter d'une décision passée",
      "Éviter quelque chose à affronter",
      "Choisir entre deux bonnes options",
    ],
  ],
  bn: [
    [
      "ক্যারিয়ার পরিবর্তন",
      "নতুন চাকরির অফার",
      "বেতন বাড়ানোর কথা বলা",
      "চাকরি ছেড়ে দেওয়া",
      "সাইড প্রজেক্ট",
      "কাজ-জীবনের ভারসাম্য",
      "বিষাক্ত কর্মক্ষেত্র",
      "ইন্ডাস্ট্রি বদলানো",
      "ব্যর্থ প্রকল্পে লেগে থাকা",
      "বেতন নিয়ে আলোচনা",
    ],
    [
      "সম্পর্কের সিদ্ধান্ত",
      "নতুন শহরে যাওয়া",
      "বাড়ি কেনা",
      "বড় কেনাকাটা",
      "অবসর পরিকল্পনা",
      "টাকা বিনিয়োগ করা",
      "কারও সঙ্গে দ্বন্দ্ব",
      "আর্থিক ঝুঁকি নেওয়া",
      "খরচ ন্যায্যভাবে ভাগ করা",
      "একটি বিনিয়োগ ছেড়ে দেওয়া",
    ],
    [
      "ব্যবসা শুরু করা",
      "আবার পড়াশোনা শুরু করা",
      "পরিবার পরিকল্পনা",
      "স্বাস্থ্যকর অভ্যাস",
      "গড়িমসি",
      "কিছুতে না বলা",
      "অঙ্গীকারে অটল থাকা",
      "পুরনো সিদ্ধান্ত নিয়ে সন্দেহ",
      "যার মুখোমুখি হওয়া উচিত তা এড়িয়ে যাওয়া",
      "দুটি ভালো বিকল্পের মধ্যে বেছে নেওয়া",
    ],
  ],
  pt: [
    [
      "Mudança de carreira",
      "Nova oferta de emprego",
      "Pedir aumento",
      "Sair do meu emprego",
      "Projeto paralelo",
      "Equilíbrio entre trabalho e vida",
      "Ambiente de trabalho tóxico",
      "Mudar de setor",
      "Continuar em um projeto fracassado",
      "Negociar salário",
    ],
    [
      "Decisão de relacionamento",
      "Mudar para uma nova cidade",
      "Comprar uma casa",
      "Grande compra",
      "Planejamento de aposentadoria",
      "Investir dinheiro",
      "Conflito com alguém",
      "Assumir um risco financeiro",
      "Dividir custos de forma justa",
      "Abrir mão de um investimento",
    ],
    [
      "Começar um negócio",
      "Voltar a estudar",
      "Planejamento familiar",
      "Hábito de saúde",
      "Procrastinação",
      "Dizer não a algo",
      "Manter um compromisso",
      "Duvidar de uma decisão passada",
      "Evitar algo que eu deveria enfrentar",
      "Escolher entre duas boas opções",
    ],
  ],
  ru: [
    [
      "Смена карьеры",
      "Новое предложение о работе",
      "Попросить повышение",
      "Уволиться с работы",
      "Сторонний проект",
      "Баланс работы и жизни",
      "Токсичное рабочее место",
      "Сменить отрасль",
      "Оставаться в провальном проекте",
      "Переговоры о зарплате",
    ],
    [
      "Решение в отношениях",
      "Переезд в новый город",
      "Покупка дома",
      "Крупная покупка",
      "Планирование пенсии",
      "Инвестирование денег",
      "Конфликт с кем-то",
      "Финансовый риск",
      "Справедливо разделить расходы",
      "Отказаться от инвестиции",
    ],
    [
      "Начать бизнес",
      "Вернуться к учебе",
      "Планирование семьи",
      "Здоровая привычка",
      "Прокрастинация",
      "Сказать чему-то нет",
      "Сдержать обязательство",
      "Сомневаться в прошлом решении",
      "Избегать того, с чем нужно столкнуться",
      "Выбирать между двумя хорошими вариантами",
    ],
  ],
  ur: [
    [
      "کیریئر تبدیل کرنا",
      "نئی ملازمت کی پیشکش",
      "تنخواہ بڑھانے کی بات کرنا",
      "ملازمت چھوڑنا",
      "سائیڈ پروجیکٹ",
      "کام اور زندگی کا توازن",
      "زہریلا کام کا ماحول",
      "انڈسٹری بدلنا",
      "ناکام ہوتے منصوبے میں رہنا",
      "تنخواہ پر بات چیت",
    ],
    [
      "رشتے کا فیصلہ",
      "نئے شہر میں منتقل ہونا",
      "گھر خریدنا",
      "بڑی خریداری",
      "ریٹائرمنٹ کی منصوبہ بندی",
      "پیسہ سرمایہ کاری کرنا",
      "کسی سے تنازع",
      "مالی خطرہ لینا",
      "اخراجات منصفانہ بانٹنا",
      "سرمایہ کاری چھوڑ دینا",
    ],
    [
      "کاروبار شروع کرنا",
      "دوبارہ پڑھائی شروع کرنا",
      "خاندان کی منصوبہ بندی",
      "صحت کی عادت",
      "ٹال مٹول",
      "کسی چیز کو نہ کہنا",
      "عہد پر قائم رہنا",
      "پرانے فیصلے پر شک کرنا",
      "جس چیز کا سامنا کرنا چاہیے اس سے بچنا",
      "دو اچھے انتخاب میں سے ایک چننا",
    ],
  ],
};

function RippleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="11" />
    </svg>
  );
}

function MovingPills({ onSelect, language }: { onSelect: (text: string) => void; language: LanguageCode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const examplePills = EXAMPLE_PILLS_BY_LANGUAGE[language] ?? EXAMPLE_PILLS_BY_LANGUAGE.en;
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="space-y-4 overflow-hidden">
      {examplePills.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
          onMouseEnter={() => setHoveredRow(rowIndex)}
          onMouseLeave={() => setHoveredRow(null)}
        >
          <div
            className={`flex gap-3 shrink-0 ${
              prefersReducedMotion
                ? ""
                : rowIndex % 2 === 0
                  ? "animate-marquee-left"
                  : "animate-marquee-right"
            } ${hoveredRow === rowIndex ? "marquee-paused" : ""}`}
            style={{ width: "max-content" }}
          >
            {[...row, ...row].map((label, i) => (
              <button
                key={`${rowIndex}-${i}`}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  playSelectionChime();
                  onSelect(label);
                }}
                className="px-4 py-2 rounded-full text-sm font-medium bg-neutral-200/80 dark:bg-neutral-700/80 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all duration-200 active:scale-95 whitespace-nowrap"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { userId } = useAuth();
  const { user } = useUser();
  const { language, setLanguage, showLanguageChangeBanner, dismissLanguageChangeBanner } = useLanguage();
  const { userType, setUserType, showUserTypeChangeBanner, dismissUserTypeChangeBanner } = useUserType();
  const languageRef = useRef(language);
  languageRef.current = language;
  const userTypeRef = useRef(userType);
  userTypeRef.current = userType;
  const isAnonymous = !userId;
  const sessionId = params.sessionId as string;
  const isNew = sessionId === "new";
  const incognitoMode = sessionId === "incognito";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(!isNew && !incognitoMode);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    isNew || incognitoMode ? null : sessionId
  );
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [collapsedSummary, setCollapsedSummary] = useState<LongTermMemoryItem | null>(null);
  const [longTermMemories, setLongTermMemories] = useState<LongTermMemoryItem[]>([]);
  const [summarizeModal, setSummarizeModal] = useState<{
    summary: string;
    enrichmentPrompt: string;
    longTermMemoryId: string;
  } | null>(null);
  const [summarizeLanguageModal, setSummarizeLanguageModal] = useState<{
    selectedLanguage: LanguageCode;
  } | null>(null);
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  const [summarizeSuccess, setSummarizeSuccess] = useState(false);
  const { speed: ttsSpeed, setSpeed: setTtsSpeed, clonedVoices, refreshSettings } = useTtsSpeed();
  const [voiceCloneLoading, setVoiceCloneLoading] = useState(false);
  const [voiceCloneError, setVoiceCloneError] = useState<string | null>(null);
  const [voiceCloneRecording, setVoiceCloneRecording] = useState(false);
  const [voiceCloneRecordedBlob, setVoiceCloneRecordedBlob] = useState<Blob | null>(null);
  const [voiceCloneLanguage, setVoiceCloneLanguage] = useState<LanguageCode | "all">("all");
  const [exportSelections, setExportSelections] = useState<Record<ExportDataSection, boolean>>(
    DEFAULT_EXPORT_SELECTIONS
  );
  const [exportSectionOpen, setExportSectionOpen] = useState(false);
  const [exportMarkdownLoading, setExportMarkdownLoading] = useState(false);
  const [exportMarkdownError, setExportMarkdownError] = useState<string | null>(null);
  const voiceCloneMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceCloneChunksRef = useRef<Blob[]>([]);
  const voiceCloneClosingRef = useRef(false);
  const { background, setBackground } = useBackground();
  const [weatherFormat, setWeatherFormat] = useState<WeatherFormat>("condition-temp");
  const [moonPhase, setMoonPhase] = useState<number | null>(null);
  const [ttsHighlight, setTtsHighlight] = useState<TtsHighlightState>(null);
  const [conceptSavedToast, setConceptSavedToast] = useState(false);
  const [restartLoading, setRestartLoading] = useState(false);
  const [ltmDetailModal, setLtmDetailModal] = useState<LongTermMemoryItem | null>(null);
  const [ltmDeleteConfirmModal, setLtmDeleteConfirmModal] = useState<LongTermMemoryItem | null>(null);
  const [customConcepts, setCustomConcepts] = useState<CustomConceptItem[]>([]);
  const [ccDetailModal, setCcDetailModal] = useState<CustomConceptItem | null>(null);
  const [ccDeleteConfirmModal, setCcDeleteConfirmModal] = useState<CustomConceptItem | null>(null);
  const [generateModal, setGenerateModal] = useState<{
    type: "ltm" | "cc";
    generatedText: string;
    loading: boolean;
  } | null>(null);
  const [ccCreateModal, setCcCreateModal] = useState(false);
  const [ccCreateInput, setCcCreateInput] = useState("");
  const [ccCreateStep, setCcCreateStep] = useState<"input" | "preview">("input");
  const [conceptGroups, setConceptGroups] = useState<ConceptGroupItem[]>([]);
  const [savedTranscripts, setSavedTranscripts] = useState<{ _id: string; videoId: string; videoTitle?: string; channel?: string }[]>([]);
  const [nuggets, setNuggets] = useState<{ _id: string; content: string; source?: string }[]>([]);
  const [nuggetFormOpen, setNuggetFormOpen] = useState<"selection" | "panel" | null>(null);
  const [nuggetFormPosition, setNuggetFormPosition] = useState<{ x: number; y: number } | null>(null);
  const [nuggetCreateContent, setNuggetCreateContent] = useState("");
  const [nuggetCreateSource, setNuggetCreateSource] = useState("");
  const [nuggetCreateLoading, setNuggetCreateLoading] = useState(false);
  const [nuggetSuggestSourceLoading, setNuggetSuggestSourceLoading] = useState(false);
  const [nuggetImproveLoading, setNuggetImproveLoading] = useState(false);
  const [selectedTextForNugget, setSelectedTextForNugget] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ left: number; bottom: number } | null>(null);
  const [nuggetLearnId, setNuggetLearnId] = useState<string | null>(null);
  const [nuggetLearnExplanation, setNuggetLearnExplanation] = useState<string | null>(null);
  const [selectionLearnPopup, setSelectionLearnPopup] = useState<{ text: string; explanation: string | null; loading: boolean; x: number; y: number } | null>(null);
  const [cgDetailModal, setCgDetailModal] = useState<ConceptGroupItem | null>(null);
  const [cgCreateModal, setCgCreateModal] = useState(false);
  const [cgCreateStep, setCgCreateStep] = useState<1 | 2 | 3 | 4>(1);
  const [cgCreateDomain, setCgCreateDomain] = useState("");
  const [cgCreateQuestions, setCgCreateQuestions] = useState<string[]>([]);
  const [cgCreateAnswers, setCgCreateAnswers] = useState<Record<string, string>>({});
  const [cgCreateConcepts, setCgCreateConcepts] = useState<{ title: string; summary: string; enrichmentPrompt: string }[]>([]);
  const [cgCreateLoading, setCgCreateLoading] = useState(false);
  const [cgCreateSuccess, setCgCreateSuccess] = useState(false);
  const [cgDeleteConfirmModal, setCgDeleteConfirmModal] = useState<ConceptGroupItem | null>(null);
  const [transcriptModalTranscript, setTranscriptModalTranscript] = useState<{
    id: string;
    videoId: string;
    videoTitle?: string;
    channel?: string;
    transcriptText: string;
  } | null>(null);
  const [cgCustomCreateModal, setCgCustomCreateModal] = useState(false);
  const [cgCustomCreateTitle, setCgCustomCreateTitle] = useState("");
  const [cgCustomCreateSelectedIds, setCgCustomCreateSelectedIds] = useState<Set<string>>(new Set());
  const [cgCustomCreateLoading, setCgCustomCreateLoading] = useState(false);
  const [ccCreateDraft, setCcCreateDraft] = useState<{
    title: string;
    summary: string;
    enrichmentPrompt: string;
  } | null>(null);
  const [ccCreateGroupSuggestions, setCcCreateGroupSuggestions] = useState<{
    suggestedGroupIds: string[];
    suggestedNewGroupNames: string[];
  } | null>(null);
  const [ccCreateSelectedGroupIds, setCcCreateSelectedGroupIds] = useState<Set<string>>(new Set());
  const [ccCreateSelectedNewGroupNames, setCcCreateSelectedNewGroupNames] = useState<Set<string>>(new Set());
  const [ccCreateLoading, setCcCreateLoading] = useState(false);
  const [ccCreateSuccess, setCcCreateSuccess] = useState(false);
  const [ccYoutubeModal, setCcYoutubeModal] = useState(false);
  const [ccYoutubeUrl, setCcYoutubeUrl] = useState("");
  const [ccYoutubeExtractPrompt, setCcYoutubeExtractPrompt] = useState("");
  const [ccYoutubeTranscriptId, setCcYoutubeTranscriptId] = useState<string | null>(null);
  const [ccYoutubeLoading, setCcYoutubeLoading] = useState(false);
  const [ccYoutubeResult, setCcYoutubeResult] = useState<{
    videoTitle: string | null;
    channel: string | null;
    groups: { domain: string; concepts: { title: string; summary: string; enrichmentPrompt: string }[] }[];
  } | null>(null);
  const [ccYoutubeError, setCcYoutubeError] = useState<string | null>(null);
  const [ccAutoTagSuggestions, setCcAutoTagSuggestions] = useState<{
    suggestedGroupIds: string[];
    suggestedNewGroupNames: string[];
  } | null>(null);
  const [ccAutoTagLoading, setCcAutoTagLoading] = useState(false);
  const [ccTranslating, setCcTranslating] = useState(false);
  const [ccTranslatePopoverOpen, setCcTranslatePopoverOpen] = useState(false);
  const [deleteSessionConfirmModal, setDeleteSessionConfirmModal] = useState<Session | null>(null);
  const [goBackConfirmModal, setGoBackConfirmModal] = useState<{
    index: number;
    role: "user" | "assistant";
    content: string;
  } | null>(null);
  const [goBackLoading, setGoBackLoading] = useState(false);
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  const [visibleLetterModalTitleChars, setVisibleLetterModalTitleChars] = useState(0);
  const [letterModalTitleAnimating, setLetterModalTitleAnimating] = useState(false);
  const LETTER_SEEN_KEY = "fml-labs-letter-seen";
  const PERSPECTIVE_CARD_START_KEY = "fml-perspective-card-start";
  const ONBOARDING_COMPLETE_KEY = "fml-labs-onboarding-complete";
  const FEATURE_TOUR_COMPLETE_KEY = "fml-labs-feature-tour-complete";
  const FEATURE_TOUR_STEPS = [
    { target: "[data-tour=menu-button]", title: "Open the menu", content: "Tap here to access conversations, nuggets, concepts, mental models, long-term memory, and domains.", ringClass: "ring-white dark:ring-neutral-300" },
    { target: "[data-tour=sidebar-nav]", title: "Your library", content: "All your content in one place—let's explore each section.", ringClass: "ring-white dark:ring-neutral-300" },
    { target: "[data-tour=tour-conversations]", title: "Conversations", content: "Your chat history. Start new conversations, pick up where you left off, or search through past chats.", panel: "conversations", ringClass: "ring-white dark:ring-neutral-300" },
    { target: "[data-tour=tour-nuggets]", title: "Nuggets", content: "Save impactful quotes and snippets. Highlight text in conversations or paste from clipboard.", panel: "nuggets", ringClass: "ring-white dark:ring-neutral-300" },
    { target: "[data-tour=tour-cc]", title: "Concepts", content: "Your custom frameworks and values. The AI uses them to personalize responses.", panel: "cc", ringClass: "ring-white dark:ring-neutral-300" },
    { target: "[data-tour=tour-concepts]", title: "Mental Models", content: "Proven thinking frameworks and cognitive biases. Browse, search, and save your favorites.", panel: "concepts", ringClass: "ring-white dark:ring-neutral-300" },
    { target: "[data-tour=input-area]", title: "Ask anything", content: "Type your question here. Use / to search mental models and concepts. The AI uses them to help you think through decisions.", ringClass: "ring-white dark:ring-neutral-300" },
    { target: "[data-tour=settings-button]", title: "Customize", content: "Change language, voice style, playback speed, and more in settings.", ringClass: "ring-white dark:ring-neutral-300" },
  ] as const;
  const [onboardingStep, setOnboardingStep] = useState<0 | 1 | 2 | 3 | null>(null);
  const [featureTourStep, setFeatureTourStep] = useState<number | null>(null);
  const [signInFeaturesModalOpen, setSignInFeaturesModalOpen] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [conceptsLoaded, setConceptsLoaded] = useState(false);
  const [ltmLoaded, setLtmLoaded] = useState(false);
  const [ccLoaded, setCcLoaded] = useState(false);
  const [cgLoaded, setCgLoaded] = useState(false);
  const [mentalModelsLoaded, setMentalModelsLoaded] = useState(false);
  const leftPanelReady = isAnonymous
    ? mentalModelsLoaded
    : sessionsLoaded && conceptsLoaded && ltmLoaded && ccLoaded && cgLoaded && mentalModelsLoaded;
  const signInFeatures = [
    { label: "Saved conversations", description: "Access your full chat history across devices. Pick up where you left off.", icon: "chat" },
    { label: "Nuggets", description: "Save impactful quotes, words, and snippets. Paste from clipboard or highlight text in conversations.", icon: "nuggets" },
    { label: "Custom concepts", description: "Define your own frameworks, values, or principles. The AI uses them to personalize responses.", icon: "concepts" },
    { label: "Mental models library", description: "Explore proven mental models and cognitive biases to improve thinking and decisions.", icon: "mental-models" },
    { label: "Long-term memory", description: "The AI remembers key context from past conversations to give more relevant advice.", icon: "memory" },
    { label: "Domains", description: "Group related concepts into domains (e.g. career, health). The AI draws from them when relevant.", icon: "domains" },
    { label: "Voice (speech to text + text to speech)", description: "Use your voice to ask questions and listen to AI responses with natural playback.", icon: "voice" },
    { label: "Summarize and collapse", description: "Collapse long chats into compact summaries and keep key insights easy to revisit.", icon: "summary" },
    { label: "Incognito mode", description: "Chat privately without saving to history. Conversations stay off the record.", icon: "ghost" },
  ];
  const signInFeatureIconSvg = (name: string) => {
    if (name === "chat") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    if (name === "nuggets") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>;
    if (name === "concepts") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /><path d="M12 3v18" /></svg>;
    if (name === "mental-models") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M12 3v3" /><path d="M7.5 5.5 9.5 8" /><path d="m16.5 5.5-2 2.5" /><path d="M4 13a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /></svg>;
    if (name === "memory") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z" /><path d="M12 6v6l4 2" /></svg>;
    if (name === "domains") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></svg>;
    if (name === "voice") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M19 11v1a7 7 0 0 1-14 0v-1" /><path d="M12 19v3" /></svg>;
    if (name === "summary") return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0"><path d="M4 5h16" /><path d="M4 10h16" /><path d="M4 15h10" /><path d="M4 20h7" /></svg>;
    return <GhostIcon className="w-4 h-4 shrink-0" />;
  };
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (incognitoMode) {
      setOnboardingStep(null);
      return;
    }
    // Skip welcome/onboarding - go directly to chat
    try {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch {
      /* ignore */
    }
    setOnboardingStep(null);
  }, [incognitoMode]);

  // Auto-show feature tour for first-time users or users with no data (after signing in)
  useEffect(() => {
    if (typeof window === "undefined" || isAnonymous || incognitoMode) return;
    if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) !== "true") return;
    if (localStorage.getItem(FEATURE_TOUR_COMPLETE_KEY) === "true") return;
    if (!leftPanelReady) return;
    const hasNoData =
      sessions.length === 0 &&
      nuggets.length === 0 &&
      customConcepts.length === 0 &&
      longTermMemories.length === 0 &&
      conceptGroups.length === 0;
    if (!hasNoData) return;
    const timer = setTimeout(() => setFeatureTourStep(0), 800);
    return () => clearTimeout(timer);
  }, [isAnonymous, incognitoMode, leftPanelReady, sessions.length, nuggets.length, customConcepts.length, longTermMemories.length, conceptGroups.length]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const selectionBubblesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const inputExpandInputRef = useRef<HTMLDivElement>(null);
  const [inputExpandModalOpen, setInputExpandModalOpen] = useState(false);
  const justCreatedSessionRef = useRef<string | null>(null);
  const anonymousActiveRef = useRef(false);
  const ccAutoTagPopoverRef = useRef<HTMLDivElement>(null);
  const ccTranslatePopoverRef = useRef<HTMLDivElement>(null);
  const ccAutoTagSuggestionsRef = useRef(ccAutoTagSuggestions);
  const profileTriggerRef = useRef<HTMLDivElement>(null);
  ccAutoTagSuggestionsRef.current = ccAutoTagSuggestions;
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollToBottom(false);
  }, []);

  const checkSelection = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString()?.trim();
    if (!text || text.length < 2) {
      setSelectedTextForNugget(null);
      setSelectionRect(null);
      return;
    }
    const container = messagesContainerRef.current;
    if (!container || !sel?.anchorNode || !container.contains(sel.anchorNode)) {
      setSelectedTextForNugget(null);
      setSelectionRect(null);
      return;
    }
    try {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelectionRect({ left: rect.left, bottom: rect.bottom });
      setSelectedTextForNugget(text);
    } catch {
      setSelectionRect(null);
      setSelectedTextForNugget(null);
    }
  }, []);

  // selectionchange is more reliable on mobile than touchend; debounce to wait for selection to stabilize
  useEffect(() => {
    if (isAnonymous) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      const text = sel?.toString()?.trim();
      if (!text) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setSelectedTextForNugget(null);
        setSelectionRect(null);
        return;
      }
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        checkSelection();
      }, 300);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAnonymous, checkSelection]);

  useEffect(() => {
    if (isAnonymous && !isNew) {
      router.replace("/chat/new");
    }
  }, [isAnonymous, isNew, router]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const check = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atBottom = scrollHeight - scrollTop - clientHeight < 80;
      setShowScrollToBottom((prev) => (atBottom ? false : true));
    };
    el.addEventListener("scroll", check, { passive: true });
    check(); // Initial check
    return () => el.removeEventListener("scroll", check);
  }, [messages, currentSession?.isCollapsed]);

  useEffect(() => {
    if (!ltmDetailModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLtmDetailModal(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [ltmDetailModal]);

  useEffect(() => {
    if (!letterModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLetterModalOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [letterModalOpen]);

  useEffect(() => {
    if (!letterModalOpen) {
      setVisibleLetterModalTitleChars(0);
      setLetterModalTitleAnimating(false);
      return;
    }

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleLetterModalTitleChars(LETTER_MODAL_TITLE.length);
      setLetterModalTitleAnimating(false);
      return;
    }

    setVisibleLetterModalTitleChars(0);
    setLetterModalTitleAnimating(true);

    const timeouts = Array.from(LETTER_MODAL_TITLE).map((_, index) =>
      window.setTimeout(() => {
        setVisibleLetterModalTitleChars(index + 1);
        if (index === LETTER_MODAL_TITLE.length - 1) {
          setLetterModalTitleAnimating(false);
        }
      }, 120 + index * 65)
    );

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [letterModalOpen]);

  useEffect(() => {
    if (!deleteSessionConfirmModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteSessionConfirmModal(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [deleteSessionConfirmModal]);

  useEffect(() => {
    if (goBackConfirmModal === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGoBackConfirmModal(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [goBackConfirmModal]);

  useEffect(() => {
    if (!ccDetailModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (ccAutoTagSuggestionsRef.current) {
          setCcAutoTagSuggestions(null);
        } else if (ccTranslatePopoverOpen) {
          setCcTranslatePopoverOpen(false);
        } else {
          setCcDetailModal(null);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [ccDetailModal, ccTranslatePopoverOpen]);

  useEffect(() => {
    if (!ltmDetailModal && generateModal?.type === "ltm") setGenerateModal(null);
  }, [ltmDetailModal, generateModal?.type]);

  useEffect(() => {
    if (!ccDetailModal && generateModal?.type === "cc") setGenerateModal(null);
  }, [ccDetailModal, generateModal?.type]);

  // Dismiss banner when user hasn't started chatting yet (no messages).
  // This ensures we don't show the banner after they send their first message
  // in a new conversation—the new language/voice already applies.
  useEffect(() => {
    if (messages.length === 0) {
      dismissLanguageChangeBanner();
      dismissUserTypeChangeBanner();
    }
  }, [
    messages.length,
    showLanguageChangeBanner,
    showUserTypeChangeBanner,
    dismissLanguageChangeBanner,
    dismissUserTypeChangeBanner,
  ]);

  useEffect(() => {
    if (!ccAutoTagSuggestions) return;
    const handler = (e: MouseEvent) => {
      const el = ccAutoTagPopoverRef.current;
      if (el && !el.contains(e.target as Node)) setCcAutoTagSuggestions(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ccAutoTagSuggestions]);

  useEffect(() => {
    if (!ccTranslatePopoverOpen) return;
    const handler = (e: MouseEvent) => {
      const el = ccTranslatePopoverRef.current;
      if (el && !el.contains(e.target as Node)) setCcTranslatePopoverOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ccTranslatePopoverOpen]);

  useEffect(() => {
    if (!cgDetailModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (ccDetailModal) {
          setCcDetailModal(null);
        } else {
          setCgDetailModal(null);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cgDetailModal, ccDetailModal]);

  useEffect(() => {
    if (!cgCustomCreateModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!cgCustomCreateLoading) {
          setCgCustomCreateModal(false);
          setCgCustomCreateTitle("");
          setCgCustomCreateSelectedIds(new Set());
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cgCustomCreateModal, cgCustomCreateLoading]);

  const [savedConcepts, setSavedConcepts] = useState<
    { modelId: string }[]
  >([]);

  const refetchSessions = useCallback(() => {
    if (isAnonymous) {
      setSessions([]);
      setSessionsLoaded(true);
      return;
    }
    fetch(`/api/sessions?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setSessionsLoaded(true));
  }, [isAnonymous]);

  const refetchSavedConcepts = useCallback(() => {
    if (isAnonymous) {
      setSavedConcepts([]);
      setConceptsLoaded(true);
      return;
    }
    fetch("/api/me/concepts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) =>
        setSavedConcepts(Array.isArray(data) ? data : [])
      )
      .catch(() => setSavedConcepts([]))
      .finally(() => setConceptsLoaded(true));
  }, [isAnonymous]);

  const removeConcept = useCallback(
    async (modelId: string) => {
      try {
        const res = await fetch(`/api/me/concepts/${modelId}`, {
          method: "DELETE",
        });
        if (res.ok) refetchSavedConcepts();
      } catch {
        /* ignore */
      }
    },
    [refetchSavedConcepts]
  );

  const refetchLongTermMemories = useCallback(() => {
    if (isAnonymous) {
      setLongTermMemories([]);
      setLtmLoaded(true);
      return;
    }
    fetch("/api/me/long-term-memory", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setLongTermMemories(Array.isArray(data) ? data : []))
      .catch(() => setLongTermMemories([]))
      .finally(() => setLtmLoaded(true));
  }, [isAnonymous]);

  const refetchCustomConcepts = useCallback(() => {
    if (isAnonymous) {
      setCustomConcepts([]);
      setCcLoaded(true);
      return;
    }
    fetch("/api/me/custom-concepts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setCustomConcepts(Array.isArray(data) ? data : []))
      .catch(() => setCustomConcepts([]))
      .finally(() => setCcLoaded(true));
  }, [isAnonymous]);

  const refetchConceptGroups = useCallback(() => {
    if (isAnonymous) {
      setConceptGroups([]);
      setCgLoaded(true);
      return;
    }
    fetch("/api/me/concept-groups", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setConceptGroups(Array.isArray(data) ? data : []))
      .catch(() => setConceptGroups([]))
      .finally(() => setCgLoaded(true));
  }, [isAnonymous]);

  const refetchTranscripts = useCallback(() => {
    if (isAnonymous) {
      setSavedTranscripts([]);
      return;
    }
    fetch("/api/me/transcripts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setSavedTranscripts(Array.isArray(data) ? data : []))
      .catch(() => setSavedTranscripts([]));
  }, [isAnonymous]);

  const refetchNuggets = useCallback(() => {
    if (isAnonymous) {
      setNuggets([]);
      return;
    }
    fetch("/api/me/nuggets", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setNuggets(Array.isArray(data) ? data : []))
      .catch(() => setNuggets([]));
  }, [isAnonymous]);

  const [mentalModelsIndex, setMentalModelsIndex] = useState<
    Map<string, string>
  >(new Map());

  useEffect(() => {
    refetchSessions();
  }, [refetchSessions]);

  // Letter modal: only show when user clicks "Crafted with Intention" (no longer auto-show for first-time; that's now in onboarding step 3)

  useEffect(() => {
    refetchSavedConcepts();
  }, [refetchSavedConcepts]);

  useEffect(() => {
    refetchLongTermMemories();
  }, [refetchLongTermMemories]);

  useEffect(() => {
    refetchCustomConcepts();
  }, [refetchCustomConcepts]);

  useEffect(() => {
    refetchConceptGroups();
  }, [refetchConceptGroups]);

  useEffect(() => {
    if (isAnonymous && !isNew) {
      setSessionLoading(false);
      return;
    }
    if (incognitoMode) {
      setSessionLoading(false);
      return;
    }
    if (!isNew && sessionId && sessionId !== "new" && sessionId !== "incognito" && leftPanelReady) {
      // Skip fetch when we just created this session and streamed the response.
      // Fetching would overwrite our streamed messages and cause a visible refresh.
      if (justCreatedSessionRef.current === sessionId) {
        return;
      }
      justCreatedSessionRef.current = null; // clear before fetching a different session
      setSessionLoading(true);
      fetch(`/api/sessions/${sessionId}`)
        .then((r) => {
          if (!r.ok) throw new Error("Not found");
          return r.json();
        })
        .then(({ session, messages: msgs, longTermMemory }) => {
          setCurrentSessionId(session._id);
          setCurrentSession(session);
          setMessages(processMessagesWithContext(msgs || []));
          setCollapsedSummary(session.isCollapsed && longTermMemory ? longTermMemory : null);
        })
        .catch(() => {
          router.push("/chat/new");
        })
        .finally(() => setSessionLoading(false));
    } else if (isNew || isAnonymous || incognitoMode) {
      setSessionLoading(false);
      // Check for perspective card "Start conversation" — opens in new conversation
      if (typeof window !== "undefined" && isNew && !incognitoMode) {
        try {
          const stored = sessionStorage.getItem(PERSPECTIVE_CARD_START_KEY);
          if (stored) {
            sessionStorage.removeItem(PERSPECTIVE_CARD_START_KEY);
            const { assistantContent, prompt, name } = JSON.parse(stored) as {
              assistantContent: string;
              prompt: string;
              name: string;
            };
            setMessages([{
              role: "assistant",
              content: assistantContent,
              perspectiveCard: { name, prompt },
            }]);
            setPendingCardContext({ prompt, name });
            setCurrentSessionId(null);
            setCurrentSession(null);
            setCollapsedSummary(null);
            return;
          }
        } catch {
          /* ignore */
        }
      }
      // Don't clear when we're streaming a response from a just-created session
      // (e.g. user selected a phrase from the carousel). Clearing would wipe the UI.
      // For anonymous users, we never set justCreatedSessionRef, so use anonymousActiveRef.
      const hasActiveConversation =
        justCreatedSessionRef.current || (isAnonymous && anonymousActiveRef.current);
      if (!(isNew && hasActiveConversation)) {
        setMessages([]);
        setCurrentSessionId(null);
        setCurrentSession(null);
        setCollapsedSummary(null);
        anonymousActiveRef.current = false;
      }
    }
  }, [sessionId, isNew, isAnonymous, incognitoMode, router, leftPanelReady]);

  const [lastFailedUserMessage, setLastFailedUserMessage] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(true);
  const [pendingCardContext, setPendingCardContext] = useState<{
    prompt: string;
    name: string;
  } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnboardingDismissed(!!localStorage.getItem("and-then-what-onboarding-seen"));
  }, []);

  const dismissOnboarding = useCallback(() => {
    try {
      localStorage.setItem("and-then-what-onboarding-seen", "true");
    } catch {
      /* ignore */
    }
    setOnboardingDismissed(true);
  }, []);

  const sendMessage = useCallback(async (overrideText?: string, options?: { retry?: boolean; messagesOverride?: Message[]; activeCardPrompt?: string; activeCardName?: string }) => {
    const rawText = (overrideText ?? input).trim();
    if (!rawText || isLoading) return;
    playSelectionChime();

    if (isAnonymous) anonymousActiveRef.current = true;

    const cardCtx = pendingCardContext ?? (options?.activeCardPrompt && options?.activeCardName ? { prompt: options.activeCardPrompt, name: options.activeCardName } : null);
    if (cardCtx) setPendingCardContext(null);

    const {
      cleanedMessage,
      mentionedMentalModelIds,
      mentionedLongTermMemoryIds,
      mentionedCustomConceptIds,
      mentionedConceptGroupIds,
    } = parseMentionsFromMessage(rawText, {
      idToName: mentalModelsIndex,
      ltmIdToTitle: new Map(longTermMemories.map((ltm) => [ltm._id, ltm.title])),
      ccIdToTitle: new Map(customConcepts.map((cc) => [cc._id, cc.title])),
      cgIdToTitle: new Map(conceptGroups.map((cg) => [cg._id, cg.title])),
    });
    const messageToSend =
      cleanedMessage ||
      (mentionedMentalModelIds.length > 0 || mentionedLongTermMemoryIds.length > 0 || mentionedCustomConceptIds.length > 0 || mentionedConceptGroupIds.length > 0
        ? "Please help me think through this."
        : rawText);
    const displayContent = cleanedMessage || messageToSend;

    if (messages.length === 0 && sessions.length === 0) {
      dismissOnboarding();
    }
    setInput("");
    setIsLoading(true);
    setLastFailedUserMessage(null);

    const userMessage: Message = {
      role: "user",
      content: rawText,
      ...(!cardCtx && options?.activeCardPrompt &&
        options?.activeCardName && {
          perspectiveCard: {
            name: options.activeCardName,
            prompt: options.activeCardPrompt,
          },
        }),
    };
    const assistantMessage: Message = { role: "assistant", content: "" };
    const baseMessages = options?.messagesOverride ?? messages;
    setMessages((prev) =>
      options?.retry ? [...prev.slice(0, -2), userMessage, assistantMessage] : options?.messagesOverride ? [...options.messagesOverride, userMessage, assistantMessage] : [...prev, userMessage, assistantMessage]
    );

    let sid = currentSessionId;
    let didCreateSession = false;
    if (!sid && !isAnonymous && !incognitoMode) {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: messageToSend.slice(0, 50) }),
      });
      const newSession = await res.json();
      sid = newSession._id;
      justCreatedSessionRef.current = sid;
      didCreateSession = true;
      setCurrentSessionId(sid);
      setCurrentSession({ ...newSession, isCollapsed: false, updatedAt: new Date().toISOString() });
      setSessions((prev) => [{ ...newSession, updatedAt: new Date().toISOString() }, ...prev]);
      // Defer navigation until after chat completes - navigating mid-stream can unmount
      // the component and abort the fetch before the LLM responds.
    }

    const chatBody: Record<string, unknown> = {
      message: messageToSend,
      rawMessage: rawText,
      mentionedMentalModelIds,
      mentionedLongTermMemoryIds,
      mentionedCustomConceptIds,
      mentionedConceptGroupIds,
      language: languageRef.current,
      userType: userTypeRef.current,
    };
    if (cardCtx) {
      chatBody.activeCardPrompt = cardCtx.prompt;
      chatBody.activeCardName = cardCtx.name;
      if (!isAnonymous && !incognitoMode) {
        chatBody.prependMessages = [{ role: "assistant", content: `Let me invite you to look through this lens:\n\n${cardCtx.prompt}\n\nWhat comes to mind?` }];
      }
    } else if (options?.activeCardPrompt) {
      chatBody.activeCardPrompt = options.activeCardPrompt;
      if (options?.activeCardName) chatBody.activeCardName = options.activeCardName;
    }
    if (isAnonymous || incognitoMode) {
      chatBody.messages = baseMessages.map((m) => ({ role: m.role, content: m.content }));
      if (incognitoMode) chatBody.incognito = true;
    } else {
      chatBody.sessionId = sid ?? undefined;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatBody),
      });

      if (!res.ok) throw new Error("Failed to send");
      if (!res.body) throw new Error("No body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let messageContent = "";
      let contextBlockConsumed = false;
      let overlayContext: RelevantContext | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        if (!contextBlockConsumed) {
          const parsed = parseRelevantContextFromStreamStart(accumulated);
          if (parsed.relevantContext !== null) {
            contextBlockConsumed = true;
            overlayContext = parsed.relevantContext;
            messageContent = parsed.contentWithoutBlock;
            accumulated = parsed.contentWithoutBlock;
          }
        } else {
          messageContent = accumulated;
        }

        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content: contextBlockConsumed ? messageContent : "" };
          }
          return next;
        });
      }

      const { contentWithoutBlock, relevantContext } = contextBlockConsumed
        ? { contentWithoutBlock: messageContent, relevantContext: overlayContext ?? undefined }
        : parseRelevantContextBlock(accumulated);
          const resolvedContext =
        relevantContext ??
        (() => {
          const extractedIds = extractMentalModelIds(contentWithoutBlock);
          return {
            mentalModels: extractedIds.map((id) => ({ id, reason: "" })),
            longTermMemories: [] as RelevantContextItem[],
            customConcepts: [] as RelevantContextItem[],
            conceptGroups: [] as RelevantContextItem[],
            perspectiveCards: [] as RelevantContextItem[],
          };
        })();
      setMessages((prev) => {
        const next = [...prev];
        const lastAssistantIdx = next.findLastIndex(
          (m) => m.role === "assistant"
        );
        if (lastAssistantIdx >= 0) {
          next[lastAssistantIdx] = {
            ...next[lastAssistantIdx],
            content: contentWithoutBlock,
            selectedContexts: {
              mentalModels: resolvedContext.mentalModels,
              longTermMemories: resolvedContext.longTermMemories,
              customConcepts: resolvedContext.customConcepts ?? [],
              conceptGroups: resolvedContext.conceptGroups ?? [],
              perspectiveCards: resolvedContext.perspectiveCards ?? [],
            },
          };
        }
        return next;
      });
    } catch (err) {
      setLastFailedUserMessage(rawText);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            content: "Something went wrong.",
          };
        }
        return next;
      });
    } finally {
      // Don't navigate when creating a session from carousel - router.replace and
      // history.replaceState were causing the page to reset to the empty state.
      // We stay on /chat/new; the session appears in the sidebar for the user to click.
      setIsLoading(false);
      inputRef.current?.focus();
      refetchSessions();
    }
  }, [input, isLoading, currentSessionId, router, refetchSessions, messages, messages.length, sessions.length, dismissOnboarding, mentalModelsIndex, longTermMemories, customConcepts, conceptGroups, isAnonymous, incognitoMode, pendingCardContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (
      (e.key === "Enter" && !e.shiftKey) ||
      (e.metaKey && e.key === "Enter") ||
      (e.ctrlKey && e.key === "Enter")
    ) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (inputExpandModalOpen) {
      const t = setTimeout(() => inputExpandInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [inputExpandModalOpen]);

  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      const selectedText = selection?.toString() ?? "";
      if (!selectedText || !e.clipboardData) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", selectedText);
    };
    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isAnonymous) return;
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && (e.key === "|" || e.key === "\\")) {
        e.preventDefault();
        router.push("/chat/incognito");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, isAnonymous]);

  const [sidebarOpen, setSidebarOpenState] = useState(false);
  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
  }, []);

  const [libraryPanelOpen, setLibraryPanelOpen] = useState<"conversations" | "ltm" | "concepts" | "cc" | "cg" | "nuggets" | "decks" | null>(null);
  const [waysOfLookingAtModalOpen, setWaysOfLookingAtModalOpen] = useState(false);
  const [waysOfLookingAtDrawMode, setWaysOfLookingAtDrawMode] = useState(false);
  const [waysOfLookingAtCategory, setWaysOfLookingAtCategory] = useState<string | null>(null);
  const [waysOfLookingAtCity, setWaysOfLookingAtCity] = useState<string | null>(null);
  const [waysOfLookingAtCuisine, setWaysOfLookingAtCuisine] = useState<string | null>(null);
  const [waysOfLookingAtMicrocosm, setWaysOfLookingAtMicrocosm] = useState<string | null>(null);
  const [waysOfLookingAtHuman, setWaysOfLookingAtHuman] = useState<string | null>(null);
  const [waysOfLookingAtDigital, setWaysOfLookingAtDigital] = useState<string | null>(null);
  const [waysOfLookingAtCards, setWaysOfLookingAtCards] = useState<{ id: string; name: string; prompt: string; follow_ups?: string[] }[] | null>(null);
  const [waysOfLookingAtCardsLoading, setWaysOfLookingAtCardsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [deleteAllDataModalOpen, setDeleteAllDataModalOpen] = useState(false);
  const [deleteAllDataConfirmInput, setDeleteAllDataConfirmInput] = useState("");
  const [deleteAllDataLoading, setDeleteAllDataLoading] = useState(false);
  const [conversationsCollapsed, setConversationsCollapsed] = useState(false);
  const [selectedMentalModel, setSelectedMentalModel] =
    useState<MentalModel | null>(null);
  const [drawnPerspectiveCard, setDrawnPerspectiveCard] = useState<{
    card: { id: string; name: string; prompt: string; follow_ups?: string[] };
    deckId: string;
    deckName: string;
  } | null>(null);
  const [overachieverMessage, setOverachieverMessage] = useState<string | null>(
    null
  );
  const [isSafari, setIsSafari] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const selectedExportSections = EXPORT_DATA_SECTION_OPTIONS
    .filter(({ key }) => exportSelections[key])
    .map(({ key }) => key);
  const allExportSectionsSelected = selectedExportSections.length === EXPORT_DATA_SECTION_OPTIONS.length;
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsSafari(/safari/i.test(navigator.userAgent) && !/chrome|crios/i.test(navigator.userAgent));
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("fmllabs-weather-format");
      if (stored === "condition-temp" || stored === "emoji-temp" || stored === "temp-only") {
        setWeatherFormat(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch("/api/me/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.weatherFormat === "condition-temp" || data?.weatherFormat === "emoji-temp" || data?.weatherFormat === "temp-only") {
          setWeatherFormat(data.weatherFormat);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateWeatherFormat = useCallback(
    (next: WeatherFormat) => {
      setWeatherFormat(next);
      try {
        localStorage.setItem("fmllabs-weather-format", next);
      } catch {
        /* ignore */
      }
      if (userId) {
        fetch("/api/me/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weatherFormat: next }),
        }).catch(() => {});
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!libraryPanelOpen && !selectedMentalModel && !drawnPerspectiveCard && !waysOfLookingAtModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (drawnPerspectiveCard) setDrawnPerspectiveCard(null);
        else if (waysOfLookingAtModalOpen) {
          if (waysOfLookingAtDigital) setWaysOfLookingAtDigital(null);
          else if (waysOfLookingAtHuman) setWaysOfLookingAtHuman(null);
          else if (waysOfLookingAtMicrocosm) setWaysOfLookingAtMicrocosm(null);
          else if (waysOfLookingAtCuisine) setWaysOfLookingAtCuisine(null);
          else if (waysOfLookingAtCity) setWaysOfLookingAtCity(null);
          else if (waysOfLookingAtCategory) setWaysOfLookingAtCategory(null);
          else { setWaysOfLookingAtModalOpen(false); setWaysOfLookingAtDrawMode(false); }
        } else if (selectedMentalModel) setSelectedMentalModel(null);
        else if (libraryPanelOpen) setLibraryPanelOpen(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [libraryPanelOpen, selectedMentalModel, drawnPerspectiveCard, waysOfLookingAtModalOpen, waysOfLookingAtCategory, waysOfLookingAtCity, waysOfLookingAtCuisine, waysOfLookingAtMicrocosm, waysOfLookingAtHuman, waysOfLookingAtDigital]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) {
      if (voiceCloneRecording) {
        voiceCloneClosingRef.current = true;
        voiceCloneMediaRecorderRef.current?.stop();
        setVoiceCloneRecording(false);
      }
      setVoiceCloneRecordedBlob(null);
    } else {
      voiceCloneClosingRef.current = false;
    }
  }, [settingsOpen, voiceCloneRecording]);

  useEffect(() => {
    if (!feedbackModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFeedbackModalOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [feedbackModalOpen]);

  // Random feedback prompt for logged-in users (3% chance, cooldown 7 days)
  const FEEDBACK_PROMPT_KEY = "fml-labs-feedback-prompt-at";
  const FEEDBACK_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  useEffect(() => {
    if (typeof window === "undefined" || isAnonymous || !user) return;
    const lastShown = localStorage.getItem(FEEDBACK_PROMPT_KEY);
    const lastShownMs = lastShown ? parseInt(lastShown, 10) : 0;
    if (Date.now() - lastShownMs < FEEDBACK_PROMPT_COOLDOWN_MS) return;
    const timer = setTimeout(() => {
      if (Math.random() < 0.03) {
        setFeedbackModalOpen(true);
        localStorage.setItem(FEEDBACK_PROMPT_KEY, String(Date.now()));
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isAnonymous, user]);

  useEffect(() => {
    if (libraryPanelOpen === "cg") refetchTranscripts();
  }, [libraryPanelOpen, refetchTranscripts]);

  useEffect(() => {
    if (libraryPanelOpen === "nuggets") refetchNuggets();
  }, [libraryPanelOpen, refetchNuggets]);

  useEffect(() => {
    if (waysOfLookingAtModalOpen) {
      fetch("/api/perspective-decks")
        .then((r) => r.json())
        .then((list: { id: string; name: string; description: string; domain: string }[]) => {
          setPerspectiveDecks(Array.isArray(list) ? list : []);
        })
        .catch(() => setPerspectiveDecks([]));
    }
  }, [waysOfLookingAtModalOpen]);

  const urbanJungleCityToDeckId: Record<string, string> = {
    ny: "urban_jungle_new_york",
    sf: "urban_jungle_san_francisco",
    london: "urban_jungle_london",
    paris: "urban_jungle_paris",
    blr: "urban_jungle_bangalore",
  };

  const culinaryLabCuisineToDeckId: Record<string, string> = {
    indian: "culinary_lab_indian",
    italian: "culinary_lab_italian",
    pizza: "culinary_lab_pizza",
    chinese: "culinary_lab_chinese",
    sushi: "culinary_lab_sushi",
  };

  const culinaryLabCuisineToName: Record<string, string> = {
    indian: "Indian",
    italian: "Italian",
    pizza: "Pizza",
    chinese: "Chinese",
    sushi: "Sushi",
  };

  const naturalMicrocosmSubToDeckId: Record<string, string> = {
    forest_floor: "natural_microcosm_forest_floor",
    garden_backyard: "natural_microcosm_garden_backyard",
    rocks_stones: "natural_microcosm_rocks_stones",
    pond_puddle: "natural_microcosm_pond_puddle",
    insect_territories: "natural_microcosm_insect_territories",
  };

  const naturalMicrocosmSubToName: Record<string, string> = {
    forest_floor: "Forest Floor",
    garden_backyard: "Garden & Backyard",
    rocks_stones: "Rocks & Stones",
    pond_puddle: "Pond & Puddle",
    insect_territories: "Insect Territories",
  };

  const humanInterfaceSubToDeckId: Record<string, string> = {
    coffee_shop: "human_interface_coffee_shop",
    transit_hub: "human_interface_transit_hub",
    workplace: "human_interface_workplace",
    retail: "human_interface_retail",
    public_space: "human_interface_public_space",
  };

  const humanInterfaceSubToName: Record<string, string> = {
    coffee_shop: "Coffee Shop",
    transit_hub: "Transit Hub",
    workplace: "Workplace",
    retail: "Retail",
    public_space: "Public Space",
  };

  const digitalGhostSubToDeckId: Record<string, string> = {
    buttons_controls: "digital_ghost_buttons_controls",
    loading_states: "digital_ghost_loading_states",
    error_edge: "digital_ghost_error_edge",
    data_storage: "digital_ghost_data_storage",
    onboarding_flow: "digital_ghost_onboarding_flow",
  };

  const digitalGhostSubToName: Record<string, string> = {
    buttons_controls: "Buttons & Controls",
    loading_states: "Loading States",
    error_edge: "Error & Edge",
    data_storage: "Data & Storage",
    onboarding_flow: "Onboarding & Flow",
  };

  const domainDisplayName: Record<string, string> = {
    urban_jungle: "Urban Jungle",
    culinary_lab: "Culinary Lab",
    natural_microcosm: "Natural Microcosm",
    human_interface: "The Human Interface",
    digital_ghost: "Digital Ghost",
    art: "Ways of Looking at Art",
  };

  const closeAllModalsExceptLeftPanel = useCallback(() => {
    setWaysOfLookingAtModalOpen(false);
    setWaysOfLookingAtDrawMode(false);
    setWaysOfLookingAtCategory(null);
    setWaysOfLookingAtCity(null);
    setWaysOfLookingAtCuisine(null);
    setWaysOfLookingAtMicrocosm(null);
    setWaysOfLookingAtHuman(null);
    setWaysOfLookingAtDigital(null);
    setDrawnPerspectiveCard(null);
    setSelectedMentalModel(null);
    setLetterModalOpen(false);
    setSignInFeaturesModalOpen(false);
    setInputExpandModalOpen(false);
    setFeedbackModalOpen(false);
    setDeleteAllDataModalOpen(false);
    setMmCreateModalOpen(false);
    setDeleteSessionConfirmModal(null);
    setLtmDeleteConfirmModal(null);
    setCcDeleteConfirmModal(null);
    setCgDeleteConfirmModal(null);
    setGoBackConfirmModal(null);
  }, []);

  useEffect(() => {
    if (!waysOfLookingAtCategory) {
      setWaysOfLookingAtCards(null);
      return;
    }
    const isUrbanJungle = waysOfLookingAtCategory === "urban_jungle";
    const isCulinaryLab = waysOfLookingAtCategory === "culinary_lab";
    if (isUrbanJungle && !waysOfLookingAtCity) {
      setWaysOfLookingAtCards(null);
      return;
    }
    if (isCulinaryLab && !waysOfLookingAtCuisine) {
      setWaysOfLookingAtCards(null);
      return;
    }
    const isNaturalMicrocosm = waysOfLookingAtCategory === "natural_microcosm";
    if (isNaturalMicrocosm && !waysOfLookingAtMicrocosm) {
      setWaysOfLookingAtCards(null);
      return;
    }
    const isHumanInterface = waysOfLookingAtCategory === "human_interface";
    if (isHumanInterface && !waysOfLookingAtHuman) {
      setWaysOfLookingAtCards(null);
      return;
    }
    const isDigitalGhost = waysOfLookingAtCategory === "digital_ghost";
    if (isDigitalGhost && !waysOfLookingAtDigital) {
      setWaysOfLookingAtCards(null);
      return;
    }
    setWaysOfLookingAtCardsLoading(true);
    const deckId = isUrbanJungle && waysOfLookingAtCity
      ? urbanJungleCityToDeckId[waysOfLookingAtCity]
      : isCulinaryLab && waysOfLookingAtCuisine
        ? culinaryLabCuisineToDeckId[waysOfLookingAtCuisine]
        : isNaturalMicrocosm && waysOfLookingAtMicrocosm
          ? naturalMicrocosmSubToDeckId[waysOfLookingAtMicrocosm]
          : isHumanInterface && waysOfLookingAtHuman
            ? humanInterfaceSubToDeckId[waysOfLookingAtHuman]
            : isDigitalGhost && waysOfLookingAtDigital
              ? digitalGhostSubToDeckId[waysOfLookingAtDigital]
              : null;
    if (deckId) {
      fetch(`/api/perspective-decks/${deckId}`)
        .then((r) => r.json())
        .then((data) => setWaysOfLookingAtCards(Array.isArray(data?.cards) ? data.cards : []))
        .catch(() => setWaysOfLookingAtCards([]))
        .finally(() => setWaysOfLookingAtCardsLoading(false));
    } else {
      fetch("/api/perspective-decks")
        .then((r) => r.json())
        .then(async (list: { id: string; name: string; description: string; domain: string }[]) => {
          const deck = Array.isArray(list) ? list.find((d) => (d.domain || "").toLowerCase() === waysOfLookingAtCategory) : null;
          if (!deck?.id) {
            setWaysOfLookingAtCards([]);
            return;
          }
          const res = await fetch(`/api/perspective-decks/${deck.id}`);
          const data = await res.json();
          setWaysOfLookingAtCards(Array.isArray(data?.cards) ? data.cards : []);
        })
        .catch(() => setWaysOfLookingAtCards([]))
        .finally(() => setWaysOfLookingAtCardsLoading(false));
    }
  }, [waysOfLookingAtCategory, waysOfLookingAtCity, waysOfLookingAtCuisine, waysOfLookingAtMicrocosm, waysOfLookingAtHuman, waysOfLookingAtDigital]);

  useEffect(() => {
    const clearSelectionBubbles = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (selectionBubblesRef.current?.contains(target)) return;
      if (selectedTextForNugget || selectionRect) {
        setSelectedTextForNugget(null);
        setSelectionRect(null);
      }
    };
    document.addEventListener("mousedown", clearSelectionBubbles);
    document.addEventListener("touchstart", clearSelectionBubbles, { passive: true });
    return () => {
      document.removeEventListener("mousedown", clearSelectionBubbles);
      document.removeEventListener("touchstart", clearSelectionBubbles);
    };
  }, [selectedTextForNugget, selectionRect]);

  const [teachMeLoading, setTeachMeLoading] = useState(false);
  const [perspectiveDecks, setPerspectiveDecks] = useState<{ id: string; name: string; description: string; domain: string }[]>([]);
  const handleTeachMeClick = useCallback(async () => {
    setOverachieverMessage(null);
    setTeachMeLoading(true);
    try {
      const res = await fetch(`/api/mental-models/random?language=${language}`);
      const data = await res.json();
      if (data.overachiever && data.message) {
        setOverachieverMessage(data.message);
      } else if (data.id) {
        setRelevanceContext(null);
        const img = typeof window !== "undefined" ? new window.Image() : null;
        if (img && !data.id.startsWith("custom_")) img.src = `/images/${data.id.replace(/_/g, "-")}.png`;
        setSelectedMentalModel(data);
      }
    } catch {
      setOverachieverMessage("Something went wrong. Try again in a moment!");
    } finally {
      setTeachMeLoading(false);
    }
  }, [language]);

  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [ccSearchQuery, setCcSearchQuery] = useState("");
  const [ccGroupCollapsed, setCcGroupCollapsed] = useState<Set<string>>(new Set());
  const [ccSelectedGroupKeys, setCcSelectedGroupKeys] = useState<Set<string>>(new Set());
  const [mentalModelsWithWhenToUse, setMentalModelsWithWhenToUse] = useState<{ id: string; name: string; when_to_use: string[] }[]>([]);
  const [mmFavorites, setMmFavorites] = useState<Set<string>>(new Set());
  const [selectedMmCategory, setSelectedMmCategory] = useState("decision-making");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("and-then-what-mental-model-favorites");
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      setMmFavorites(new Set(Array.isArray(arr) ? arr : []));
    } catch {
      /* ignore */
    }
  }, []);
  const toggleMmFavorite = useCallback((id: string) => {
    setMmFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("and-then-what-mental-model-favorites", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const [mmPreviewMap, setMmPreviewMap] = useState<Map<string, { oneLiner?: string; quickIntro?: string }>>(new Map());
  const [mmSearchQuery, setMmSearchQuery] = useState("");
  const [mmCreateModalOpen, setMmCreateModalOpen] = useState(false);
  const [mmCreateInput, setMmCreateInput] = useState("");
  const [mmCreateLoading, setMmCreateLoading] = useState(false);
  const [mmCreateSaveLoading, setMmCreateSaveLoading] = useState(false);
  const [mmCreateGenerated, setMmCreateGenerated] = useState<Record<string, unknown> | null>(null);
  const [mmCreateError, setMmCreateError] = useState<string | null>(null);
  const [mentalModelsRefreshKey, setMentalModelsRefreshKey] = useState(0);
  const formatMmCategory = useCallback(
    (tag: string) => tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    []
  );
  const normalizeMmCategory = useCallback(
    (value: string) => value.trim().toLowerCase().replace(/[_\s]+/g, "-"),
    []
  );
  useEffect(() => {
    if (libraryPanelOpen === "concepts") {
      setSelectedMmCategory("decision-making");
    }
  }, [libraryPanelOpen]);
  const filteredSessions = sessions.filter((s) =>
    (s.title ?? "").toLowerCase().includes(sessionSearchQuery.toLowerCase())
  );

  const HIDDEN_TAGS_KEY = "chat-hidden-tags";
  const [hiddenTagsSessions, setHiddenTagsSessions] = useState<Set<string>>(
    () => new Set()
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_TAGS_KEY);
      const ids = raw ? JSON.parse(raw) : [];
      if (Array.isArray(ids) && ids.length > 0) {
        setHiddenTagsSessions(new Set(ids));
      }
    } catch {
      /* ignore */
    }
  }, []);
  const toggleTagsHidden = useCallback((sessionId: string) => {
    setHiddenTagsSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      try {
        localStorage.setItem(HIDDEN_TAGS_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    fetch(`/api/mental-models?language=${language}`)
      .then((r) => r.json())
      .then((list: { id: string; name: string }[]) => {
        const map = new Map<string, string>();
        list.forEach((m) => map.set(m.id, m.name));
        setMentalModelsIndex(map);
      })
      .catch(() => {})
      .finally(() => setMentalModelsLoaded(true));
  }, [language, mentalModelsRefreshKey]);

  const [relevanceContext, setRelevanceContext] = useState<string | null>(null);
  const [previewMap, setPreviewMap] = useState<
    Map<string, { oneLiner?: string; quickIntro?: string }>
  >(new Map());
  const [conceptPreviewMap, setConceptPreviewMap] = useState<
    Map<string, { oneLiner?: string; quickIntro?: string }>
  >(new Map());

  useEffect(() => {
    const ids = savedConcepts.map((c) => c.modelId);
    if (ids.length === 0) {
      setConceptPreviewMap(new Map());
      return;
    }
    fetch(`/api/mental-models/preview?ids=${ids.join(",")}&language=${language}`)
      .then((r) => r.json())
      .then((data: Record<string, { oneLiner?: string; quickIntro?: string }>) => {
        const map = new Map<string, { oneLiner?: string; quickIntro?: string }>();
        Object.entries(data).forEach(([k, v]) => map.set(k, v));
        setConceptPreviewMap(map);
      })
      .catch(() => setConceptPreviewMap(new Map()));
  }, [savedConcepts, language]);

  useEffect(() => {
    if (libraryPanelOpen !== "concepts") return;
    fetch(`/api/mental-models/with-when-to-use?language=${language}`)
      .then((r) => r.json())
      .then((data: { id: string; name: string; when_to_use: string[] }[]) => {
        setMentalModelsWithWhenToUse(Array.isArray(data) ? data : []);
        const ids = (Array.isArray(data) ? data : []).map((m) => m.id);
        if (ids.length === 0) return;
        fetch(`/api/mental-models/preview?ids=${ids.join(",")}&language=${language}`)
          .then((r2) => r2.json())
          .then((previewData: Record<string, { oneLiner?: string; quickIntro?: string }>) => {
            const map = new Map<string, { oneLiner?: string; quickIntro?: string }>();
            Object.entries(previewData).forEach(([k, v]) => map.set(k, v));
            setMmPreviewMap(map);
          })
          .catch(() => setMmPreviewMap(new Map()));
      })
      .catch(() => setMentalModelsWithWhenToUse([]));
  }, [libraryPanelOpen, language, mentalModelsRefreshKey]);

  useEffect(() => {
    const nameToId = new Map(
      [...mentalModelsIndex.entries()].map(([id, name]) => [name, id])
    );
    const ids = [
      ...new Set([
        ...messages.flatMap((m) => {
          if (m.role === "assistant") {
            return extractMentalModelIds(m.content, nameToId);
          }
          const { mentionedMentalModelIds } = parseMentionsFromMessage(m.content, {
            idToName: mentalModelsIndex,
            ltmIdToTitle: new Map(longTermMemories.map((ltm) => [ltm._id, ltm.title])),
            ccIdToTitle: new Map(customConcepts.map((cc) => [cc._id, cc.title])),
            cgIdToTitle: new Map(conceptGroups.map((cg) => [cg._id, cg.title])),
          });
          return mentionedMentalModelIds;
        }),
        // Include IDs from current input for type-box hover tooltips
        ...parseMentionsFromMessage(input, {
          idToName: mentalModelsIndex,
          ltmIdToTitle: new Map(longTermMemories.map((ltm) => [ltm._id, ltm.title])),
          ccIdToTitle: new Map(customConcepts.map((cc) => [cc._id, cc.title])),
          cgIdToTitle: new Map(conceptGroups.map((cg) => [cg._id, cg.title])),
        }).mentionedMentalModelIds,
      ]),
    ];
    if (ids.length === 0) {
      setPreviewMap(new Map());
      return;
    }
    fetch(`/api/mental-models/preview?ids=${ids.join(",")}&language=${language}`)
      .then((r) => r.json())
      .then((data: Record<string, { oneLiner?: string; quickIntro?: string }>) => {
        const map = new Map<string, { oneLiner?: string; quickIntro?: string }>();
        Object.entries(data).forEach(([k, v]) => map.set(k, v));
        setPreviewMap(map);
      })
      .catch(() => {});
  }, [messages, input, mentalModelsIndex, longTermMemories, customConcepts, conceptGroups, language]);

  const handleMentalModelClick = useCallback(
    (id: string, sourceMessage?: string) => {
      const context =
        sourceMessage != null ? extractRelevanceContext(sourceMessage, id) : null;
      setRelevanceContext(context);
      // Preload image so it appears instantly when modal opens
      const img = typeof window !== "undefined" ? new window.Image() : null;
      if (img && !id.startsWith("custom_")) img.src = `/images/${id.replace(/_/g, "-")}.png`;
      fetch(`/api/mental-models/${id}?language=${language}`)
        .then((r) => {
          if (!r.ok) throw new Error(`Mental model not found: ${r.status}`);
          return r.json();
        })
        .then((model: MentalModel) => setSelectedMentalModel(model))
        .catch((err) => {
          console.error("Failed to load mental model:", id, err);
        });
    },
    [language]
  );

  return (
    <TtsHighlightContext.Provider value={{ ttsHighlight, setTtsHighlight }}>
    <div className={`relative flex flex-col h-[100dvh] min-h-[100dvh] overflow-hidden chat-bg-area bg-background border-2 transition-[border-color,background] duration-300 ease-in-out ${incognitoMode ? "border-violet-400/70 dark:border-violet-500/60" : "border-transparent"}`}>
      {/* Shared top bar - fixed on mobile so it stays visible when scrolling */}
      <header
        className={`h-14 min-h-[44px] pt-[env(safe-area-inset-top)] flex border-b shrink-0 fixed top-0 left-0 right-0 z-20 md:relative md:top-auto md:left-auto md:right-auto ${
          incognitoMode
            ? "bg-neutral-900 dark:bg-neutral-100 border-neutral-700 dark:border-neutral-300 text-neutral-100 dark:text-neutral-900"
            : "bg-background border-neutral-200 dark:border-neutral-800"
        }`}
      >
        {/* Left: sidebar header (desktop only when sidebar open) - fades with sidebar */}
        <div
          className={`hidden shrink-0 lg:flex w-72 items-center justify-between px-4 border-r overflow-hidden transition-[width,opacity] duration-300 ease-out ${incognitoMode ? "border-neutral-700 dark:border-neutral-300" : "border-neutral-200 dark:border-neutral-800"} ${sidebarOpen ? "lg:w-72 lg:opacity-100" : "lg:w-0 lg:min-w-0 lg:opacity-0 lg:pointer-events-none lg:border-r-0"}`}
        >
          <Link
            href="/"
            className={`font-semibold text-lg min-w-0 truncate ${incognitoMode ? "text-neutral-100 dark:text-neutral-900" : "text-foreground"}`}
            title="FigureMyLife Labs"
          >
            FigureMyLife Labs
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border-2 border-transparent transition-colors duration-200 active:scale-95 ${
              incognitoMode
                ? "text-neutral-100/80 dark:text-neutral-900/80 hover:border-neutral-500 dark:hover:border-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-900"
                : "text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-500"
            }`}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>
        {/* Right: main header (always) */}
        <div className="flex-1 min-w-0 flex items-center justify-between gap-1 sm:gap-4 px-3 sm:px-4">
          <div className="flex items-center gap-1 sm:gap-4 min-w-0 overflow-hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              data-tour="menu-button"
              className={`p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl transition-colors duration-300 ease-in-out active:scale-95 shrink-0 ${
                !sidebarOpen ? "" : "lg:hidden"
              } ${incognitoMode ? "text-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200" : "text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {!sidebarOpen ? (
              <>
                {incognitoMode ? (
                  <div className="group flex items-center gap-2 min-w-0 text-neutral-100 dark:text-neutral-900">
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center" aria-hidden>
                      <GhostIcon className="w-5 h-5" />
                    </span>
                    <span className="font-medium truncate min-w-0">Incognito chat</span>
                  </div>
                ) : currentSession?.title ? (
                  <span className="font-medium truncate min-w-0" title={currentSession.title}>
                    {currentSession.title}
                  </span>
                ) : null}
                <Link
                  href={incognitoMode ? "/chat/incognito" : "/chat/new"}
                  onClick={(e) => {
                    closeAllModalsExceptLeftPanel();
                    if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
                    if (sessionId === "new" || sessionId === "incognito") {
                      e.preventDefault();
                      anonymousActiveRef.current = false;
                      setMessages([]);
                      setCurrentSessionId(null);
                      setCurrentSession(null);
                      setCollapsedSummary(null);
                      setInput("");
                    }
                  }}
                  className={`p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl transition-colors duration-300 ease-in-out active:scale-95 shrink-0 ${
                    incognitoMode ? "text-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200" : "text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                  aria-label="New conversation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Link>
              </>
            ) : (
              <h1 className="font-medium truncate">
                {currentSession?.title || (currentSessionId ? "Conversation" : "New conversation")}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 overflow-visible">
            <Clock weatherFormat={weatherFormat} onMoonPhaseChange={setMoonPhase} />
            {!incognitoMode && !isAnonymous && (
              <div className="relative group/incognito">
                <Link
                  href="/chat/incognito"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className="block p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-300 ease-in-out"
                  aria-label="Use incognito"
                >
                  <GhostIcon className="w-5 h-5" />
                </Link>
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 text-xs font-medium text-white bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/incognito:opacity-100 transition-opacity duration-200 z-50">
                  Use Incognito Mode
                </span>
              </div>
            )}
            <ThemeToggle inverted={incognitoMode} moonPhase={moonPhase} />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              data-tour="settings-button"
              className={`p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl transition-colors duration-300 ease-in-out ${
                incognitoMode ? "text-neutral-100 dark:text-neutral-900 hover:text-neutral-200 dark:hover:text-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-200" : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
              aria-label="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>
            {incognitoMode && (
              <Link
                href="/chat/new"
                onClick={() => {
                  closeAllModalsExceptLeftPanel();
                  if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
                  anonymousActiveRef.current = false;
                  setMessages([]);
                  setCurrentSessionId(null);
                  setCurrentSession(null);
                  setCollapsedSummary(null);
                  setInput("");
                }}
                className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-xl text-neutral-100 dark:text-neutral-900 hover:text-neutral-200 dark:hover:text-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors duration-300 ease-in-out"
                title="Exit incognito"
                aria-label="Exit incognito"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Spacer for fixed header on mobile - prevents content from hiding under header */}
      <div className="shrink-0 md:hidden" style={{ height: "calc(3.5rem + env(safe-area-inset-top))" }} aria-hidden />

      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar - fixed overlay on mobile; in-flow on desktop when open. Fade in/out animation. */}
      <aside
        className={`z-40 w-72 bg-background border-r border-neutral-200/80 dark:border-neutral-800 flex flex-col min-h-0 transition-[transform,opacity,width] duration-300 ease-out
          fixed inset-y-0 left-0 lg:static lg:inset-auto lg:translate-x-0
          ${sidebarOpen
            ? "translate-x-0 opacity-100 lg:w-72"
            : "-translate-x-full opacity-0 pointer-events-none lg:translate-x-0 lg:w-0 lg:min-w-0 lg:overflow-hidden lg:border-r-0"
          }
          lg:flex`}
      >
        {/* Mobile overlay: sidebar has its own header. Desktop: header is in shared top bar, no header here */}
        <div className="h-14 min-h-[44px] pt-[env(safe-area-inset-top)] shrink-0 lg:hidden">
          <div className="h-full px-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
            <Link href="/" className="font-semibold text-lg text-foreground min-w-0 truncate" title="FigureMyLife Labs">
              FigureMyLife Labs
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm font-medium shrink-0"
              aria-label="Back to conversation"
            >
              Conversation
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain">
        {!isAnonymous && (
        <>
        <div className="flex-1 min-h-0 flex flex-col min-w-0 px-2 py-1.5">
          {/* New conversation - always visible at top of sidebar */}
          <Link
            href={incognitoMode ? "/chat/incognito" : "/chat/new"}
            onClick={(e) => {
              closeAllModalsExceptLeftPanel();
              if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
              if (sessionId === "new" || sessionId === "incognito") {
                e.preventDefault();
                anonymousActiveRef.current = false;
                setMessages([]);
                setCurrentSessionId(null);
                setCurrentSession(null);
                setCollapsedSummary(null);
                setInput("");
              }
            }}
            className="flex items-center justify-center gap-2 w-full mb-4 px-3 py-2 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-[13px] sm:text-[14px] font-medium text-foreground transition-colors shrink-0"
            aria-label="New conversation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New conversation
          </Link>
          {/* Primary nav - Claude.ai pill style, compact selector for center panel */}
          <nav className="flex flex-col gap-0.5 shrink-0 mb-4 p-1 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/30" aria-label="Select view" data-tour="sidebar-nav">
            {[
              { id: "conversations" as const, label: "Conversations", icon: "chat", onClick: () => { playSelectionChime(); setLibraryPanelOpen("conversations"); setConversationsCollapsed(false); } },
              { id: "nuggets" as const, label: "Nuggets", icon: "nuggets", onClick: () => { playSelectionChime(); setLibraryPanelOpen("nuggets"); } },
              { id: "cc" as const, label: "Concepts", icon: "concepts", onClick: () => { playSelectionChime(); setLibraryPanelOpen("cc"); } },
              { id: "concepts" as const, label: "Mental Models", icon: "models", onClick: () => { playSelectionChime(); setLibraryPanelOpen("concepts"); } },
              { id: "ltm" as const, label: "Long-Term Memory", icon: "memory", onClick: () => { playSelectionChime(); setLibraryPanelOpen("ltm"); } },
              { id: "cg" as const, label: "Domains", icon: "domains", onClick: () => { playSelectionChime(); setLibraryPanelOpen("cg"); } },
            ].map(({ id, label, icon, onClick }) => {
              const isActive = libraryPanelOpen === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={onClick}
                  data-tour={`tour-${id}`}
className={`flex items-center gap-2.5 w-full px-3 py-1.5 rounded-full text-left text-[13px] sm:text-[14px] font-medium transition-colors border-2 ${
                      isActive
                        ? "border-neutral-300 dark:border-neutral-400 bg-white dark:bg-neutral-700 text-foreground"
                        : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-foreground hover:border-neutral-400 dark:hover:border-neutral-500"
                  }`}
                >
                  {icon === "chat" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  )}
                  {icon === "nuggets" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                  )}
                  {icon === "concepts" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                      <path d="M12 3v18" />
                    </svg>
                  )}
                  {icon === "models" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
                    </svg>
                  )}
                  {icon === "memory" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                      <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  )}
                  {icon === "domains" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
                      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
                    </svg>
                  )}
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-2 pt-2 border-t-[0.5px] border-neutral-200/60 dark:border-neutral-600/60">
            <button
              type="button"
              onClick={() => { playSelectionChime(); setWaysOfLookingAtModalOpen(true); setWaysOfLookingAtDrawMode(false); setWaysOfLookingAtCategory(null); setWaysOfLookingAtCity(null); setWaysOfLookingAtCuisine(null); setWaysOfLookingAtMicrocosm(null); }}
              className="flex items-center gap-2.5 w-full px-3 py-1.5 rounded-full text-left text-[13px] sm:text-[14px] font-medium transition-colors border-2 border-transparent text-neutral-600 dark:text-neutral-400 hover:text-foreground hover:border-neutral-400 dark:hover:border-neutral-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                <rect width="18" height="14" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M3 15h18" />
              </svg>
              <span className="truncate shimmer-text-colorful">Prompt Games</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setConversationsCollapsed(!conversationsCollapsed)}
            className="flex items-center justify-between w-full px-3 py-1.5 mt-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors shrink-0"
          >
            Recents
            <span className="text-[10px] transition-transform" aria-hidden>
              {conversationsCollapsed ? "▶" : "▼"}
            </span>
          </button>
          {!conversationsCollapsed && (
            <>
            <div className="relative mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            <input
              type="search"
                placeholder="Search"
              value={sessionSearchQuery}
              onChange={(e) => setSessionSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-[13px] rounded-lg border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-neutral-300 dark:focus:border-neutral-600 shrink-0"
              aria-label="Search conversations"
            />
            </div>
            <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0">
              {filteredSessions.length === 0 ? (
                <div className="px-3 py-1.5 space-y-0.5">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {sessionSearchQuery ? "No conversations match" : "No conversations yet"}
                  </p>
                  {!sessionSearchQuery && (
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                      Ready to have a conversation whenever you say something
                    </p>
                  )}
                </div>
              ) : (
              filteredSessions.map((s) => (
                <div
                  key={s._id}
                  className={`group flex flex-col gap-0 rounded-xl border transition-colors duration-200 ${
                    currentSessionId === s._id
                      ? "border-neutral-300 dark:border-neutral-600"
                      : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-500"
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <Link
                      href={`/chat/${s._id}`}
                      className={`flex-1 min-w-0 flex items-center gap-2 py-1.5 px-2.5 truncate text-[13px] ${
                      currentSessionId === s._id ? "font-medium text-foreground" : "text-neutral-800 dark:text-neutral-200"
                    }`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{s.title || "New conversation"}</span>
                        {s.updatedAt && (
                          <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5">
                            {formatRelativeTime(s.updatedAt)}
                          </span>
                        )}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-neutral-400 shrink-0 flex-shrink-0">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteSessionConfirmModal(s);
                    }}
                    className="p-1 rounded opacity-50 hover:opacity-100 group-hover:opacity-100 text-neutral-500 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 active:scale-95 shrink-0"
                    aria-label="Delete conversation"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                  </div>
                  {s.mentalModelTags && s.mentalModelTags.length > 0 &&
                    !hiddenTagsSessions.has(s._id) && (
                    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1">
                      <div className="flex flex-wrap gap-1">
                        {s.mentalModelTags.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleMentalModelClick(id);
                            }}
                            className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-medium bg-neutral-200 dark:bg-neutral-600 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-500 transition-all duration-200 active:scale-95"
                          >
                            {mentalModelsIndex.get(id) ?? id.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleTagsHidden(s._id);
                        }}
                        className="text-[9px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline-offset-2 hover:underline"
                      >
                        Hide tags
                      </button>
                    </div>
                  )}
                  {s.mentalModelTags && s.mentalModelTags.length > 0 &&
                    hiddenTagsSessions.has(s._id) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleTagsHidden(s._id);
                      }}
                      className="px-3 pb-1 text-left text-[9px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400"
                    >
                      Show {s.mentalModelTags.length} tags
                    </button>
                  )}
                </div>
              ))
              )}
            </nav>
            </>
          )}
        </div>
        </>
        )}
        {isAnonymous && (
          <div className="px-3 py-2 flex-1 min-h-0 flex flex-col gap-2 items-center">
            <p className="w-full max-w-[220px] flex items-center gap-1.5 text-[13px] sm:text-[14px] font-medium text-neutral-600 dark:text-neutral-400 text-left">
              <SparklesIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Sign in to unlock:</span>
            </p>
            <ul className="space-y-1 w-full flex flex-col items-center">
              {signInFeatures.map((item, i) => (
                <li
                  key={i}
                  className="w-full max-w-[220px] animate-slide-in-from-left opacity-0 [animation-fill-mode:forwards]"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => setSignInFeaturesModalOpen(true)}
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-[12px] sm:text-[13px] text-left border border-transparent bg-background text-neutral-600 dark:text-neutral-400"
                  >
                    <span className="text-neutral-500 shrink-0">{signInFeatureIconSvg(item.icon)}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="w-full pt-3 border-t border-neutral-200/80 dark:border-neutral-800">
              <Link
                href="/extension"
                className="flex items-center justify-center gap-2 w-full max-w-[220px] mx-auto px-3 py-2 rounded-2xl border border-[#f2b37d] bg-transparent text-[#c96b25] dark:text-[#f2b37d] hover:bg-[#fff1df] dark:hover:bg-[#3a2415] text-[13px] sm:text-[14px] font-medium transition-colors whitespace-nowrap"
              >
                <ChromeIcon className="w-4 h-4 shrink-0" />
                Install Extension
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackModalOpen(true)}
              className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors shrink-0 mt-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Send feedback
            </button>
            <div className="flex-1 min-h-[4rem] flex flex-col items-center justify-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link
                  href="/sign-in"
                  className="px-4 py-2.5 rounded-xl text-base font-medium border-2 border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="px-4 py-2.5 rounded-xl text-base font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  Create account
                </Link>
              </div>
            </div>
          </div>
        )}
        </div>
        <div className="shrink-0 px-3 pt-5 pb-4 mt-4">
          <div className="flex flex-col items-center gap-2">
            {!isAnonymous && (
            <button
              type="button"
              onClick={() => setFeedbackModalOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-[15px] text-neutral-600 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Send feedback
            </button>
            )}
            <button
              type="button"
              onClick={() => setLetterModalOpen(true)}
              className="font-developer text-[1.2em] leading-none font-normal text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
            >
              Crafted with Intention
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-neutral-500 dark:text-neutral-400">
              <Link href="/terms-of-service" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <span className="text-neutral-400 dark:text-neutral-500" aria-hidden>·</span>
              <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay when sidebar open on mobile - fades in/out */}
      <div
        className={`fixed inset-0 bg-black/30 z-30 lg:hidden transition-opacity duration-300 ease-out ${featureTourStep === null ? "backdrop-blur-sm" : ""} ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {summarizeSuccess && (
          <div className="mx-4 mt-2 px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-700 dark:text-neutral-300 animate-celebrate flex items-center gap-2">
            <span className="text-lg">✨</span>
            Conversation summarized and saved to long-term memory.
          </div>
        )}

        {conceptSavedToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-800 dark:text-neutral-200 animate-celebrate flex items-center gap-2 shadow-lg">
            <span className="text-lg">✨</span>
            Added to Concept Gems!
          </div>
        )}

        {ccCreateSuccess && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-800 dark:text-neutral-200 animate-celebrate flex items-center gap-2 shadow-lg">
            <span className="text-lg">✨</span>
            Custom concept created!
          </div>
        )}

        {overachieverMessage && (
          <div className="mx-4 mt-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-800 dark:text-neutral-200 animate-fade-in">
            {overachieverMessage}
          </div>
        )}

        {(showLanguageChangeBanner || showUserTypeChangeBanner) &&
          currentSessionId &&
          messages.length > 0 &&
          currentSessionId !== justCreatedSessionRef.current && (
          <LanguageChangeBanner
            onDismiss={() => {
              dismissLanguageChangeBanner();
              dismissUserTypeChangeBanner();
            }}
          />
        )}

        <div
          className={`flex-1 min-h-0 flex flex-col ${
            messages.length > 0
              ? "pb-24 md:pb-0 overflow-y-auto scroll-smooth"
              : "pb-0 overflow-hidden"
          }`}
        >
          <div ref={messagesScrollRef} className={`flex-1 min-h-0 min-w-0 ${messages.length > 0 ? "overflow-y-auto" : "overflow-hidden flex flex-col"}`}>
          {currentSession?.isCollapsed && collapsedSummary ? (
            <div className="min-h-full flex items-center justify-center p-4">
              <div className="w-full max-w-2xl">
              <div className="group/tts rounded-3xl border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm p-6 space-y-4 text-foreground">
                <h2 className="font-semibold text-lg">{collapsedSummary.title}</h2>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
                  {ttsHighlight && "textId" in ttsHighlight && ttsHighlight.textId === `collapsed-summary-${collapsedSummary._id}` ? (
                    <TtsHighlightedText text={`${collapsedSummary.title}\n\n${collapsedSummary.summary}`.trim()} charEnd={ttsHighlight.charEnd} />
                  ) : (
                    collapsedSummary.summary
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <TTSButton
                    text={`${collapsedSummary.title}\n\n${collapsedSummary.summary}`}
                    showOnHover={false}
                    ariaLabel="Listen to summary"
                    onTtsProgress={(charEnd) => setTtsHighlight({ textId: `collapsed-summary-${collapsedSummary._id}`, charEnd })}
                    onTtsEnd={() => setTtsHighlight(null)}
                  />
                  <CopyButton
                    text={`${collapsedSummary.title}\n\n${collapsedSummary.summary}`}
                    aria-label="Copy summary"
                  />
                  {currentSessionId && (
                    <button
                      onClick={async () => {
                        setRestartLoading(true);
                        try {
                          const res = await fetch(`/api/sessions/${currentSessionId}/restart`, {
                            method: "POST",
                          });
                          if (res.ok) {
                            const { session, messages: msgs } = await fetch(
                              `/api/sessions/${currentSessionId}`
                            ).then((r) => r.json());
                            setCurrentSession(session);
                            setMessages(processMessagesWithContext(msgs || []));
                            setCollapsedSummary(null);
                            refetchSessions();
                          }
                        } finally {
                          setRestartLoading(false);
                        }
                      }}
                      disabled={restartLoading}
                      className="px-3 py-2 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-60"
                    >
                      {restartLoading ? "Restarting…" : "Restart conversation"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setLtmDeleteConfirmModal(collapsedSummary)}
                    aria-label="Delete from long-term memory"
                    className="p-2 rounded-xl text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">
                  This conversation has been summarized. Use &quot;Restart conversation&quot; above to see the full chat.
                </p>
              </div>
              </div>
            </div>
          ) : sessionLoading && messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[200px] animate-fade-in">
              <div className="flex flex-col items-center gap-4 text-neutral-500 dark:text-neutral-400">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                <p className="text-sm flex items-center gap-1">
                  Loading conversation
                  <LoadingDots />
                </p>
              </div>
            </div>
          ) : onboardingStep !== null && messages.length === 0 ? (
            /* First-time onboarding overlay - Claude.ai style */
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-xl mx-auto">
              {onboardingStep === 1 && (
                <div className="w-full text-center animate-fade-in-up space-y-8">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Welcome to fml labs</h1>
                  <p className="text-base text-neutral-600 dark:text-neutral-400">
                    A coach that helps you think through the long-term consequences of your choices—with mental models that actually work.
                  </p>
                  <button
                    type="button"
                    onClick={() => setOnboardingStep(2)}
                    className="w-full max-w-xs mx-auto px-6 py-3 rounded-2xl bg-foreground text-background font-medium text-base hover:opacity-90 transition-opacity"
                  >
                    Get started
                  </button>
                </div>
              )}
              {onboardingStep === 2 && (
                <div className="w-full text-center animate-fade-in-up space-y-6">
                  <h2 className="text-xl font-semibold text-foreground">Privacy & Terms</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 text-left">
                    By using fml labs, you agree to our{" "}
                    <Link href="/terms-of-service" className="text-foreground underline underline-offset-2 hover:no-underline" target="_blank" rel="noopener noreferrer">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy-policy" className="text-foreground underline underline-offset-2 hover:no-underline" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>
                    . Your conversations are processed to provide the service. We respect your data and privacy.
                  </p>
                  <button
                    type="button"
                    onClick={() => setOnboardingStep(3)}
                    className="w-full max-w-xs mx-auto px-6 py-3 rounded-2xl bg-foreground text-background font-medium text-base hover:opacity-90 transition-opacity"
                  >
                    Acknowledge
                  </button>
                </div>
              )}
              {onboardingStep === 3 && (
                <div className="w-full animate-fade-in-up space-y-6">
                  <h2 className="text-2xl md:text-xl font-semibold text-foreground text-center">A note from the developer</h2>
                  <p className="text-base text-neutral-600 dark:text-neutral-400 text-center">
                    Here&apos;s what fml labs is about:
                  </p>
                  <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-foreground">
                          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Mental models</p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">Proven frameworks and biases to help you think through decisions.</p>
                      </div>
                    </div>
                    <div className="flex gap-4 items-start">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-foreground">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Deep questioning</p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">Not surface-level advice—we dig into the long-term consequences.</p>
                      </div>
                    </div>
                    <div className="flex gap-4 items-start">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-foreground">
                          <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Long-term thinking</p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">Focus on choices that matter for your future.</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 text-center">
                    <p className="font-developer text-[1.2em] font-normal text-foreground shimmer-text-hover">Crafted with Intention</p>
                    <p className="text-base md:text-sm text-neutral-500 dark:text-neutral-400 mt-1">San Francisco</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
                      } catch {
                        /* ignore */
                      }
                      setOnboardingStep(null);
                      if (!isAnonymous) setFeatureTourStep(0);
                    }}
                    className="w-full max-w-xs mx-auto block px-6 py-3 rounded-2xl bg-foreground text-background font-medium text-base hover:opacity-90 transition-opacity"
                  >
                    Sounds good, let&apos;s begin
                  </button>
                </div>
              )}
            </div>
          ) : (
          <div
            ref={messagesContainerRef}
            className={`max-w-2xl mx-auto w-full min-w-0 px-4 py-6 no-touch-callout ${messages.length === 0 ? "flex-1 min-h-0 flex flex-col items-center justify-center" : "space-y-6"}`}
            onMouseUp={() => {
              if (isAnonymous || incognitoMode) return;
              checkSelection();
            }}
            onTouchEnd={() => {
              if (isAnonymous || incognitoMode) return;
              // On mobile, selection may not be ready immediately; delay slightly
              requestAnimationFrame(() => {
                setTimeout(checkSelection, 50);
              });
            }}
            onContextMenu={(e) => {
              if (typeof window !== "undefined" && "ontouchstart" in window) e.preventDefault();
            }}
          >
            {messages.length === 0 && (
              <div className="flex w-full min-w-0 max-w-2xl flex-col items-center justify-center text-center px-2 space-y-8">
                <div className="animate-fade-in-up w-full min-w-0">
                  {incognitoMode ? (
                    <div className="flex flex-col items-center gap-4 text-neutral-600 dark:text-neutral-400">
                      <span className="group shrink-0 w-12 h-12 flex items-center justify-center" aria-hidden>
                        <GhostIcon className="w-12 h-12" />
                      </span>
                      <p className="text-base sm:text-lg font-medium text-foreground">
                        Let&apos;s chat incognito
                      </p>
                      <p className="text-sm max-w-md">
                        Secure and private—nothing is saved. Your conversation won&apos;t appear in history.
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500">
                        Unavailable: Summarize & collapse, nuggets, saving to concepts
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="w-full min-w-0 break-words text-neutral-500 dark:text-neutral-400 text-base sm:text-lg">
                        Let&apos;s dig in—with mental models that actually work
                      </p>
                      <p className="w-full min-w-0 break-words text-neutral-400 dark:text-neutral-500 text-sm mt-2 mb-6">
                        Ready to have a conversation whenever you say something
                      </p>
                      <div className="space-y-3 mb-6 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            playSelectionChime();
                            setWaysOfLookingAtModalOpen(true);
                            setWaysOfLookingAtDrawMode(true);
                            setWaysOfLookingAtCategory(null);
                            setWaysOfLookingAtCity(null);
                            setWaysOfLookingAtCuisine(null);
                            setWaysOfLookingAtMicrocosm(null);
                          }}
                          className="flex items-center gap-3 w-full max-w-sm mx-auto px-4 py-3 rounded-2xl border border-neutral-300 dark:border-neutral-600 bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-500 text-left transition-all duration-200 active:scale-[0.98]"
                        >
                          <span className="shrink-0 w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-foreground">
                              <rect width="18" height="14" x="3" y="3" rx="2" />
                              <path d="M3 9h18" />
                              <path d="M3 15h18" />
                            </svg>
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">Draw a perspective card</p>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">Shift how you look at something—art, decisions, or any topic</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playSelectionChime();
                            setLibraryPanelOpen("concepts");
                            setSidebarOpen(false);
                          }}
                          className="flex items-center gap-3 w-full max-w-sm mx-auto px-4 py-3 rounded-2xl border border-neutral-300 dark:border-neutral-600 bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-500 text-left transition-all duration-200 active:scale-[0.98]"
                        >
                          <span className="shrink-0 w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-foreground">
                              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
                            </svg>
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">Browse Mental Models</p>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">Frameworks and biases for better decision-making</p>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="w-full">
                  <MovingPills
                    language={language}
                    onSelect={(text) => sendMessage(text)}
                  />
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                messageIndex={i}
                totalMessages={messages.length}
                isLoading={isLoading && i === messages.length - 1}
                onOptionSelect={(text) => sendMessage(text)}
                onGoBackInTime={
                  isAnonymous
                    ? (idx, msg) => {
                        if (msg.role === "user") {
                          sendMessage(msg.content, {
                            messagesOverride: messages.slice(0, idx),
                          });
                        } else {
                          setMessages((prev) => prev.slice(0, idx + 1));
                        }
                      }
                    : currentSessionId
                      ? (idx, msg) => setGoBackConfirmModal({ index: idx, role: msg.role, content: msg.content })
                      : undefined
                }
                onRetry={
                  lastFailedUserMessage && m.role === "assistant" && i === messages.length - 1
                    ? () => sendMessage(lastFailedUserMessage, { retry: true })
                    : undefined
                }
                isLastAssistant={
                  m.role === "assistant" && i === messages.length - 1
                }
                isLastUserMessageAndLoading={
                  m.role === "user" && isLoading && i === messages.length - 2
                }
                idToName={mentalModelsIndex}
                ltmIdToTitle={new Map(longTermMemories.map((ltm) => [ltm._id, ltm.title]))}
                ccIdToTitle={new Map(customConcepts.map((cc) => [cc._id, cc.title]))}
                cgIdToTitle={new Map(conceptGroups.map((cg) => [cg._id, cg.title]))}
                onMentalModelClick={handleMentalModelClick}
                onLtmClick={(id) => {
                  const ltm = longTermMemories.find((l) => l._id === id);
                  if (ltm) setLtmDetailModal(ltm);
                }}
                onCustomConceptClick={(id) => {
                  const cc = customConcepts.find((c) => c._id === id);
                  if (cc) setCcDetailModal(cc);
                }}
                onConceptGroupClick={(id) => {
                  const cg = conceptGroups.find((g) => g._id === id);
                  if (cg) {
                    fetch(`/api/me/concept-groups/${id}`)
                      .then((r) => r.ok ? r.json() : Promise.reject())
                      .then((data) => setCgDetailModal({ ...cg, concepts: data.concepts ?? [] }))
                      .catch(() => setCgDetailModal(cg));
                  }
                }}
                onPerspectiveCardClick={({ name, prompt }) =>
                  setDrawnPerspectiveCard({
                    card: { id: "from_conversation", name, prompt },
                    deckId: "from_conversation",
                    deckName: "From conversation",
                  })
                }
                previewMap={previewMap}
                isRtl={isRtlLanguage(language)}
                ttsHighlight={ttsHighlight && "messageIndex" in ttsHighlight && ttsHighlight.messageIndex === i ? ttsHighlight.charEnd : undefined}
                onTtsProgress={(msgIdx, charEnd) => setTtsHighlight({ messageIndex: msgIdx, charEnd })}
                onTtsEnd={() => setTtsHighlight(null)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
          )}
          {selectedTextForNugget && selectionRect && !isAnonymous && !incognitoMode && !nuggetFormOpen && (
            <div
              ref={selectionBubblesRef}
              className="fixed z-40 flex gap-1 animate-fade-in"
              style={{ left: selectionRect.left, top: selectionRect.bottom + 4 }}
            >
              <button
                type="button"
                onClick={() => {
                  const w = Math.min(360, typeof window !== "undefined" ? window.innerWidth - 32 : 360);
                  let x = selectionRect.left;
                  if (typeof window !== "undefined" && x + w > window.innerWidth - 16) x = window.innerWidth - w - 16;
                  if (x < 8) x = 8;
                  setNuggetCreateContent(selectedTextForNugget);
                  setNuggetCreateSource("");
                  setNuggetFormOpen("selection");
                  setNuggetFormPosition({ x, y: selectionRect.bottom + 4 });
                  setSelectedTextForNugget(null);
                  setSelectionRect(null);
                  window.getSelection()?.removeAllRanges?.();
                }}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 transition-opacity"
                title="Save Nugget"
                aria-label="Save Nugget"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const text = selectedTextForNugget;
                  const w = Math.min(360, typeof window !== "undefined" ? window.innerWidth - 32 : 360);
                  let x = selectionRect.left;
                  if (typeof window !== "undefined" && x + w > window.innerWidth - 16) x = window.innerWidth - w - 16;
                  if (x < 8) x = 8;
                  const y = selectionRect.bottom + 4;
                  setSelectionLearnPopup({ text, explanation: null, loading: true, x, y });
                  setSelectedTextForNugget(null);
                  setSelectionRect(null);
                  window.getSelection()?.removeAllRanges?.();
                  try {
                    const res = await fetch("/api/me/nuggets/learn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) });
                    const data = await res.json();
                    setSelectionLearnPopup((p) => p ? { ...p, explanation: data.explanation ?? "Failed to load.", loading: false } : null);
                  } catch {
                    setSelectionLearnPopup((p) => p ? { ...p, explanation: "Failed to load.", loading: false } : null);
                  }
                }}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 transition-opacity"
                title="Learn from This"
                aria-label="Learn from This"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  <path d="M12 3v18" />
                </svg>
              </button>
            </div>
          )}
          {selectionLearnPopup && (
            <>
              <div
                className="fixed inset-0 z-[49] bg-black/20 animate-fade-in"
                onClick={() => setSelectionLearnPopup(null)}
                aria-hidden
              />
              <div
                className="fixed z-50 w-[min(360px,calc(100vw-2rem))] animate-fade-in rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background shadow-xl p-3"
                style={{ left: selectionLearnPopup.x, top: selectionLearnPopup.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Learn</span>
                  <div className="flex items-center gap-1">
                    {!selectionLearnPopup.loading && selectionLearnPopup.explanation && (
                      <TTSButton
                        text={selectionLearnPopup.explanation}
                        showOnHover={false}
                        ariaLabel="Listen to explanation"
                        onTtsProgress={(charEnd) => setTtsHighlight({ textId: "selection-learn-popup", charEnd })}
                        onTtsEnd={() => setTtsHighlight(null)}
                      />
                    )}
                    <button type="button" onClick={() => { setSelectionLearnPopup(null); setTtsHighlight(null); }} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">✕</button>
                  </div>
                </div>
                {selectionLearnPopup.loading ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading...</p>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {ttsHighlight && "textId" in ttsHighlight && ttsHighlight.textId === "selection-learn-popup" ? (
                      <TtsHighlightedText text={selectionLearnPopup.explanation ?? ""} charEnd={ttsHighlight.charEnd} />
                    ) : (
                      selectionLearnPopup.explanation
                    )}
                  </p>
                )}
              </div>
            </>
          )}
          </div>
        </div>

        {showScrollToBottom && !currentSession?.isCollapsed && messages.length > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className={`fixed right-2 md:right-8 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 active:scale-95 transition-all duration-200 ${
              currentSessionId && currentSession && messages.length >= 2
                ? "bottom-[8.5rem] md:bottom-[7.5rem]" /* mobile: lifted above save-memory row; desktop: above input */
                : "bottom-[5.5rem] md:bottom-[5rem]" /* mobile: inside bottom bar; desktop: above input only */
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Incognito disclaimer - shown when in incognito mode */}
        {incognitoMode && (
          <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 px-4 py-2">
            Incognito chats aren&apos;t saved to history.{" "}
            <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300" target="_blank" rel="noopener noreferrer">
              Learn more about how your data is used
            </Link>
          </p>
        )}
        {/* Bottom bar - fixed on mobile so it stays visible when scrolling. When voice mode, show orb in same section instead of input. Hidden only during first-time onboarding (no messages). On mobile, use gradient so scroll-to-bottom area is transparent and content shows through. */}
        <div className={`fixed inset-x-0 bottom-0 z-30 flex flex-col border-t border-neutral-200 dark:border-neutral-800 shrink-0 pb-[env(safe-area-inset-bottom)] md:relative md:inset-x-auto md:bottom-auto md:pb-0 bg-background ${onboardingStep !== null && messages.length === 0 ? "hidden" : ""}`}>
          {!isAnonymous && messages.length >= 2 && (!currentSession || !currentSession.isCollapsed) && (
            <div className="px-4 pt-1 pb-0.5 sm:pt-1.5 sm:pb-1">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                  Save a concise memory of this conversation for later.
                </p>
              <button
                  onClick={() => {
                    if (incognitoMode) return;
                    playSelectionChime();
                    setSummarizeLanguageModal({ selectedLanguage: language });
                  }}
                disabled={incognitoMode}
                  title={incognitoMode ? "Not available in incognito" : "Summarize this conversation and save it to long-term memory"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  <span>Save to memory</span>
              </button>
              </div>
            </div>
          )}
          <div className="flex flex-col items-center justify-center px-4 pt-2 pb-2 sm:pt-3 sm:pb-3 min-w-0 gap-1.5 sm:gap-2">
            <div className="min-w-0 max-w-2xl w-full flex items-stretch gap-1.5 sm:gap-2 min-h-[52px]" data-tour="input-area">
              <div className="relative flex-1 min-w-0">
                <MentionInput
                  inputRef={inputRef}
                  value={input}
                  onChange={setInput}
                  onKeyDown={handleKeyDown}
                  mentalModels={Array.from(mentalModelsIndex.entries()).map(([id, name]) => ({
                    id,
                    name,
                  }))}
                  longTermMemories={longTermMemories.map((ltm) => ({
                    _id: ltm._id,
                    title: ltm.title,
                    enrichmentPrompt: ltm.enrichmentPrompt,
                  }))}
                  customConcepts={customConcepts.map((cc) => ({
                    _id: cc._id,
                    title: cc.title,
                    enrichmentPrompt: cc.enrichmentPrompt,
                  }))}
                  conceptGroups={conceptGroups.map((cg) => ({
                    _id: cg._id,
                    title: cg.title,
                  }))}
                  placeholder="/ to search"
                  placeholderMobile="/ to search"
                  disabled={isLoading || sessionLoading || !!currentSession?.isCollapsed}
                  className="w-full h-[52px] max-h-[52px] py-3 pl-4 pr-4 sm:pr-10 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-neutral-300 dark:focus:border-neutral-600 text-base transition-all duration-200 placeholder:text-neutral-500 dark:placeholder:text-neutral-500 text-foreground whitespace-nowrap overflow-x-auto overflow-y-hidden"
                  onMentalModelClick={handleMentalModelClick}
                  onLtmClick={(id) => {
                    const ltm = longTermMemories.find((l) => l._id === id);
                    if (ltm) setLtmDetailModal(ltm);
                  }}
                  onCustomConceptClick={(id) => {
                    const cc = customConcepts.find((c) => c._id === id);
                    if (cc) setCcDetailModal(cc);
                  }}
                  onConceptGroupClick={(id) => {
                    const cg = conceptGroups.find((g) => g._id === id);
                    if (cg) {
                      fetch(`/api/me/concept-groups/${id}`)
                        .then((r) => r.ok ? r.json() : Promise.reject())
                        .then((data) => setCgDetailModal({ ...cg, concepts: data.concepts ?? [] }))
                        .catch(() => setCgDetailModal(cg));
                    }
                  }}
                  previewMap={previewMap}
                />
                {isMobileViewport && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInputExpandModalOpen(true);
                    }}
                    disabled={isLoading || sessionLoading || !!currentSession?.isCollapsed}
                    className="absolute inset-0 z-10 sm:hidden rounded-2xl"
                    aria-label="Open composer"
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setInputExpandModalOpen(true);
                  }}
                  disabled={isLoading || sessionLoading || !!currentSession?.isCollapsed}
                  className="hidden absolute top-2 right-2 p-1.5 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-50"
                  aria-label="Expand input"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                  </svg>
                </button>
              </div>
              <VoiceInputButton
                onTranscription={(text) => setInput((prev) => (prev ? prev + " " + text : text))}
                language={language}
                disabled={isLoading || sessionLoading || !!currentSession?.isCollapsed}
                ariaLabel="Voice input"
                className="!min-h-[48px] !min-w-[48px] sm:!min-h-[52px] sm:!min-w-[52px]"
              />
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || sessionLoading || !input.trim() || !!currentSession?.isCollapsed}
                aria-label="Send message"
                className="flex items-center justify-center w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] rounded-2xl bg-accent text-white text-[11px] sm:text-xs font-semibold transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shrink-0"
              >
                {isLoading ? (
                  <LoadingDots aria-label="Sending" />
                ) : (
                  "Send"
                )}
                </button>
              </div>
          </div>
        </div>
      </main>
      </div>

      {/* Expanded typing box modal */}
      {inputExpandModalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setInputExpandModalOpen(false)}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            aria-hidden
          >
            <div
              role="dialog"
              aria-modal
              aria-label="Compose message"
              className="pointer-events-auto w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-background rounded-3xl shadow-xl border border-neutral-200 dark:border-neutral-700/30 animate-fade-in-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-700/20 shrink-0">
                <h2 className="text-lg font-semibold text-foreground">Compose message</h2>
                <button
                  type="button"
                  onClick={() => setInputExpandModalOpen(false)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 text-neutral-600 dark:text-neutral-400"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
                <MentionInput
                  inputRef={inputExpandInputRef}
                  value={input}
                  onChange={setInput}
                  placeholderTopAligned
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setInputExpandModalOpen(false);
                      return;
                    }
                    if (
                      (e.key === "Enter" && !e.shiftKey) ||
                      (e.metaKey && e.key === "Enter") ||
                      (e.ctrlKey && e.key === "Enter")
                    ) {
                      e.preventDefault();
                      sendMessage();
                      setInputExpandModalOpen(false);
                    }
                  }}
                  mentalModels={Array.from(mentalModelsIndex.entries()).map(([id, name]) => ({
                    id,
                    name,
                  }))}
                  longTermMemories={longTermMemories.map((ltm) => ({
                    _id: ltm._id,
                    title: ltm.title,
                    enrichmentPrompt: ltm.enrichmentPrompt,
                  }))}
                  customConcepts={customConcepts.map((cc) => ({
                    _id: cc._id,
                    title: cc.title,
                    enrichmentPrompt: cc.enrichmentPrompt,
                  }))}
                  conceptGroups={conceptGroups.map((cg) => ({
                    _id: cg._id,
                    title: cg.title,
                  }))}
                  placeholder="/ to search"
                  placeholderMobile="/ to search"
                  disabled={isLoading || sessionLoading || !!currentSession?.isCollapsed}
                  className="w-full min-h-[200px] max-h-[50vh] py-4 px-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-neutral-300 dark:focus:border-neutral-600 text-base transition-all duration-200 placeholder:text-neutral-500 dark:placeholder:text-neutral-500 text-foreground overflow-y-auto flex-1"
                  onMentalModelClick={handleMentalModelClick}
                  onLtmClick={(id) => {
                    const ltm = longTermMemories.find((l) => l._id === id);
                    if (ltm) setLtmDetailModal(ltm);
                  }}
                  onCustomConceptClick={(id) => {
                    const cc = customConcepts.find((c) => c._id === id);
                    if (cc) setCcDetailModal(cc);
                  }}
                  onConceptGroupClick={(id) => {
                    const cg = conceptGroups.find((g) => g._id === id);
                    if (cg) {
                      fetch(`/api/me/concept-groups/${id}`)
                        .then((r) => r.ok ? r.json() : Promise.reject())
                        .then((data) => setCgDetailModal({ ...cg, concepts: data.concepts ?? [] }))
                        .catch(() => setCgDetailModal(cg));
                    }
                  }}
                  previewMap={previewMap}
                />
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <VoiceInputButton
                    onTranscription={(text) => setInput((prev) => (prev ? prev + " " + text : text))}
                    language={language}
                    disabled={isLoading || sessionLoading || !!currentSession?.isCollapsed}
                    ariaLabel="Voice input"
                    className="!min-h-[44px] !min-w-[44px] sm:!min-h-[48px] sm:!min-w-[48px]"
                  />
                  <button
                    onClick={() => {
                      sendMessage();
                      setInputExpandModalOpen(false);
                    }}
                    disabled={isLoading || sessionLoading || !input.trim() || !!currentSession?.isCollapsed}
                    aria-label="Send message"
                    className="flex items-center justify-center w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] rounded-2xl bg-accent text-white text-[11px] sm:text-xs font-semibold transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shrink-0"
                  >
                    {isLoading ? (
                      <LoadingDots aria-label="Sending" />
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Library - center modal (Claude-style), closable on all devices. Mental Models (concepts) available to anonymous users. */}
      {libraryPanelOpen && (libraryPanelOpen === "concepts" || !isAnonymous) && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/30 animate-fade-in ${featureTourStep === null ? "backdrop-blur-sm" : ""}`}
            onClick={() => setLibraryPanelOpen(null)}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            aria-hidden
          >
            <div
              className={`pointer-events-auto w-full max-h-[90vh] overflow-hidden flex flex-col bg-background rounded-3xl shadow-xl border border-neutral-200 dark:border-neutral-800 animate-fade-in-up ${
                libraryPanelOpen === "concepts"
                  ? "max-w-[var(--modal-library-concepts-decks-max-w)]"
                  : "max-w-[min(94vw,608px)]"
              }`}
              data-tour="library-modal"
            role="dialog"
            aria-modal
              aria-label={
                libraryPanelOpen === "conversations" ? "Conversations" :
                libraryPanelOpen === "concepts" ? "Mental Models" :
                libraryPanelOpen === "ltm" ? "Long-Term Memory" :
                libraryPanelOpen === "cc" ? "Concepts" :
                libraryPanelOpen === "cg" ? "Domains" :
                "Nuggets"
              }
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b-[0.75px] border-neutral-200/80 dark:border-white/8 shrink-0">
                <h2 className="text-lg font-semibold text-foreground">
                  {libraryPanelOpen === "conversations" ? "Conversations" :
                   libraryPanelOpen === "concepts" ? "Mental Models" :
                   libraryPanelOpen === "ltm" ? "Long-Term Memory" :
                   libraryPanelOpen === "cc" ? "Concepts" :
                   libraryPanelOpen === "cg" ? "Domains" :
                   "Nuggets"}
                </h2>
              <button
                type="button"
                onClick={() => setLibraryPanelOpen(null)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 text-neutral-600 dark:text-neutral-400"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {libraryPanelOpen === "conversations" && (
                <div className="space-y-4">
                  <Link
                    href="/chat/new"
                    onClick={() => { closeAllModalsExceptLeftPanel(); if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false); }}
                    className="flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-foreground border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    New conversation
                  </Link>
                  <div className="relative">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                      type="search"
                      placeholder="Search conversations"
                      value={sessionSearchQuery}
                      onChange={(e) => setSessionSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-neutral-300 dark:focus:border-neutral-600"
                      aria-label="Search conversations"
                    />
                  </div>
                  <nav className="space-y-px max-h-[60vh] overflow-y-auto">
                    {filteredSessions.length === 0 ? (
                      <div className="px-3 py-4 space-y-1">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          {sessionSearchQuery ? "No conversations match" : "No conversations yet"}
                        </p>
                        {!sessionSearchQuery && (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">
                            Ready to have a conversation whenever you say something
                          </p>
                        )}
                      </div>
                    ) : (
                      filteredSessions.map((s) => (
                        <div
                          key={s._id}
                          className={`group flex flex-col gap-0 rounded-2xl border-2 transition-colors duration-200 ${
                            currentSessionId === s._id
                              ? "border-neutral-300 dark:border-neutral-600"
                              : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500"
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <Link
                              href={`/chat/${s._id}`}
                              onClick={() => { setLibraryPanelOpen(null); setSidebarOpen(false); }}
                              className={`flex-1 min-w-0 flex items-center gap-2 py-2 px-3 truncate text-[15.6px] sm:text-[14px] ${
                                currentSessionId === s._id ? "font-medium text-foreground" : "text-neutral-800 dark:text-neutral-200"
                              }`}
                            >
                              <span className="flex-1 min-w-0">
                                <span className="block truncate">{s.title || "New conversation"}</span>
                                {s.updatedAt && (
                                  <span className="block text-xs text-neutral-500 dark:text-neutral-400 font-normal mt-0.5">
                                    {formatRelativeTime(s.updatedAt)}
                                  </span>
                                )}
                              </span>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-neutral-400 shrink-0 flex-shrink-0">
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteSessionConfirmModal(s);
                              }}
                              className="p-1.5 rounded opacity-50 hover:opacity-100 group-hover:opacity-100 text-neutral-500 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 active:scale-95 shrink-0"
                              aria-label="Delete conversation"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                                <path d="M10 11v6M14 11v6" />
                              </svg>
                            </button>
                          </div>
                          {s.mentalModelTags && s.mentalModelTags.length > 0 && !hiddenTagsSessions.has(s._id) && (
                            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1">
                              <div className="flex flex-wrap gap-1">
                                {s.mentalModelTags.map((id) => (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setLibraryPanelOpen(null);
                                      handleMentalModelClick(id);
                                    }}
                                    className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-medium bg-neutral-200 dark:bg-neutral-600 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-500 transition-all duration-200 active:scale-95"
                                  >
                                    {mentalModelsIndex.get(id) ?? id.replace(/_/g, " ")}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleTagsHidden(s._id);
                                }}
                                className="text-[9px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline-offset-2 hover:underline"
                              >
                                Hide tags
                              </button>
                            </div>
                          )}
                          {s.mentalModelTags && s.mentalModelTags.length > 0 && hiddenTagsSessions.has(s._id) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleTagsHidden(s._id);
                              }}
                              className="px-3 pb-1 text-left text-[9px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400"
                            >
                              Show {s.mentalModelTags.length} tags
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </nav>
                </div>
              )}
              {libraryPanelOpen === "concepts" && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                  <h2 className="text-lg font-semibold text-foreground">Models</h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Frameworks and biases, grouped by when to use. Star to add to Favorites.</p>
                    </div>
                    {!isAnonymous && (
                      <button
                        type="button"
                        onClick={() => {
                          setMmCreateModalOpen(true);
                          setMmCreateInput("");
                          setMmCreateGenerated(null);
                          setMmCreateError(null);
                        }}
                        className="shrink-0 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors"
                      >
                        + Create
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleTeachMeClick}
                    disabled={teachMeLoading}
                    className="flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-foreground border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-60"
                    aria-label="Learn a new mental model"
                  >
                    {teachMeLoading ? (
                      <LoadingDots aria-label="Loading" />
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                          <path d="M12 3v18" />
                        </svg>
                        <span>Learn a New Mental Model</span>
                      </>
                    )}
                  </button>
                  <input type="search" placeholder="Search mental models..." value={mmSearchQuery} onChange={(e) => setMmSearchQuery(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-foreground" aria-label="Search mental models" />
                  {(() => {
                    const q = mmSearchQuery.toLowerCase().trim();
                    const filteredModels = q
                      ? mentalModelsWithWhenToUse.filter((m) => {
                          const nameMatch = m.name.toLowerCase().includes(q);
                          const tagMatch = (m.when_to_use ?? []).some((t) =>
                            formatMmCategory(t).toLowerCase().includes(q)
                          );
                          const preview = mmPreviewMap.get(m.id);
                          const oneLinerMatch = preview?.oneLiner?.toLowerCase().includes(q);
                          const quickIntroMatch = preview?.quickIntro?.toLowerCase().includes(q);
                          return nameMatch || tagMatch || oneLinerMatch || quickIntroMatch;
                        })
                      : mentalModelsWithWhenToUse;

                    const byWhenToUse = new Map<string, { id: string; name: string }[]>();
                    const uncategorized: { id: string; name: string }[] = [];
                    for (const m of filteredModels) {
                      if (m.when_to_use.length === 0) {
                        uncategorized.push({ id: m.id, name: m.name });
                      } else {
                        for (const tag of m.when_to_use) {
                          const existing = byWhenToUse.get(tag) ?? [];
                          if (!existing.some((x) => x.id === m.id)) existing.push({ id: m.id, name: m.name });
                          byWhenToUse.set(tag, existing);
                        }
                      }
                    }

                    const whenToUseOrder = [...byWhenToUse.keys()].sort((a, b) => {
                      if (a === "custom") return -1;
                      if (b === "custom") return 1;
                      return formatMmCategory(a).localeCompare(formatMmCategory(b));
                    });
                    const categoryItems: { key: string; label: string; models: { id: string; name: string }[] }[] =
                      whenToUseOrder.map((tag) => ({
                        key: tag,
                        label: formatMmCategory(tag),
                        models: byWhenToUse.get(tag) ?? [],
                      }));
                    if (uncategorized.length > 0) {
                      categoryItems.push({
                        key: "uncategorized",
                        label: "Other",
                        models: uncategorized,
                      });
                    }

                    const decisionCategory = categoryItems.find(
                      (c) => normalizeMmCategory(c.label) === "decision-making"
                    );
                    const activeCategoryKey = categoryItems.some((c) => c.key === selectedMmCategory)
                      ? selectedMmCategory
                      : (decisionCategory?.key ?? categoryItems[0]?.key ?? "");
                    const activeCategory = categoryItems.find((c) => c.key === activeCategoryKey);
                    const activeModels = activeCategory?.models ?? [];

                    const renderMmCard = (id: string, name: string) => {
                      const preview = mmPreviewMap.get(id);
                      const backText = preview?.oneLiner ?? preview?.quickIntro ?? "Click to explore";
                      const isFavorite = mmFavorites.has(id);
                      return (
                        <div key={id} className="group/tile aspect-square [perspective:1000px] relative">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleMmFavorite(id); }}
                            className="absolute top-1 right-1 z-20 p-1 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 transition-colors touch-manipulation"
                            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                          >
                            {isFavorite ? (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-500 dark:text-amber-400" aria-hidden>
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-neutral-400 dark:text-neutral-500" aria-hidden>
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            )}
                          </button>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleMentalModelClick(id)}
                            onKeyDown={(e) => e.key === "Enter" && handleMentalModelClick(id)}
                            className="relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d] group-hover/tile:[transform:rotateY(180deg)] cursor-pointer"
                          >
                            <div className={`absolute inset-0 w-full h-full rounded-xl bg-neutral-100 dark:bg-neutral-800 p-3 flex items-center justify-center [backface-visibility:hidden] border border-neutral-200 dark:border-neutral-700 overflow-hidden pointer-events-none transition-opacity duration-300 ${isSafari ? "group-hover/tile:opacity-0" : ""} ${id.startsWith("custom_") ? "text-neutral-800 dark:text-neutral-200" : "text-white"}`} style={id.startsWith("custom_") ? {} : { backgroundImage: `url(/images/${id.replace(/_/g, "-")}.png)`, backgroundSize: "cover", backgroundPosition: "center" }} aria-hidden>
                              {!id.startsWith("custom_") && <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" aria-hidden />}
                              <span className="relative z-10 text-xs font-medium capitalize tracking-wide text-center line-clamp-3 drop-shadow-sm">{name}</span>
                            </div>
                            <div className="absolute inset-0 w-full h-full rounded-xl bg-foreground text-background px-3 flex items-center justify-center overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)] border border-foreground pointer-events-none" aria-hidden>
                              <span className="text-xs text-background/90 text-center line-clamp-4 w-full leading-tight">{backText}</span>
                            </div>
                          </div>
                        </div>
                      );
                    };
                    if (mentalModelsWithWhenToUse.length === 0) {
                      return <p className="text-xs text-neutral-500 dark:text-neutral-400">Loading mental models…</p>;
                    }
                    if (filteredModels.length === 0) {
                      return <p className="text-xs text-neutral-500 dark:text-neutral-400">{q ? "No mental models match." : "No mental models."}</p>;
                    }
                    return (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {categoryItems.map((cat) => (
                            <button
                              key={cat.key}
                              type="button"
                              onClick={() => setSelectedMmCategory(cat.key)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border-[0.75px] transition-colors ${
                                activeCategoryKey === cat.key
                                  ? "bg-foreground text-background border-foreground"
                                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-white/12 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                          </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                            {activeCategory?.label ?? "Category"}
                          </p>
                          <span className="text-[11px] text-neutral-500">{activeModels.length} models</span>
                        </div>
                        {activeModels.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2">
                            {activeModels.map(({ id, name }) => renderMmCard(id, name))}
                              </div>
                            ) : (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            No models in this category.
                              </p>
                          )}
                        </div>
                    );
                  })()}
                        </div>
              )}
              {mmCreateModalOpen && !isAnonymous && (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
                  onClick={(e) => e.target === e.currentTarget && setMmCreateModalOpen(false)}
                  role="dialog"
                  aria-modal
                  aria-labelledby="mm-create-title"
                >
                  <div
                    className="w-full max-w-md bg-background rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-4 space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 id="mm-create-title" className="text-base font-semibold text-foreground">Create mental model</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Describe the mental model or cognitive bias you want. The AI will generate the full structure.</p>
                    {!mmCreateGenerated ? (
                      <>
                        <textarea
                          value={mmCreateInput}
                          onChange={(e) => { setMmCreateInput(e.target.value); setMmCreateError(null); }}
                          placeholder="e.g. A mental model about sunk cost fallacy in personal projects"
                          rows={3}
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-foreground text-sm resize-y"
                        />
                        {mmCreateError && <p className="text-xs text-red-600 dark:text-red-400">{mmCreateError}</p>}
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setMmCreateModalOpen(false)}
                            className="px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                          >
                            Cancel
                              </button>
                          <button
                            type="button"
                            disabled={mmCreateLoading || !mmCreateInput.trim()}
                            onClick={async () => {
                              setMmCreateError(null);
                              setMmCreateLoading(true);
                              try {
                                const r = await fetch("/api/me/mental-models/generate", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ userInput: mmCreateInput.trim(), language }),
                                });
                                const data = await r.json().catch(() => ({}));
                                if (!r.ok) throw new Error(data?.error ?? "Generation failed");
                                setMmCreateGenerated(data);
                              } catch (err) {
                                setMmCreateError(err instanceof Error ? err.message : "Generation failed");
                              } finally {
                                setMmCreateLoading(false);
                              }
                            }}
                            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-xl hover:opacity-90 disabled:opacity-50"
                          >
                            {mmCreateLoading ? "Generating…" : "Generate"}
                          </button>
                                </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 bg-neutral-50 dark:bg-neutral-900 max-h-48 overflow-y-auto">
                          <p className="text-sm font-medium text-foreground">{String(mmCreateGenerated?.name ?? "")}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-3">{String(mmCreateGenerated?.quick_introduction ?? "")}</p>
                            </div>
                        {mmCreateError && <p className="text-xs text-red-600 dark:text-red-400">{mmCreateError}</p>}
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => { setMmCreateGenerated(null); setMmCreateError(null); }}
                            className="px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                          >
                            Back
                            </button>
                          <button
                            type="button"
                            disabled={mmCreateSaveLoading}
                            onClick={async () => {
                              setMmCreateError(null);
                              setMmCreateSaveLoading(true);
                              try {
                                const r = await fetch("/api/me/mental-models", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ model: mmCreateGenerated }),
                                });
                                const data = await r.json().catch(() => ({}));
                                if (!r.ok) throw new Error(data?.error ?? "Save failed");
                                setMmCreateModalOpen(false);
                                setMmCreateGenerated(null);
                                setMmCreateInput("");
                                setMentalModelsRefreshKey((k) => k + 1);
                                setSelectedMmCategory("custom");
                              } catch (err) {
                                setMmCreateError(err instanceof Error ? err.message : "Save failed");
                              } finally {
                                setMmCreateSaveLoading(false);
                              }
                            }}
                            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-xl hover:opacity-90 disabled:opacity-50"
                          >
                            {mmCreateSaveLoading ? "Saving…" : "Save"}
                          </button>
                              </div>
                      </>
                            )}
                          </div>
                </div>
              )}
              {libraryPanelOpen === "ltm" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Memory</h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Summaries of past conversations. Use when you want the agent to remember your context, preferences, and what you&apos;ve shared before.</p>
                  {longTermMemories.length > 0 ? (
                    <div className="space-y-2">
                      {longTermMemories.map((ltm) => (
                        <div
                          key={ltm._id}
                          className="flex items-start gap-3 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors relative"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setLtmDeleteConfirmModal(ltm);
                            }}
                            className="absolute top-2 right-2 z-20 p-1.5 rounded-lg opacity-70 hover:opacity-100 text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 touch-manipulation"
                            aria-label={`Delete ${ltm.title}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                              <path d="M10 11v6M14 11v6" />
                            </svg>
                          </button>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setLtmDetailModal(ltm)}
                            onKeyDown={(e) => e.key === "Enter" && setLtmDetailModal(ltm)}
                            className="flex-1 min-w-0 cursor-pointer pr-8"
                          >
                            <span className="text-sm font-medium line-clamp-1">{ltm.title}</span>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{ltm.summary || ltm.enrichmentPrompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Summarize a conversation to add it here.</p>
                  )}
                </div>
              )}
              {libraryPanelOpen === "cc" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Concepts</h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Ideas and contexts you define. Use when you want the agent to reference your own concepts, goals, or frameworks.</p>
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setCgCustomCreateModal(true)} className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors">+ Group</button>
                      <button type="button" onClick={() => { setCcCreateInput(""); setCcCreateStep("input"); setCcCreateDraft(null); setCcCreateModal(true); }} className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors">+ Add Concept</button>
                    </div>
                  </div>
                  {customConcepts.length > 0 ? (
                    <div className="space-y-3">
                      <input type="search" placeholder="Search concepts..." value={ccSearchQuery} onChange={(e) => setCcSearchQuery(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-foreground" aria-label="Search concepts" />
                      {(() => {
                        const q = ccSearchQuery.toLowerCase().trim();
                        const filteredConcepts = q ? customConcepts.filter((cc) => cc.title.toLowerCase().includes(q) || cc.summary.toLowerCase().includes(q) || cc.enrichmentPrompt.toLowerCase().includes(q)) : customConcepts;
                        const byGroupId = new Map<string, CustomConceptItem[]>();
                        for (const g of conceptGroups) {
                          const concepts = filteredConcepts.filter((cc) => (g.conceptIds ?? []).includes(cc._id));
                          byGroupId.set(g._id, concepts);
                        }
                        const standalone = filteredConcepts.filter((cc) => !conceptGroups.some((g) => (g.conceptIds ?? []).includes(cc._id)));
                        const toggleGroup = (key: string) => setCcGroupCollapsed((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
                        const hasGroupFilter = ccSelectedGroupKeys.size > 0;
                        const isGroupVisible = (key: string) => !hasGroupFilter || ccSelectedGroupKeys.has(key);
                        const toggleGroupFilter = (key: string) => {
                          setCcSelectedGroupKeys((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          });
                        };
                        if (filteredConcepts.length === 0 && conceptGroups.length === 0) return <p className="text-xs text-neutral-500">{q ? "No concepts match" : "No concepts"}</p>;
                        return (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setCcSelectedGroupKeys(new Set())}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border-[0.75px] transition-colors ${
                                  !hasGroupFilter
                                    ? "bg-foreground text-background border-foreground"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-white/12 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                }`}
                              >
                                All
                              </button>
                              {conceptGroups.map((cg) => {
                                const selected = ccSelectedGroupKeys.has(cg._id);
                                return (
                                  <button
                                    key={`chip-${cg._id}`}
                                    type="button"
                                    onClick={() => toggleGroupFilter(cg._id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-[0.75px] transition-colors ${
                                      selected
                                        ? "bg-foreground text-background border-foreground"
                                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-white/12 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                    }`}
                                  >
                                    {cg.title}
                                  </button>
                                );
                              })}
                              {standalone.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleGroupFilter("Standalone")}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border-[0.75px] transition-colors ${
                                    ccSelectedGroupKeys.has("Standalone")
                                      ? "bg-foreground text-background border-foreground"
                                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-white/12 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                  }`}
                                >
                                  Standalone
                                </button>
                              )}
                            </div>
                            {conceptGroups.filter((cg) => isGroupVisible(cg._id)).map((cg, i) => {
                              const concepts = byGroupId.get(cg._id) ?? [];
                              const isCollapsed = ccGroupCollapsed.has(cg._id);
                              const isEmpty = (cg.conceptIds?.length ?? 0) === 0 || concepts.length === 0;
                              return (
                                <div key={cg._id} className={i === 0 ? "pt-0" : "border-t border-neutral-200 dark:border-neutral-700 pt-2 mt-2"}>
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <button type="button" data-no-modal-border="true" onClick={() => toggleGroup(cg._id)} className="flex items-center justify-between flex-1 min-w-0 text-left px-1">
                                      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide truncate">{cg.title}</p>
                                      <span className="text-[10px] shrink-0 ml-1">{isCollapsed ? "▶" : "▼"}</span>
                                  </button>
                                    {isEmpty && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCgDeleteConfirmModal(cg);
                                        }}
                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0 -mr-1"
                                        aria-label={`Delete ${cg.title}`}
                                      >
                                        <TrashIcon className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                  {!isCollapsed && (
                                    <div className="space-y-2">
                                      {concepts.length === 0 ? (
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 py-2">No concepts in this group yet.</p>
                                      ) : concepts.map((cc) => (
                                        <div key={cc._id} className="flex items-start gap-3 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors relative">
                                          <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setCcDeleteConfirmModal(cc); }} className="absolute top-2 right-2 z-20 p-1.5 rounded-lg opacity-70 hover:opacity-100 text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 touch-manipulation" aria-label={`Delete ${cc.title}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" /><path d="M10 11v6M14 11v6" /></svg>
                                          </button>
                                          <div role="button" tabIndex={0} onClick={() => setCcDetailModal(cc)} onKeyDown={(e) => e.key === "Enter" && setCcDetailModal(cc)} className="flex-1 min-w-0 cursor-pointer pr-8">
                                            <span className="text-sm font-medium line-clamp-1">{cc.title}</span>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{cc.summary || cc.enrichmentPrompt}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {standalone.length > 0 && isGroupVisible("Standalone") && (
                              <div className={conceptGroups.length === 0 ? "pt-0" : "border-t border-neutral-200 dark:border-neutral-700 pt-2 mt-2"}>
                                <button type="button" data-no-modal-border="true" onClick={() => toggleGroup("Standalone")} className="flex items-center justify-between w-full text-left px-1 mb-1.5">
                                  <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide">Standalone</p>
                                  <span className="text-[10px]">{ccGroupCollapsed.has("Standalone") ? "▶" : "▼"}</span>
                                </button>
                                {!ccGroupCollapsed.has("Standalone") && (
                                  <div className="space-y-2">
                                    {standalone.map((cc) => (
                                      <div key={cc._id} className="flex items-start gap-3 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors relative">
                                        <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setCcDeleteConfirmModal(cc); }} className="absolute top-2 right-2 z-20 p-1.5 rounded-lg opacity-70 hover:opacity-100 text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 touch-manipulation" aria-label={`Delete ${cc.title}`}>
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" /><path d="M10 11v6M14 11v6" /></svg>
                                        </button>
                                        <div role="button" tabIndex={0} onClick={() => setCcDetailModal(cc)} onKeyDown={(e) => e.key === "Enter" && setCcDetailModal(cc)} className="flex-1 min-w-0 cursor-pointer pr-8">
                                          <span className="text-sm font-medium line-clamp-1">{cc.title}</span>
                                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{cc.summary || cc.enrichmentPrompt}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Create a custom concept to remember anything you want.</p>
                  )}
                </div>
              )}
              {libraryPanelOpen === "cg" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Domains</h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Domain groups created via AI. Use when you want the agent to think in terms of a topic (e.g. finance, health) with related concepts.</p>
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => { setCgCreateDomain(""); setCgCreateStep(1); setCgCreateQuestions([]); setCgCreateAnswers({}); setCgCreateConcepts([]); setCgCreateModal(true); }} className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors">+ Domain</button>
                    <button type="button" onClick={() => { setCcYoutubeUrl(""); setCcYoutubeTranscriptId(null); setCcYoutubeExtractPrompt(""); setCcYoutubeResult(null); setCcYoutubeError(null); setCcYoutubeModal(true); }} className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors">+ Add From YouTube Transcript</button>
                  </div>
                  {conceptGroups.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {conceptGroups.map((cg) => {
                        const isEmpty = (cg.conceptIds?.length ?? 0) === 0;
                        const openGroup = () => fetch(`/api/me/concept-groups/${cg._id}`).then((r) => r.ok ? r.json() : Promise.reject()).then((data) => setCgDetailModal({ ...cg, concepts: data.concepts ?? [] })).catch(() => setCgDetailModal(cg));
                        return (
                          <div
                            key={cg._id}
                            role="button"
                            tabIndex={0}
                            onClick={openGroup}
                            onKeyDown={(e) => e.key === "Enter" && openGroup()}
                            className="relative flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors text-center"
                          >
                            {isEmpty && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setCgDeleteConfirmModal(cg);
                                }}
                                className="absolute top-2 right-2 z-10 p-1.5 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                aria-label={`Delete ${cg.title}`}
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                              <div className="absolute inset-0 rounded-lg bg-neutral-200 dark:bg-neutral-700" style={{ transform: "translate(0,0)" }} />
                              <div className="absolute inset-0 rounded-lg bg-neutral-300 dark:bg-neutral-600" style={{ transform: "translate(3px,3px)" }} />
                              <div className="absolute inset-0 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center" style={{ transform: "translate(6px,6px)" }}>
                                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{(cg.conceptIds?.length ?? 0) || "—"}</span>
                              </div>
                            </div>
                            <p className="text-sm font-medium truncate w-full">{cg.title}</p>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{cg.conceptIds?.length ?? 0} concepts</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Create domains via AI or groups by selecting existing concepts.</p>
                  )}
                  {savedTranscripts.length > 0 && (
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">My Transcripts</p>
                      <div className="space-y-2">
                        {savedTranscripts.map((t) => (
                          <div
                            key={t._id}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30"
                          >
                            <div
                              className="min-w-0 flex-1 cursor-pointer"
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                fetch(`/api/me/transcripts/${t._id}`)
                                  .then((r) => r.ok ? r.json() : Promise.reject())
                                  .then((data) => setTranscriptModalTranscript({ id: t._id, videoId: data.videoId ?? t.videoId, videoTitle: data.videoTitle ?? t.videoTitle, channel: data.channel ?? t.channel, transcriptText: data.transcriptText ?? "" }))
                                  .catch(() => {})
                              }
                              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLElement).click()}
                            >
                              <a
                                href={`https://www.youtube.com/watch?v=${t.videoId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm font-medium truncate block hover:underline text-foreground"
                              >
                                {t.videoTitle || t.videoId}
                              </a>
                              {t.channel && <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">{t.channel}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setCcYoutubeTranscriptId(t._id);
                                  setCcYoutubeUrl("");
                                  setCcYoutubeResult(null);
                                  setCcYoutubeError(null);
                                  setCcYoutubeModal(true);
                                }}
                                className="px-2 py-1.5 text-xs font-medium text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                              >
                                Re-extract
                              </button>
                              <button
                                type="button"
                                onClick={() => fetch(`/api/me/transcripts/${t._id}`, { method: "DELETE" }).then(() => refetchTranscripts())}
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                aria-label={`Delete transcript ${t.videoTitle || t.videoId}`}
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                </div>
              )}
                </div>
              )}
              {libraryPanelOpen === "nuggets" && (
                <div className="space-y-4">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Save impactful quotes, words, and snippets. Paste from clipboard or highlight text in conversations.</p>
                  {nuggetFormOpen === "panel" ? (
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        <textarea value={nuggetCreateContent} onChange={(e) => setNuggetCreateContent(e.target.value)} placeholder="Paste or type your nugget..." rows={3} className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y" />
                        <button type="button" onClick={async () => { if (!nuggetCreateContent.trim() || nuggetImproveLoading) return; setNuggetImproveLoading(true); try { const res = await fetch("/api/me/nuggets/improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: nuggetCreateContent }) }); const data = await res.json(); if (data.improved) setNuggetCreateContent(data.improved); } catch { /* ignore */ } finally { setNuggetImproveLoading(false); } }} disabled={!nuggetCreateContent.trim() || nuggetImproveLoading} className="p-2 rounded-lg text-neutral-500 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 shrink-0" title="Improve with LLM" aria-label="Improve with LLM"><AIGenerateIcon className="w-4 h-4" /></button>
                      </div>
                      <div className="flex gap-1">
                        <input type="text" value={nuggetCreateSource} onChange={(e) => setNuggetCreateSource(e.target.value)} placeholder="Source (optional)" className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20" />
                        <button type="button" onClick={async () => { if (!nuggetCreateContent.trim() || nuggetSuggestSourceLoading) return; setNuggetSuggestSourceLoading(true); try { const res = await fetch("/api/me/nuggets/suggest-source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: nuggetCreateContent }) }); const data = await res.json(); if (data.source) setNuggetCreateSource(data.source); } catch { /* ignore */ } finally { setNuggetSuggestSourceLoading(false); } }} disabled={!nuggetCreateContent.trim() || nuggetSuggestSourceLoading} className="p-2 rounded-lg text-neutral-500 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 shrink-0" title="Suggest source" aria-label="Suggest source"><SparklesIcon className="w-4 h-4" /></button>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setNuggetFormOpen(null); setNuggetCreateContent(""); setNuggetCreateSource(""); }} className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">Cancel</button>
                        <button disabled={!nuggetCreateContent.trim() || nuggetCreateLoading} onClick={async () => { if (!nuggetCreateContent.trim() || nuggetCreateLoading) return; setNuggetCreateLoading(true); try { await fetch("/api/me/nuggets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: nuggetCreateContent.trim(), source: nuggetCreateSource.trim() || undefined }) }); refetchNuggets(); setNuggetFormOpen(null); setNuggetCreateContent(""); setNuggetCreateSource(""); } catch { /* ignore */ } finally { setNuggetCreateLoading(false); } }} className="px-3 py-1.5 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-50">{nuggetCreateLoading ? "Saving..." : "Save"}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => { setNuggetCreateContent(""); setNuggetCreateSource(""); setNuggetFormOpen("panel"); setNuggetFormPosition(null); }} className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors">+ Add Nugget</button>
                    </div>
                  )}
                  {nuggets.length > 0 ? (
                    <div className="space-y-2">
                      {nuggets.map((n) => (
                        <div key={n._id} className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                          {n.source && <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">{n.source}</p>}
                          {nuggetLearnId === n._id && nuggetLearnExplanation && (
                            <div className="mt-2 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800/70 text-xs text-foreground">
                              {nuggetLearnExplanation}
                            </div>
                          )}
                          <div className="flex gap-1 justify-end mt-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (nuggetLearnId === n._id) { setNuggetLearnId(null); setNuggetLearnExplanation(null); return; }
                                setNuggetLearnId(n._id);
                                setNuggetLearnExplanation(null);
                                try {
                                  const res = await fetch("/api/me/nuggets/learn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: n.content }) });
                                  const data = await res.json();
                                  if (data.explanation) setNuggetLearnExplanation(data.explanation);
                                } catch { setNuggetLearnExplanation("Failed to load."); }
                              }}
                              className="px-2 py-1 text-xs font-medium text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                            >
                              {nuggetLearnId === n._id && !nuggetLearnExplanation ? "Loading..." : nuggetLearnId === n._id ? "Hide" : "Learn this Nugget"}
                            </button>
                            <button type="button" onClick={() => fetch(`/api/me/nuggets/${n._id}`, { method: "DELETE" }).then(() => refetchNuggets())} className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" aria-label="Delete nugget"><TrashIcon className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : nuggetFormOpen !== "panel" && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">No nuggets yet. Add one to get started.</p>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </>
      )}

      {nuggetFormOpen === "selection" && nuggetFormPosition && (
        <>
          <div
            className="fixed inset-0 z-[49] bg-black/20 animate-fade-in"
            onClick={() => { if (!nuggetCreateLoading) { setNuggetFormOpen(null); setNuggetFormPosition(null); setNuggetCreateContent(""); setNuggetCreateSource(""); } }}
            aria-hidden
          />
          <div
            className="fixed z-50 w-[min(360px,calc(100vw-2rem))] animate-fade-in rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background shadow-xl p-3"
            style={{ left: nuggetFormPosition.x, top: nuggetFormPosition.y }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Save nugget</span>
            <button type="button" onClick={() => { setNuggetFormOpen(null); setNuggetFormPosition(null); setNuggetCreateContent(""); setNuggetCreateSource(""); }} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">✕</button>
          </div>
          <div className="space-y-2">
            <div className="flex gap-1">
              <textarea value={nuggetCreateContent} onChange={(e) => setNuggetCreateContent(e.target.value)} placeholder="Paste or type..." rows={3} className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y" />
              <button type="button" onClick={async () => { if (!nuggetCreateContent.trim() || nuggetImproveLoading) return; setNuggetImproveLoading(true); try { const res = await fetch("/api/me/nuggets/improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: nuggetCreateContent }) }); const data = await res.json(); if (data.improved) setNuggetCreateContent(data.improved); } catch { /* ignore */ } finally { setNuggetImproveLoading(false); } }} disabled={!nuggetCreateContent.trim() || nuggetImproveLoading} className="p-2 rounded-lg text-neutral-500 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 shrink-0" title="Improve with LLM" aria-label="Improve with LLM"><AIGenerateIcon className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-1">
              <input type="text" value={nuggetCreateSource} onChange={(e) => setNuggetCreateSource(e.target.value)} placeholder="Source (optional)" className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20" />
              <button type="button" onClick={async () => { if (!nuggetCreateContent.trim() || nuggetSuggestSourceLoading) return; setNuggetSuggestSourceLoading(true); try { const res = await fetch("/api/me/nuggets/suggest-source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: nuggetCreateContent }) }); const data = await res.json(); if (data.source) setNuggetCreateSource(data.source); } catch { /* ignore */ } finally { setNuggetSuggestSourceLoading(false); } }} disabled={!nuggetCreateContent.trim() || nuggetSuggestSourceLoading} className="p-2 rounded-lg text-neutral-500 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 shrink-0" title="Suggest source" aria-label="Suggest source"><SparklesIcon className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => { setNuggetFormOpen(null); setNuggetFormPosition(null); setNuggetCreateContent(""); setNuggetCreateSource(""); }} className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">Cancel</button>
            <button disabled={!nuggetCreateContent.trim() || nuggetCreateLoading} onClick={async () => { if (!nuggetCreateContent.trim() || nuggetCreateLoading) return; setNuggetCreateLoading(true); try { await fetch("/api/me/nuggets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: nuggetCreateContent.trim(), source: nuggetCreateSource.trim() || undefined }) }); refetchNuggets(); setNuggetFormOpen(null); setNuggetFormPosition(null); setNuggetCreateContent(""); setNuggetCreateSource(""); } catch { /* ignore */ } finally { setNuggetCreateLoading(false); } }} className="px-3 py-1.5 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-50">{nuggetCreateLoading ? "Saving..." : "Save"}</button>
          </div>
        </div>
        </>
      )}

      {transcriptModalTranscript && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setTranscriptModalTranscript(null)}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative p-4 pr-12 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
              <button
                type="button"
                onClick={() => setTranscriptModalTranscript(null)}
                className="absolute top-4 right-4 p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
              <h2 className="font-semibold text-lg truncate">{transcriptModalTranscript.videoTitle || "Transcript"}</h2>
              {transcriptModalTranscript.channel && <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate mt-0.5">{transcriptModalTranscript.channel}</p>}
              <a
                href={`https://www.youtube.com/watch?v=${transcriptModalTranscript.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
              >
                Open on YouTube
              </a>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-[65ch] mx-auto text-[15px] leading-relaxed text-foreground">
                {(() => {
                  const t = transcriptModalTranscript.transcriptText.trim();
                  if (!t) return null;
                  const hasParagraphs = /\n\n|\n/.test(t);
                  let paragraphs: string[];
                  if (hasParagraphs) {
                    paragraphs = t.split(/\n\n+/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
                  } else {
                    const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
                    paragraphs = [];
                    for (let i = 0; i < sentences.length; i += 3) {
                      paragraphs.push(sentences.slice(i, i + 3).join(" "));
                    }
                    if (paragraphs.length === 0 && t) paragraphs = [t];
                  }
                  return paragraphs.map((p, i) => (
                    <p key={i} className="mb-4 last:mb-0">
                      {p.split(/\s*>>\s*/).filter(Boolean).map((segment, j) => (
                        <span key={j}>
                          {j > 0 && (
                            <>
                              <br />
                              <span className="text-amber-500/90 dark:text-amber-400/80 font-medium select-none mr-1" aria-hidden>»</span>
                            </>
                          )}
                          {segment}
                        </span>
                      ))}
                    </p>
                  ));
                })()}
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setCcYoutubeTranscriptId(transcriptModalTranscript.id);
                  setCcYoutubeUrl("");
                  setCcYoutubeResult(null);
                  setCcYoutubeError(null);
                  setTranscriptModalTranscript(null);
                  setCcYoutubeModal(true);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Re-extract
              </button>
              <button
                type="button"
                onClick={() => {
                  fetch(`/api/me/transcripts/${transcriptModalTranscript.id}`, { method: "DELETE" })
                    .then(() => refetchTranscripts())
                    .then(() => setTranscriptModalTranscript(null));
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {summarizeLanguageModal && currentSessionId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setSummarizeLanguageModal(null)}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-md w-full overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="font-semibold text-lg">Summarize and Collapse</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Which language should the summary be in?
              </p>
            </div>
            <div className="p-4 space-y-4">
              <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Language
              </label>
              <select
                value={summarizeLanguageModal.selectedLanguage}
                onChange={(e) =>
                  setSummarizeLanguageModal((prev) =>
                    prev ? { ...prev, selectedLanguage: e.target.value as LanguageCode } : null
                  )
                }
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              >
                {LANGUAGES.map(({ code, name }) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
              <button
                onClick={() => setSummarizeLanguageModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSummarizeLoading(true);
                  try {
                    const res = await fetch(`/api/sessions/${currentSessionId}/summarize`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        language: summarizeLanguageModal.selectedLanguage,
                        collapse: false,
                      }),
                    });
                    if (!res.ok) throw new Error("Failed");
                    const data = await res.json();
                    setSummarizeLanguageModal(null);
                    setSummarizeModal({
                      summary: data.summary,
                      enrichmentPrompt: data.enrichmentPrompt,
                      longTermMemoryId: data.longTermMemory._id,
                    });
                    setSummarizeSuccess(true);
                    setTimeout(() => setSummarizeSuccess(false), 2000);
                    refetchSessions();
                    refetchLongTermMemories();
                  } catch {
                    setSummarizeLanguageModal(null);
                  } finally {
                    setSummarizeLoading(false);
                  }
                }}
                disabled={summarizeLoading}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity border border-neutral-200 dark:border-neutral-600 disabled:opacity-60"
              >
                {summarizeLoading ? "Summarizing…" : "Summarize"}
              </button>
            </div>
          </div>
        </div>
      )}

      {summarizeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => { setSummarizeModal(null); setTtsHighlight(null); }}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="font-semibold text-lg">Summarize and Collapse</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Edit the enrichment prompt below to customize what future conversations will remember.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100 min-w-0">
                    Summary
                  </label>
                  <div className="flex items-center gap-1">
                    <TTSButton
                      text={summarizeModal.summary}
                      showOnHover={false}
                      ariaLabel="Listen to summary"
                      onTtsProgress={(charEnd) => setTtsHighlight({ textId: "summarize-modal-summary", charEnd })}
                      onTtsEnd={() => setTtsHighlight(null)}
                    />
                  <CopyButton text={summarizeModal.summary} aria-label="Copy summary" />
                </div>
                </div>
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-3 text-sm text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap max-h-40 overflow-y-auto" dir={isRtlLanguage(language) ? "rtl" : undefined}>
                  {ttsHighlight && "textId" in ttsHighlight && ttsHighlight.textId === "summarize-modal-summary" ? (
                    <TtsHighlightedText text={summarizeModal.summary} charEnd={ttsHighlight.charEnd} />
                  ) : (
                    summarizeModal.summary
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Enrichment prompt (for AI coach context)
                </label>
                  <TTSButton
                    text={summarizeModal.enrichmentPrompt}
                    showOnHover={false}
                    ariaLabel="Listen to enrichment prompt"
                    onTtsProgress={(charEnd) => setTtsHighlight({ textId: "summarize-modal-enrichment", charEnd })}
                    onTtsEnd={() => setTtsHighlight(null)}
                  />
                </div>
                {ttsHighlight && "textId" in ttsHighlight && ttsHighlight.textId === "summarize-modal-enrichment" ? (
                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-3 text-sm text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap" dir={isRtlLanguage(language) ? "rtl" : undefined}>
                    <TtsHighlightedText text={summarizeModal.enrichmentPrompt} charEnd={ttsHighlight.charEnd} />
                  </div>
                ) : (
                <textarea
                  value={summarizeModal.enrichmentPrompt}
                  onChange={(e) =>
                    setSummarizeModal((prev) =>
                      prev ? { ...prev, enrichmentPrompt: e.target.value } : null
                    )
                  }
                  rows={4}
                  dir={isRtlLanguage(language) ? "rtl" : undefined}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background dark:bg-neutral-900 text-sm text-foreground dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  placeholder="1 dense sentence, max ~25 words (e.g. User weighing job change; values work-life balance.)"
                />
                )}
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
              <button
                onClick={async () => {
                  try {
                    await fetch(`/api/me/long-term-memory/${summarizeModal.longTermMemoryId}`, {
                      method: "DELETE",
                    });
                  } finally {
                    setSummarizeModal(null);
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const patchRes = await fetch(
                      `/api/me/long-term-memory/${summarizeModal.longTermMemoryId}`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          enrichmentPrompt: summarizeModal.enrichmentPrompt,
                        }),
                      }
                    );
                    if (!patchRes.ok) return;
                    const collapseRes = await fetch(`/api/sessions/${currentSessionId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        isCollapsed: true,
                        longTermMemoryId: summarizeModal.longTermMemoryId,
                      }),
                    });
                    if (collapseRes.ok) {
                      const ltmRes = await fetch(`/api/me/long-term-memory/${summarizeModal.longTermMemoryId}`);
                      const ltm = ltmRes.ok ? await ltmRes.json() : null;
                      setCurrentSession((prev) =>
                        prev ? { ...prev, isCollapsed: true, longTermMemoryId: summarizeModal.longTermMemoryId } : null
                      );
                      setCollapsedSummary(ltm);
                      setMessages([]);
                      setSummarizeSuccess(true);
                      setTimeout(() => setSummarizeSuccess(false), 2000);
                      refetchSessions();
                      refetchLongTermMemories();
                    }
                  } finally {
                    setSummarizeModal(null);
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity border border-neutral-200 dark:border-neutral-600"
              >
                Save and Collapse
              </button>
            </div>
          </div>
        </div>
      )}

      {ltmDetailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => { setLtmDetailModal(null); setTtsHighlight(null); }}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="font-semibold text-lg truncate pr-2">{ltmDetailModal.title}</h2>
              <button
                onClick={() => setLtmDetailModal(null)}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100 min-w-0">
                    Summary
                  </label>
                  <div className="flex items-center gap-1">
                    <TTSButton
                      text={`${ltmDetailModal.title}\n\n${ltmDetailModal.summary}`}
                      showOnHover={false}
                      ariaLabel="Listen to summary"
                      onTtsProgress={(charEnd) => setTtsHighlight({ textId: `ltm-${ltmDetailModal._id}-summary`, charEnd })}
                      onTtsEnd={() => setTtsHighlight(null)}
                    />
                  <CopyButton
                    text={`${ltmDetailModal.title}\n\n${ltmDetailModal.summary}`}
                    aria-label="Copy summary"
                  />
                </div>
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap" dir={isRtlLanguage(language) ? "rtl" : undefined}>
                  {ttsHighlight && "textId" in ttsHighlight && ttsHighlight.textId === `ltm-${ltmDetailModal._id}-summary` ? (
                    <TtsHighlightedText text={`${ltmDetailModal.title}\n\n${ltmDetailModal.summary}`.trim()} charEnd={ttsHighlight.charEnd} />
                  ) : (
                    ltmDetailModal.summary
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Enrichment prompt
                </label>
                  <TTSButton
                    text={ltmDetailModal.enrichmentPrompt}
                    showOnHover={false}
                    ariaLabel="Listen to enrichment prompt"
                    onTtsProgress={(charEnd) => setTtsHighlight({ textId: `ltm-${ltmDetailModal._id}-enrichment`, charEnd })}
                    onTtsEnd={() => setTtsHighlight(null)}
                  />
                </div>
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200" dir={isRtlLanguage(language) ? "rtl" : undefined}>
                  {ttsHighlight && "textId" in ttsHighlight && ttsHighlight.textId === `ltm-${ltmDetailModal._id}-enrichment` ? (
                    <TtsHighlightedText text={ltmDetailModal.enrichmentPrompt} charEnd={ttsHighlight.charEnd} />
                  ) : (
                    ltmDetailModal.enrichmentPrompt
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <GenerateRelevantMessageButton
                  label="Generate Relevant Message"
                  expandOnHover={false}
                  aria-label="Generate Relevant Message"
                  onClick={async () => {
                    const suggestion = `${ltmDetailModal.title}\n\n${ltmDetailModal.summary}\n\nEnrichment: ${ltmDetailModal.enrichmentPrompt}`;
                    setGenerateModal({ type: "ltm", generatedText: "", loading: true });
                    try {
                      const res = await fetch("/api/generate-relevant-prompt", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          suggestion,
                          messages: messages.map((m) => ({ role: m.role, content: m.content })),
                        }),
                      });
                      const data = await res.json();
                      setGenerateModal((prev) =>
                        prev ? { ...prev, generatedText: data.text ?? suggestion, loading: false } : null
                      );
                    } catch {
                      setGenerateModal((prev) =>
                        prev ? { ...prev, generatedText: suggestion, loading: false } : null
                      );
                    }
                  }}
                />
                <Link
                  href={`/chat/${ltmDetailModal.sourceSessionId}`}
                  onClick={() => setLtmDetailModal(null)}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  View conversation →
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setLtmDeleteConfirmModal(ltmDetailModal);
                    setLtmDetailModal(null);
                  }}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Delete from long-term memory
                </button>
              </div>
              {generateModal?.type === "ltm" && (
                <div
                  className="absolute inset-0 flex items-center justify-center p-4 bg-black/50 rounded-3xl z-10"
                  onClick={() => setGenerateModal(null)}
                >
                  <div
                    className="bg-background rounded-2xl shadow-xl max-w-md w-full p-5 border border-neutral-200 dark:border-neutral-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="font-semibold text-base mb-3">Generated message</h3>
                    {generateModal.loading ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-neutral-500 dark:text-neutral-400">
                        <span className="inline-block w-4 h-4 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                        <span>Generating…</span>
                      </div>
                    ) : (
                      <textarea
                        value={generateModal.generatedText}
                        onChange={(e) =>
                          setGenerateModal((prev) =>
                            prev ? { ...prev, generatedText: e.target.value } : null
                          )
                        }
                        className="w-full min-h-[100px] px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-background text-sm resize-y"
                        placeholder="Generated message…"
                      />
                    )}
                    <div className="flex gap-2 justify-end mt-4">
                      <button
                        onClick={() => setGenerateModal(null)}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const text = generateModal.generatedText.trim();
                          if (text) {
                            sendMessage(text);
                            setGenerateModal(null);
                            setLtmDetailModal(null);
                          }
                        }}
                        disabled={generateModal.loading || !generateModal.generatedText.trim()}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setSettingsOpen(false)}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            aria-hidden
          >
            <div
              className="pointer-events-auto w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-background rounded-3xl shadow-xl border border-neutral-200 dark:border-neutral-800 animate-fade-in-up"
              role="dialog"
              aria-modal
              aria-labelledby="settings-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 shrink-0">
                <h2 id="settings-title" className="text-lg font-semibold text-foreground">Settings</h2>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 text-neutral-600 dark:text-neutral-400"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0 space-y-6">
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">Extension</h3>
                  <Link
                    href="/extension"
                    onClick={() => setSettingsOpen(false)}
                    className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#f2b37d] bg-transparent text-[#c96b25] dark:text-[#f2b37d] text-sm font-semibold hover:bg-[#fff1df] dark:hover:bg-[#3a2415] transition-colors"
                  >
                    <ChromeIcon className="w-[18px] h-[18px]" />
                    Install Extension
                  </Link>
                </section>

                <section>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">Account</h3>
                  {!isAnonymous && user ? (
                    <div
                      ref={profileTriggerRef}
                      role="button"
                      tabIndex={0}
                      aria-label="Account menu"
                      className="inline-flex items-center gap-2.5 min-w-0 rounded-xl border-[0.75px] border-neutral-200 dark:border-white/12 hover:border-neutral-300 dark:hover:border-white/18 px-3 py-2 w-fit transition-colors cursor-pointer"
                      onClick={(e) => {
                        const trigger = (e.currentTarget as HTMLElement).querySelector("button");
                        if (trigger && !trigger.contains(e.target as Node)) {
                          trigger.click();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          (e.currentTarget as HTMLElement).querySelector("button")?.click();
                        }
                      }}
                    >
                      <UserButton
                        appearance={{
                          elements: {
                            rootBox: "shrink-0",
                            avatarBox: "w-8 h-8 ring-0",
                          },
                        }}
                      />
                      <span className="text-sm font-medium text-foreground truncate">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.primaryEmailAddress?.emailAddress ?? "Account"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/sign-in"
                        onClick={() => setSettingsOpen(false)}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium border-2 border-neutral-300 dark:border-neutral-600/35 hover:border-neutral-400 dark:hover:border-neutral-500/45 text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/sign-up"
                        onClick={() => setSettingsOpen(false)}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
                      >
                        Create account
                      </Link>
                    </div>
                  )}
                </section>

                <section className="pt-6 border-t-[0.75px] border-neutral-100 dark:border-white/8">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">Conversation</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Language and tone for your conversations.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Language</label>
                      <div className="flex flex-wrap gap-2">
                        {LANGUAGES.map(({ code, name }) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => setLanguage(code)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              language === code
                                ? "bg-foreground text-background"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-[0.75px] border-neutral-200/60 dark:border-white/12"
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Voice style</label>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                        {USER_TYPES.find((t) => t.id === userType)?.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {USER_TYPES.map(({ id, name }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setUserType(id)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              userType === id
                                ? "bg-foreground text-background"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-[0.75px] border-neutral-200/60 dark:border-white/12"
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="pt-6 border-t-[0.75px] border-neutral-100 dark:border-white/8">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">Audio</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Speed for text-to-speech playback.</p>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Playback speed</label>
                    <div className="flex flex-wrap gap-2">
                      {[0.5, 1, 1.5, 2].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setTtsSpeed(s)}
                          className={`px-4 py-2 rounded-full text-sm font-medium tabular-nums transition-colors ${
                            ttsSpeed === s
                              ? "bg-foreground text-background"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-[0.75px] border-neutral-200/60 dark:border-white/12"
                          }`}
                        >
                          {s}×
                        </button>
                      ))}
                    </div>
                  </div>
                  {!isAnonymous && (
                    <div className="mt-5">
                      <label className="block text-sm font-medium text-foreground mb-2">Personalized Reflection Voice</label>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                        Hear deeper reflections and second-order insights in your own voice. This can improve retention and make structured self-review feel more natural. Record a clip or upload 1-6 files (MP3, WAV, WebM, or OGG).
                      </p>
                      {clonedVoices.length > 0 && (
                        <div className="mb-3 space-y-2">
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Language voice assignments</p>
                          {(() => {
                            const latestForLanguage = clonedVoices
                              .filter((v) => v.language === language)
                              .at(-1);
                            const latestForAll = clonedVoices
                              .filter((v) => v.language === "all")
                              .at(-1);
                            const activeVoice = latestForLanguage ?? latestForAll ?? null;
                            return (
                          <div className="space-y-1.5">
                            {clonedVoices.map((v) => (
                              <div key={`${v.voiceId}:${v.language}`} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200/70 dark:border-white/12 bg-neutral-50 dark:bg-neutral-900 px-3 py-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{v.name}</p>
                                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    {v.language === "all"
                                      ? "All languages"
                                      : (LANGUAGES.find((l) => l.code === v.language)?.name ?? v.language)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {activeVoice &&
                                    v.voiceId === activeVoice.voiceId &&
                                    v.language === activeVoice.language && (
                                      <span className="px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        Active for this language
                                      </span>
                                    )}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setVoiceCloneError(null);
                                      try {
                                        const r = await fetch(`/api/me/voices/clone?voiceId=${encodeURIComponent(v.voiceId)}&language=${encodeURIComponent(v.language)}`, { method: "DELETE" });
                                        if (!r.ok) throw new Error("Failed to remove");
                                        refreshSettings();
                                      } catch {
                                        setVoiceCloneError("Failed to remove voice assignment");
                                      }
                                    }}
                                    className="px-2 py-1 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                            );
                          })()}
                        </div>
                      )}
                      <form
                        className="space-y-3"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setVoiceCloneError(null);
                          const form = e.currentTarget;
                          const nameInput = form.querySelector<HTMLInputElement>('[name="voice-name"]');
                          const name = nameInput?.value?.trim();
                          const hasRecorded = !!voiceCloneRecordedBlob;
                          if (!name || !hasRecorded) {
                            setVoiceCloneError("Enter a name and record at least one audio clip.");
                            return;
                          }
                          setVoiceCloneLoading(true);
                          try {
                            const fd = new FormData();
                            fd.append("name", name);
                            fd.append("language", voiceCloneLanguage);
                            if (voiceCloneRecordedBlob) {
                              const ext = voiceCloneRecordedBlob.type.includes("webm") ? "webm" : "ogg";
                              fd.append("files", new File([voiceCloneRecordedBlob], `recording.${ext}`, { type: voiceCloneRecordedBlob.type }));
                            }
                            const r = await fetch("/api/me/voices/clone", {
                              method: "POST",
                              body: fd,
                            });
                            const data = await r.json().catch(() => ({}));
                            if (!r.ok) {
                              throw new Error(data?.error ?? "Voice cloning failed");
                            }
                            refreshSettings();
                            form.reset();
                            setVoiceCloneRecordedBlob(null);
                          } catch (err) {
                            setVoiceCloneError(err instanceof Error ? err.message : "Voice cloning failed");
                          } finally {
                            setVoiceCloneLoading(false);
                          }
                        }}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            name="voice-name"
                            placeholder="Voice name"
                            maxLength={64}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/12 bg-white dark:bg-neutral-900 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                          />
                          <select
                            value={voiceCloneLanguage}
                            onChange={(e) => setVoiceCloneLanguage(e.target.value as LanguageCode | "all")}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/12 bg-white dark:bg-neutral-900 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                          >
                            <option value="all">All languages</option>
                            {LANGUAGES.map(({ code, name }) => (
                              <option key={code} value={code}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            type="button"
                            onClick={async () => {
                              if (voiceCloneRecording) {
                                voiceCloneMediaRecorderRef.current?.stop();
                                setVoiceCloneRecording(false);
                                return;
                              }
                              setVoiceCloneError(null);
                              try {
                                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                const recorder = new MediaRecorder(stream);
                                voiceCloneChunksRef.current = [];
                                recorder.ondataavailable = (e) => {
                                  if (e.data.size > 0) voiceCloneChunksRef.current.push(e.data);
                                };
                                recorder.onstop = () => {
                                  stream.getTracks().forEach((t) => t.stop());
                                  if (!voiceCloneClosingRef.current) {
                                    const blob = new Blob(voiceCloneChunksRef.current, { type: recorder.mimeType || "audio/webm" });
                                    setVoiceCloneRecordedBlob(blob);
                                  }
                                  voiceCloneClosingRef.current = false;
                                };
                                recorder.start();
                                voiceCloneMediaRecorderRef.current = recorder;
                                setVoiceCloneRecording(true);
                              } catch {
                                setVoiceCloneError("Microphone access denied or unavailable.");
                              }
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                              voiceCloneRecording
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-[0.75px] border-neutral-200/60 dark:border-white/12"
                            }`}
                          >
                            {voiceCloneRecording ? (
                              <>
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                                </span>
                                Stop recording
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                  <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                                  <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                                </svg>
                                Record clip
                              </>
                            )}
                          </button>
                          {voiceCloneRecordedBlob && (
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              Recorded ({Math.round(voiceCloneRecordedBlob.size / 1024)} KB)
                            </span>
                          )}
                          {voiceCloneRecordedBlob && (
                            <button
                              type="button"
                              onClick={() => setVoiceCloneRecordedBlob(null)}
                              className="text-xs text-neutral-500 hover:text-foreground"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {voiceCloneError && (
                          <p className="text-xs text-red-600 dark:text-red-400">{voiceCloneError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={voiceCloneLoading}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                        >
                          {voiceCloneLoading ? "Generating…" : "Generate Personalized Voice"}
                        </button>
                      </form>
                    </div>
                  )}
                </section>

                <section className="pt-6 border-t-[0.75px] border-neutral-100 dark:border-white/8">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">Time and weather</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Choose how weather appears next to your local time in the header.</p>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Weather format</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "condition-temp" as const, label: "Condition + temp", preview: "Cloudy 22°C" },
                        { id: "emoji-temp" as const, label: "Emoji + temp", preview: "☁️ 22°C" },
                        { id: "temp-only" as const, label: "Temp only", preview: "22°C" },
                      ].map(({ id, label, preview }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => updateWeatherFormat(id)}
                          className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                            weatherFormat === id
                              ? "bg-foreground text-background border-foreground"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-[0.75px] border-neutral-200/60 dark:border-white/12"
                          }`}
                        >
                          {label}
                          <span className={`ml-2 text-xs ${weatherFormat === id ? "text-background/80" : "text-neutral-500 dark:text-neutral-400"}`}>
                            {preview}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="pt-6 border-t-[0.75px] border-neutral-100 dark:border-white/8">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">Appearance</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Choose a background for your chat.</p>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Background</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "default" as const, name: "Classic", image: null },
                        { id: "air" as const, name: "Wind", image: "/images/wind.png" },
                        { id: "water" as const, name: "Water", image: "/images/water.png" },
                        { id: "earth" as const, name: "Earth", image: "/images/earth.png" },
                        { id: "fire" as const, name: "Fire", image: "/images/fire.png" },
                      ].map(({ id, name, image }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setBackground(id)}
                          title={name}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors border-[0.75px] ${
                            background === id
                              ? "border-foreground bg-neutral-100 dark:bg-neutral-800 text-foreground ring-2 ring-foreground/20"
                              : "border-neutral-200/60 dark:border-white/12 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                          }`}
                        >
                          {image ? (
                            <Image
                              src={image}
                              alt={name}
                              width={18}
                              height={18}
                              className="w-[18px] h-[18px] shrink-0 object-contain"
                            />
                          ) : (
                            <DefaultIcon className="w-[18px] h-[18px] shrink-0" />
                          )}
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {!isAnonymous && (
                <section className="pt-6 border-t border-neutral-100 dark:border-neutral-700/20">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">Help</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">Get familiar with the app.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setFeatureTourStep(0);
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border-[0.75px] border-neutral-200 dark:border-white/12"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <path d="M12 17h.01" />
                    </svg>
                    Show feature tour
                  </button>
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    Walk through the main features of the app.
                  </p>
                </section>
                )}

                {!isAnonymous && (
                  <section className="pt-6 border-t border-neutral-100 dark:border-neutral-700/20">
                    <button
                      type="button"
                      onClick={() => setExportSectionOpen((prev) => !prev)}
                      aria-expanded={exportSectionOpen}
                      aria-controls="settings-data-export-panel"
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-neutral-200/70 dark:border-white/12 bg-neutral-50 dark:bg-neutral-900 px-3 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors"
                    >
                      <span className="min-w-0 text-left">
                        <span className="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Data export</span>
                        <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          Export your selected data as a Markdown file for LLM context or archiving.
                        </span>
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`w-4 h-4 shrink-0 text-neutral-500 dark:text-neutral-400 transition-transform ${exportSectionOpen ? "rotate-180" : ""}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {exportSectionOpen && (
                      <div id="settings-data-export-panel" className="mt-2 rounded-xl border border-neutral-200/70 dark:border-white/12 bg-neutral-50 dark:bg-neutral-900 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              setExportMarkdownError(null);
                              setExportSelections((prev) =>
                                Object.fromEntries(
                                  Object.keys(prev).map((key) => [key, !allExportSectionsSelected])
                                ) as Record<ExportDataSection, boolean>
                              );
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-white/12 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            {allExportSectionsSelected ? "Deselect all" : "Select all"}
                          </button>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {selectedExportSections.length} selected
                          </span>
                        </div>
                        <div className="space-y-2">
                          {EXPORT_DATA_SECTION_OPTIONS.map(({ key, label, description }) => (
                            <label
                              key={key}
                              className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={exportSelections[key]}
                                onChange={(e) => {
                                  setExportMarkdownError(null);
                                  const checked = e.target.checked;
                                  setExportSelections((prev) => ({ ...prev, [key]: checked }));
                                }}
                                className="mt-0.5 rounded border-neutral-300 dark:border-neutral-600 text-foreground focus:ring-foreground/30"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-foreground">{label}</span>
                                <span className="block text-xs text-neutral-500 dark:text-neutral-400">{description}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                        {exportMarkdownError && (
                          <p className="mt-3 text-xs text-red-600 dark:text-red-400">{exportMarkdownError}</p>
                        )}
                        <button
                          type="button"
                          disabled={exportMarkdownLoading || selectedExportSections.length === 0}
                          onClick={async () => {
                            if (selectedExportSections.length === 0) {
                              setExportMarkdownError("Select at least one section to export.");
                              return;
                            }
                            setExportMarkdownLoading(true);
                            setExportMarkdownError(null);
                            try {
                              const res = await fetch("/api/me/export-markdown", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ sections: selectedExportSections }),
                              });
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                throw new Error(data?.error ?? "Export failed");
                              }
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const cd = res.headers.get("content-disposition") ?? "";
                              const filename = cd.match(/filename="([^"]+)"/)?.[1] ?? "fml-export.md";
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = filename;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              setExportMarkdownError(err instanceof Error ? err.message : "Export failed");
                            } finally {
                              setExportMarkdownLoading(false);
                            }
                          }}
                          className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {exportMarkdownLoading ? "Generating export…" : "Export data to markdown for LLMs"}
                        </button>
                      </div>
                    )}
                </section>
                )}

                {!isAnonymous && (
                  <section className="pt-6 border-t border-neutral-200 dark:border-neutral-700/30">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-red-500 dark:text-red-400 mb-2">Danger zone</h3>
                    <div className="rounded-xl border border-red-200/50 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 p-4">
                      <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">Delete all my data</h4>
                      <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                        Irreversible. Removes conversations, memories, concepts, mental models, and nuggets.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsOpen(false);
                          setDeleteAllDataModalOpen(true);
                          setDeleteAllDataConfirmInput("");
                        }}
                        className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4 shrink-0" />
                        Delete
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {feedbackModalOpen && (
        <FeedbackModal onClose={() => setFeedbackModalOpen(false)} />
      )}

      {signInFeaturesModalOpen && isAnonymous && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setSignInFeaturesModalOpen(false)}
          aria-modal
          role="dialog"
          aria-labelledby="sign-in-features-title"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="sign-in-features-title" className="text-lg font-semibold text-foreground">
                  Features unlocked with sign in
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Everything below becomes available once you sign in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSignInFeaturesModalOpen(false)}
                className="p-2 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 max-h-[55vh] overflow-y-auto space-y-2 pr-1">
              {signInFeatures.map((item) => (
                <div
                  key={`feature-modal-${item.label}`}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className="text-neutral-500 shrink-0">{signInFeatureIconSvg(item.icon)}</span>
                    <span>{item.label}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {featureTourStep !== null && (
        <FeatureTour
          steps={[...FEATURE_TOUR_STEPS]}
          currentStep={featureTourStep}
          onNext={() => setFeatureTourStep((s) => Math.min((s ?? 0) + 1, FEATURE_TOUR_STEPS.length - 1))}
          onComplete={() => {
            try {
              localStorage.setItem(FEATURE_TOUR_COMPLETE_KEY, "true");
            } catch {
              /* ignore */
            }
            setFeatureTourStep(null);
            setLibraryPanelOpen(null);
            setSelectedMentalModel(null);
            setSidebarOpen(false);
          }}
          onOpenSidebar={() => setSidebarOpen(true)}
          onSelectPanel={(panel) => {
            setLibraryPanelOpen(panel);
            if (panel) setConversationsCollapsed(false);
          }}
        />
      )}

      {deleteAllDataModalOpen && !isAnonymous && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setDeleteAllDataModalOpen(false)}
          aria-modal
          role="dialog"
          aria-labelledby="delete-all-data-title"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-md w-full overflow-hidden border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-3 bg-red-950/40 dark:bg-red-950/60 border-b border-red-900/30">
              <h2 id="delete-all-data-title" className="text-sm font-medium text-red-500 dark:text-red-400">Danger zone</h2>
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">Delete all my data</h3>
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                Warning: Deleting all data is irreversible and will permanently remove your conversations, long-term memories, custom concepts, saved mental models, and nuggets.
              </p>
              <p className="mt-4 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                Type <span className="font-mono font-bold text-red-600 dark:text-red-400">&quot;delete everything&quot;</span> to confirm:
              </p>
            <input
              type="text"
              value={deleteAllDataConfirmInput}
              onChange={(e) => setDeleteAllDataConfirmInput(e.target.value)}
              placeholder="delete everything"
              className="mt-2 w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              autoComplete="off"
            />
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setDeleteAllDataModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteAllDataConfirmInput.trim() !== "delete everything") return;
                  setDeleteAllDataLoading(true);
                  try {
                    const res = await fetch("/api/me/delete-all-data", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ confirmPhrase: deleteAllDataConfirmInput.trim() }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      setDeleteAllDataModalOpen(false);
                      setDeleteAllDataConfirmInput("");
                      setSessions([]);
                      setMessages([]);
                      setCurrentSessionId(null);
                      setCurrentSession(null);
                      setCollapsedSummary(null);
                      setLongTermMemories([]);
                      setCustomConcepts([]);
                      setConceptGroups([]);
                      setSavedConcepts([]);
                      router.push("/chat/new");
                    } else {
                      alert(data.error || "Failed to delete data");
                    }
                  } catch {
                    alert("Failed to delete data");
                  } finally {
                    setDeleteAllDataLoading(false);
                  }
                }}
                disabled={deleteAllDataConfirmInput.trim() !== "delete everything" || deleteAllDataLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TrashIcon className="w-4 h-4 shrink-0" />
                {deleteAllDataLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {letterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setLetterModalOpen(false)}
          aria-modal
          role="dialog"
          aria-labelledby="letter-title"
        >
          <div
            className="relative bg-background rounded-3xl shadow-xl max-w-lg w-full p-8 border border-neutral-200 dark:border-neutral-700 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLetterModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <div className="mb-5 flex items-center justify-center gap-3">
              <Image
                src="/icon.svg"
                alt="FigureMyLife Labs logo"
                width={72}
                height={72}
                className="rounded-full border border-neutral-200 dark:border-neutral-700/40 shadow-sm"
              />
              <span className="text-2xl text-neutral-400 dark:text-neutral-500" aria-hidden>
                |
              </span>
              <Image
                src="/images/profilephoto.png"
                alt="Creator profile"
                width={72}
                height={72}
                className="rounded-full object-cover border border-neutral-200 dark:border-neutral-700/40 shadow-sm"
              />
            </div>
            <h2
              id="letter-title"
              aria-label={LETTER_MODAL_TITLE}
              className="letter-modal-script-title font-developer text-[1.8rem] leading-none md:text-4xl text-foreground text-center mb-6 min-h-[1.2em]"
            >
              {LETTER_MODAL_TITLE.slice(0, visibleLetterModalTitleChars)}
              {letterModalTitleAnimating && (
                <span
                  aria-hidden
                  className="inline-block h-[0.8em] w-[0.08em] align-[-0.08em] ml-1 bg-current animate-pulse"
                />
              )}
            </h2>
            <p className="text-lg sm:text-xl text-neutral-700 dark:text-neutral-300 leading-relaxed max-w-prose mx-auto">
              FigureMyLife Labs is proud to introduce a new coach that helps you think through the long-term consequences of your choices. FML uses deep questioning and proven mental frameworks to help you make smarter decisions.
            </p>
            <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700 text-center">
              <p className="letter-modal-script-location font-developer text-[1.4rem] leading-none md:text-[1.44em] text-neutral-600 dark:text-neutral-300">San Francisco</p>
              <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                <Link href="/about" className="text-neutral-500 dark:text-neutral-400 hover:text-foreground transition-colors">
                  About the Creator
                </Link>
                <Link href="/mission" className="text-neutral-500 dark:text-neutral-400 hover:text-foreground transition-colors">
                  Mission Statement
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteSessionConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setDeleteSessionConfirmModal(null)}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-lg">Delete conversation?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              &quot;{deleteSessionConfirmModal.title || "New conversation"}&quot; will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setDeleteSessionConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const session = deleteSessionConfirmModal;
                  setDeleteSessionConfirmModal(null);
                  try {
                    const res = await fetch(`/api/sessions/${session._id}`, {
                      method: "DELETE",
                    });
                    if (res.ok) {
                      setSessions((prev) => prev.filter((x) => x._id !== session._id));
                      if (currentSessionId === session._id) {
                        router.push("/chat/new");
                      }
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {goBackConfirmModal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => !goBackLoading && setGoBackConfirmModal(null)}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-lg">Go back in time?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {goBackConfirmModal.role === "user"
                ? "Your message will be re-sent to get a fresh response."
                : "The options from this response will be restored."}
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => !goBackLoading && setGoBackConfirmModal(null)}
                disabled={goBackLoading}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { index, role, content } = goBackConfirmModal;
                  setGoBackLoading(true);
                  try {
                    const keepCount =
                      role === "user" ? index : index + 1;
                    const res = await fetch(
                      `/api/sessions/${currentSessionId}/truncate-messages`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ keepCount }),
                      }
                    );
                    if (res.ok) {
                      setGoBackConfirmModal(null);
                      if (role === "user") {
                        setMessages((prev) => prev.slice(0, index));
                        await sendMessage(content);
                      } else {
                        setMessages((prev) => prev.slice(0, index + 1));
                      }
                    }
                  } catch {
                    /* ignore */
                  } finally {
                    setGoBackLoading(false);
                  }
                }}
                disabled={goBackLoading}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {goBackLoading ? "Going back…" : "Go back"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ltmDeleteConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setLtmDeleteConfirmModal(null)}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-lg">Delete from long-term memory?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Removing &quot;{ltmDeleteConfirmModal.title}&quot; will stop the agent from using this context in future conversations. <strong>This will impact agent accuracy</strong>—the agent will have less context about you and your past decisions.
            </p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
              Are you sure you want to delete?
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setLtmDeleteConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const ltm = ltmDeleteConfirmModal;
                  const wasViewingThisSession = currentSession?.longTermMemoryId === ltm._id;
                  const sessionIdToRefetch = wasViewingThisSession ? currentSessionId : null;
                  setLtmDeleteConfirmModal(null);
                  try {
                    const res = await fetch(`/api/me/long-term-memory/${ltm._id}`, {
                      method: "DELETE",
                    });
                    if (res.ok) {
                      setLongTermMemories((prev) => prev.filter((x) => x._id !== ltm._id));
                      refetchSessions();
                      refetchLongTermMemories();
                      if (wasViewingThisSession && sessionIdToRefetch) {
                        setCollapsedSummary(null);
                        fetch(`/api/sessions/${sessionIdToRefetch}`)
                          .then((r) => r.json())
                          .then(({ session, messages: msgs }) => {
                            setCurrentSession(session);
                            setMessages(processMessagesWithContext(msgs || []));
                            setCollapsedSummary(null);
                          })
                          .catch(() => {});
                      }
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {ccCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!ccCreateLoading) {
              setCcCreateModal(false);
              setCcCreateStep("input");
              setCcCreateDraft(null);
              setCcCreateGroupSuggestions(null);
              setCcCreateSelectedGroupIds(new Set());
              setCcCreateSelectedNewGroupNames(new Set());
            }
          }}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            {ccCreateStep === "input" ? (
              <>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <h2 className="font-semibold text-lg mb-2">Create Custom Concept</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    What do you want to remember? The AI will generate a summary and enrichment prompt for you to review and edit.
                  </p>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                  <textarea
                    value={ccCreateInput}
                    onChange={(e) => setCcCreateInput(e.target.value)}
                    placeholder="e.g. I'm considering a career change to product management..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    disabled={ccCreateLoading}
                  />
                </div>
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-2 justify-end items-center">
                  <button
                    onClick={() => {
                      if (!ccCreateLoading) {
                        setCcCreateModal(false);
                        setCcCreateStep("input");
                        setCcCreateDraft(null);
                        setCcCreateGroupSuggestions(null);
                        setCcCreateSelectedGroupIds(new Set());
                        setCcCreateSelectedNewGroupNames(new Set());
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!ccCreateInput.trim() || ccCreateLoading) return;
                      setCcCreateLoading(true);
                      setCcCreateGroupSuggestions(null);
                      setCcCreateSelectedGroupIds(new Set());
                      setCcCreateSelectedNewGroupNames(new Set());
                      try {
                        const res = await fetch("/api/me/custom-concepts/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userInput: ccCreateInput.trim(), language }),
                        });
                        if (!res.ok) throw new Error("Generate failed");
                          const data = await res.json();
                        const draft = {
                            title: data.title ?? "",
                            summary: data.summary ?? "",
                            enrichmentPrompt: data.enrichmentPrompt ?? "",
                        };
                        setCcCreateDraft(draft);
                        const suggestRes = await fetch("/api/me/custom-concepts/suggest-groups", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: draft.title,
                            summary: draft.summary,
                            enrichmentPrompt: draft.enrichmentPrompt,
                            groups: conceptGroups.map((g) => ({ id: g._id, title: g.title })),
                          }),
                        });
                        if (suggestRes.ok) {
                          const suggestData = await suggestRes.json();
                          const ids = suggestData.suggestedGroupIds ?? [];
                          const names = suggestData.suggestedNewGroupNames ?? [];
                          setCcCreateGroupSuggestions({ suggestedGroupIds: ids, suggestedNewGroupNames: names });
                          setCcCreateSelectedGroupIds(new Set(ids));
                          setCcCreateSelectedNewGroupNames(new Set(names));
                        }
                        setCcCreateStep("preview");
                      } catch {
                        /* ignore */
                      } finally {
                        setCcCreateLoading(false);
                      }
                    }}
                    disabled={!ccCreateInput.trim() || ccCreateLoading}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {ccCreateLoading ? "Generating…" : "Generate"}
                  </button>
                  <VoiceInputButton
                    onTranscription={(text) =>
                      setCcCreateInput((prev) => (prev ? `${prev} ${text}` : text))
                    }
                    language={language}
                    disabled={ccCreateLoading}
                    ariaLabel="Dictate custom concept"
                    className="!min-h-[44px] !min-w-[44px]"
                  />
                </div>
              </>
            ) : (
              ccCreateDraft && (
                <>
                  <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                    <h2 className="font-semibold text-lg mb-2">Review and edit</h2>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Edit the generated concept below, then click Save to add it to your custom concepts.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        value={ccCreateDraft.title}
                        onChange={(e) =>
                          setCcCreateDraft((d) => (d ? { ...d, title: e.target.value } : null))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        placeholder="Short title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                        Summary
                      </label>
                      <textarea
                        value={ccCreateDraft.summary}
                        onChange={(e) =>
                          setCcCreateDraft((d) => (d ? { ...d, summary: e.target.value } : null))
                        }
                        rows={6}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        placeholder="2-4 paragraph summary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                        Enrichment prompt (for AI coach context)
                      </label>
                      <textarea
                        value={ccCreateDraft.enrichmentPrompt}
                        onChange={(e) =>
                          setCcCreateDraft((d) =>
                            d ? { ...d, enrichmentPrompt: e.target.value } : null
                          )
                        }
                        rows={3}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        placeholder="Core idea + when it's relevant (25-40 words)"
                      />
                    </div>
                    {ccCreateGroupSuggestions && (ccCreateGroupSuggestions.suggestedGroupIds.length > 0 || ccCreateGroupSuggestions.suggestedNewGroupNames.length > 0) && (
                      <div>
                        <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                          Groups
                        </label>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                          Select groups to add this concept to. All suggestions are pre-selected.
                        </p>
                        <div className="space-y-2">
                          {ccCreateGroupSuggestions.suggestedGroupIds.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Existing groups</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ccCreateGroupSuggestions.suggestedGroupIds.map((gid) => {
                                  const cg = conceptGroups.find((g) => g._id === gid);
                                  if (!cg) return null;
                                  const selected = ccCreateSelectedGroupIds.has(gid);
                                  return (
                                    <button
                                      key={cg._id}
                                      type="button"
                                      onClick={() => {
                                        setCcCreateSelectedGroupIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(gid)) next.delete(gid);
                                          else next.add(gid);
                                          return next;
                                        });
                                      }}
                                      className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        selected
                                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-700/50 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-800 dark:hover:text-red-200 hover:border-red-200/60 dark:hover:border-red-700/50"
                                          : "border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                                      }`}
                                    >
                                      {cg.title}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {ccCreateGroupSuggestions.suggestedNewGroupNames.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Create new</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ccCreateGroupSuggestions.suggestedNewGroupNames.map((name) => {
                                  const selected = ccCreateSelectedNewGroupNames.has(name);
                                  return (
                                    <button
                                      key={name}
                                      type="button"
                                      onClick={() => {
                                        setCcCreateSelectedNewGroupNames((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(name)) next.delete(name);
                                          else next.add(name);
                                          return next;
                                        });
                                      }}
                                      className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        selected
                                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-dashed border-emerald-300 dark:border-emerald-700 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-800 dark:hover:text-red-200 hover:border-red-200/60 dark:hover:border-red-700/50"
                                          : "border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                                      }`}
                                    >
                                      + {name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        if (!ccCreateLoading) {
                          setCcCreateStep("input");
                          setCcCreateDraft(null);
                          setCcCreateGroupSuggestions(null);
                          setCcCreateSelectedGroupIds(new Set());
                          setCcCreateSelectedNewGroupNames(new Set());
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
                    >
                      Back
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          !ccCreateDraft?.title.trim() ||
                          !ccCreateDraft?.summary.trim() ||
                          !ccCreateDraft?.enrichmentPrompt.trim() ||
                          ccCreateLoading
                        )
                          return;
                        setCcCreateLoading(true);
                        try {
                          const res = await fetch("/api/me/custom-concepts", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              title: ccCreateDraft.title.trim(),
                              summary: ccCreateDraft.summary.trim(),
                              enrichmentPrompt: ccCreateDraft.enrichmentPrompt.trim(),
                            }),
                          });
                          if (!res.ok) throw new Error("Create failed");
                          const created = await res.json();
                          const newConceptId = created._id;
                          for (const gid of ccCreateSelectedGroupIds) {
                            const cg = conceptGroups.find((g) => g._id === gid);
                            if (cg) {
                              const currentIds = cg.conceptIds ?? [];
                              try {
                                await fetch(`/api/me/concept-groups/${cg._id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ conceptIds: [...currentIds, newConceptId] }),
                                });
                              } catch {
                                /* ignore */
                              }
                            }
                          }
                          for (const name of ccCreateSelectedNewGroupNames) {
                            try {
                              await fetch("/api/me/concept-groups", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ title: name, conceptIds: [newConceptId] }),
                              });
                            } catch {
                              /* ignore */
                            }
                          }
                          if (ccCreateSelectedGroupIds.size > 0 || ccCreateSelectedNewGroupNames.size > 0) {
                            refetchConceptGroups();
                          }
                            setCcCreateModal(false);
                            setCcCreateInput("");
                            setCcCreateStep("input");
                            setCcCreateDraft(null);
                          setCcCreateGroupSuggestions(null);
                          setCcCreateSelectedGroupIds(new Set());
                          setCcCreateSelectedNewGroupNames(new Set());
                            refetchCustomConcepts();
                            setCcCreateSuccess(true);
                            setTimeout(() => setCcCreateSuccess(false), 2000);
                        } catch {
                          /* ignore */
                        } finally {
                          setCcCreateLoading(false);
                        }
                      }}
                      disabled={
                        !ccCreateDraft?.title.trim() ||
                        !ccCreateDraft?.summary.trim() ||
                        !ccCreateDraft?.enrichmentPrompt.trim() ||
                        ccCreateLoading
                      }
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {ccCreateLoading ? "Saving…" : "Save"}
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {ccYoutubeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => !ccYoutubeLoading && (setCcYoutubeModal(false), setCcYoutubeUrl(""), setCcYoutubeExtractPrompt(""), setCcYoutubeTranscriptId(null), setCcYoutubeResult(null), setCcYoutubeError(null))}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            {!ccYoutubeResult ? (
              <>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <h2 className="font-semibold text-lg mb-2">
                    {ccYoutubeTranscriptId ? "Re-extract from saved transcript" : "Concepts from YouTube"}
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {ccYoutubeTranscriptId
                      ? "Use a different extraction focus and extract concepts again from your saved transcript."
                      : "Paste a YouTube video URL. We'll fetch the transcript and extract clear concepts, auto-tagged into domains."}
                  </p>
                </div>
                <div className="p-4 flex-1 space-y-3 overflow-y-auto">
                  {ccYoutubeError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{ccYoutubeError}</p>
                  )}
                  {!ccYoutubeTranscriptId && (
                  <input
                    type="url"
                    value={ccYoutubeUrl}
                    onChange={(e) => setCcYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    disabled={ccYoutubeLoading}
                  />
                  )}
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      What to extract (optional)
                    </label>
                    <textarea
                      value={ccYoutubeExtractPrompt}
                      onChange={(e) => setCcYoutubeExtractPrompt(e.target.value)}
                      placeholder="e.g. Focus on productivity tips, career advice, or psychological insights..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y"
                      disabled={ccYoutubeLoading}
                    />
                  </div>
                </div>
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
                  <button
                    onClick={() => !ccYoutubeLoading && (setCcYoutubeModal(false), setCcYoutubeUrl(""), setCcYoutubeExtractPrompt(""), setCcYoutubeTranscriptId(null), setCcYoutubeResult(null), setCcYoutubeError(null))}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if ((!ccYoutubeUrl.trim() && !ccYoutubeTranscriptId) || ccYoutubeLoading) return;
                      setCcYoutubeLoading(true);
                      setCcYoutubeResult(null);
                      setCcYoutubeError(null);
                      try {
                        const body: Record<string, unknown> = {
                          language,
                          extractPrompt: ccYoutubeExtractPrompt.trim() || undefined,
                        };
                        if (ccYoutubeTranscriptId) {
                          body.transcriptId = ccYoutubeTranscriptId;
                        } else {
                          body.url = ccYoutubeUrl.trim();
                        }
                        const res = await fetch("/api/me/custom-concepts/from-youtube", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        });
                        const data = await res.json();
                        if (res.ok && data.groups) {
                          setCcYoutubeResult({
                            videoTitle: data.videoTitle ?? null,
                            channel: data.channel ?? null,
                            groups: data.groups,
                          });
                          refetchTranscripts();
                        } else {
                          setCcYoutubeError(data.error ?? "Failed to extract concepts");
                        }
                      } catch {
                        setCcYoutubeError("Failed to extract concepts");
                      } finally {
                        setCcYoutubeLoading(false);
                      }
                    }}
                    disabled={(!ccYoutubeUrl.trim() && !ccYoutubeTranscriptId) || ccYoutubeLoading}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {ccYoutubeLoading ? "Extracting…" : "Extract concepts"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <h2 className="font-semibold text-lg mb-1">Review concepts</h2>
                  {ccYoutubeResult.videoTitle && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate" title={ccYoutubeResult.videoTitle}>
                      {ccYoutubeResult.videoTitle}
                      {ccYoutubeResult.channel && ` · ${ccYoutubeResult.channel}`}
                    </p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {ccYoutubeResult.groups.map((group, gi) => {
                    if (group.concepts.length === 0) return null;
                    return (
                    <div key={gi} className="space-y-2">
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">{group.domain}</p>
                      {group.concepts.map((c, ci) => (
                        <div key={ci} className="relative p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background space-y-3">
                          <button
                            type="button"
                            onClick={() => {
                              const next = ccYoutubeResult.groups.map((g, i) =>
                                i === gi
                                  ? { ...g, concepts: g.concepts.filter((_, j) => j !== ci) }
                                  : g
                              );
                              setCcYoutubeResult({ ...ccYoutubeResult, groups: next });
                            }}
                            className="absolute top-2 right-2 z-10 p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            aria-label={`Delete concept ${c.title || "concept"}`}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Title</label>
                            <input
                              type="text"
                              value={c.title}
                              onChange={(e) => {
                                const next = ccYoutubeResult.groups.map((g, i) =>
                                  i === gi
                                    ? {
                                        ...g,
                                        concepts: g.concepts.map((con, j) =>
                                          j === ci ? { ...con, title: e.target.value } : con
                                        ),
                                      }
                                    : g
                                );
                                setCcYoutubeResult({ ...ccYoutubeResult, groups: next });
                              }}
                              className="w-full px-2 py-1 text-sm font-medium rounded border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                              placeholder="Short title"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Summary</label>
                            <textarea
                              value={c.summary}
                              dir={isRtlLanguage(language) ? "rtl" : undefined}
                              onChange={(e) => {
                                const next = ccYoutubeResult.groups.map((g, i) =>
                                  i === gi
                                    ? {
                                        ...g,
                                        concepts: g.concepts.map((con, j) =>
                                          j === ci ? { ...con, summary: e.target.value } : con
                                        ),
                                      }
                                    : g
                                );
                                setCcYoutubeResult({ ...ccYoutubeResult, groups: next });
                              }}
                              rows={4}
                              className="w-full px-2 py-1 text-sm rounded border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y"
                              placeholder="2-4 paragraph narrative"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Enrichment prompt</label>
                            <textarea
                              value={c.enrichmentPrompt}
                              dir={isRtlLanguage(language) ? "rtl" : undefined}
                              onChange={(e) => {
                                const next = ccYoutubeResult.groups.map((g, i) =>
                                  i === gi
                                    ? {
                                        ...g,
                                        concepts: g.concepts.map((con, j) =>
                                          j === ci ? { ...con, enrichmentPrompt: e.target.value } : con
                                        ),
                                      }
                                    : g
                                );
                                setCcYoutubeResult({ ...ccYoutubeResult, groups: next });
                              }}
                              rows={2}
                              className="w-full px-2 py-1 text-sm rounded border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y"
                              placeholder="Core idea + when it's relevant (25-40 words)"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                  })}
                </div>
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
                  <button
                    onClick={() => setCcYoutubeResult(null)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      if (ccYoutubeLoading || !ccYoutubeResult) return;
                      setCcYoutubeLoading(true);
                      try {
                        for (const group of ccYoutubeResult.groups) {
                          const validConcepts = group.concepts.filter(
                            (c) => c.title?.trim() && c.summary?.trim() && c.enrichmentPrompt?.trim()
                          );
                          if (validConcepts.length === 0) continue;
                          await fetch("/api/me/concept-groups", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              domain: group.domain,
                              concepts: validConcepts,
                            }),
                          });
                        }
                        setCcYoutubeModal(false);
                        setCcYoutubeUrl("");
                        setCcYoutubeTranscriptId(null);
                        setCcYoutubeExtractPrompt("");
                        setCcYoutubeResult(null);
                        refetchCustomConcepts();
                        refetchConceptGroups();
                        refetchTranscripts();
                        setCcCreateSuccess(true);
                        setTimeout(() => setCcCreateSuccess(false), 2000);
                      } catch {
                        /* ignore */
                      } finally {
                        setCcYoutubeLoading(false);
                      }
                    }}
                    disabled={ccYoutubeLoading}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {ccYoutubeLoading ? "Saving…" : "Save all"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {ccDetailModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            setCcDetailModal(null);
            setCcAutoTagSuggestions(null);
            setCcTranslatePopoverOpen(false);
            setTtsHighlight(null);
          }}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="font-semibold text-lg truncate pr-2">{ccDetailModal.title}</h2>
              <button
                onClick={() => {
                  setCcDetailModal(null);
                  setCcAutoTagSuggestions(null);
                  setCcTranslatePopoverOpen(false);
                }}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100 min-w-0">
                    Summary
                  </label>
                  <div className="flex items-center gap-1">
                    <TTSButton
                      text={`${ccDetailModal.title}\n\n${ccDetailModal.summary}`}
                      showOnHover={false}
                      ariaLabel="Listen to summary"
                      onTtsProgress={(charEnd) => setTtsHighlight({ textId: `cc-${ccDetailModal._id}-summary`, charEnd })}
                      onTtsEnd={() => setTtsHighlight(null)}
                    />
                  <CopyButton
                    text={`${ccDetailModal.title}\n\n${ccDetailModal.summary}`}
                    aria-label="Copy summary"
                  />
                </div>
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap" dir={isRtlLanguage(language) ? "rtl" : undefined}>
                  {ttsHighlight && "textId" in ttsHighlight && ttsHighlight.textId === `cc-${ccDetailModal._id}-summary` ? (
                    <TtsHighlightedText text={`${ccDetailModal.title}\n\n${ccDetailModal.summary}`.trim()} charEnd={ttsHighlight.charEnd} />
                  ) : (
                    ccDetailModal.summary
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Enrichment prompt
                </label>
                  <TTSButton
                    text={ccDetailModal.enrichmentPrompt}
                    showOnHover={false}
                    ariaLabel="Listen to enrichment prompt"
                    onTtsProgress={(charEnd) => setTtsHighlight({ textId: `cc-${ccDetailModal._id}-enrichment`, charEnd })}
                    onTtsEnd={() => setTtsHighlight(null)}
                  />
                </div>
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200" dir={isRtlLanguage(language) ? "rtl" : undefined}>
                  {ttsHighlight && "textId" in ttsHighlight && ttsHighlight.textId === `cc-${ccDetailModal._id}-enrichment` ? (
                    <TtsHighlightedText text={ccDetailModal.enrichmentPrompt} charEnd={ttsHighlight.charEnd} />
                  ) : (
                    ccDetailModal.enrichmentPrompt
                  )}
                </p>
              </div>
                <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Groups
                  </label>
                  <div ref={ccAutoTagPopoverRef} className="relative">
                    <button
                      type="button"
                      disabled={ccAutoTagLoading}
                      onClick={async () => {
                        if (ccAutoTagLoading) return;
                        setCcAutoTagLoading(true);
                        setCcAutoTagSuggestions(null);
                        try {
                          const res = await fetch("/api/me/custom-concepts/suggest-groups", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              title: ccDetailModal.title,
                              summary: ccDetailModal.summary,
                              enrichmentPrompt: ccDetailModal.enrichmentPrompt,
                              groups: conceptGroups.map((g) => ({ id: g._id, title: g.title })),
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setCcAutoTagSuggestions({
                              suggestedGroupIds: data.suggestedGroupIds ?? [],
                              suggestedNewGroupNames: data.suggestedNewGroupNames ?? [],
                            });
                          }
                        } catch {
                          setCcAutoTagSuggestions(null);
                        } finally {
                          setCcAutoTagLoading(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-60"
                    >
                      <SparklesIcon className="h-3.5 w-3.5" />
                      {ccAutoTagLoading ? "…" : getModalTranslations(language).autoTagGroups}
                    </button>
                    {ccAutoTagSuggestions && (
                      <div className="absolute right-0 bottom-full mb-1.5 z-20 min-w-[220px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background shadow-xl py-2 overflow-hidden">
                        {ccAutoTagSuggestions.suggestedGroupIds.length > 0 && (
                          <div className="px-2.5 py-1.5">
                            <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Add to existing</p>
                            <div className="flex flex-wrap gap-1">
                              {ccAutoTagSuggestions.suggestedGroupIds.map((gid) => {
                                const cg = conceptGroups.find((g) => g._id === gid);
                                if (!cg) return null;
                      const isInGroup = (cg.conceptIds ?? []).includes(ccDetailModal._id);
                                if (isInGroup) return null;
                      return (
                                  <button
                          key={cg._id}
                                    type="button"
                                    onClick={async () => {
                              const currentIds = cg.conceptIds ?? [];
                                      const newIds = [...currentIds, ccDetailModal._id];
                              setConceptGroups((prev) =>
                                prev.map((g) =>
                                  g._id === cg._id ? { ...g, conceptIds: newIds } : g
                                )
                              );
                              try {
                                        await fetch(`/api/me/concept-groups/${cg._id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ conceptIds: newIds }),
                                });
                              } catch {
                                        /* ignore */
                                      }
                                      setCcAutoTagSuggestions(null);
                                    }}
                                    className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors"
                                  >
                                    + {cg.title}
                                  </button>
                      );
                    })}
                  </div>
                </div>
              )}
                        {ccAutoTagSuggestions.suggestedNewGroupNames.length > 0 && (
                          <div className="px-2.5 py-1.5 border-t border-neutral-100 dark:border-neutral-800">
                            <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">Create new</p>
                            <div className="flex flex-wrap gap-1">
                              {ccAutoTagSuggestions.suggestedNewGroupNames.map((name) => (
                <button
                                  key={name}
                  type="button"
                  onClick={async () => {
                    try {
                                      const res = await fetch("/api/me/concept-groups", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                                          title: name,
                                          conceptIds: [ccDetailModal._id],
                        }),
                      });
                                      if (res.ok) {
                      const data = await res.json();
                                        setConceptGroups((prev) => [...prev, { ...data, conceptIds: [ccDetailModal._id] }]);
                                        refetchConceptGroups();
                                      }
                    } catch {
                                      /* ignore */
                    }
                                    setCcAutoTagSuggestions(null);
                  }}
                                  className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                >
                                  + {name}
                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {(ccAutoTagSuggestions.suggestedGroupIds.length === 0 && ccAutoTagSuggestions.suggestedNewGroupNames.length === 0) && (
                          <p className="px-3 py-2 text-xs text-neutral-500">No suggestions</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  Tag this concept into one or more groups.
                </p>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {conceptGroups.map((cg) => {
                    const isInGroup = (cg.conceptIds ?? []).includes(ccDetailModal._id);
                    return (
                <button
                        key={cg._id}
                  type="button"
                        onClick={async () => {
                          const currentIds = cg.conceptIds ?? [];
                          const newIds = isInGroup
                            ? currentIds.filter((id) => id !== ccDetailModal._id)
                            : [...currentIds, ccDetailModal._id];
                          setConceptGroups((prev) =>
                            prev.map((g) =>
                              g._id === cg._id ? { ...g, conceptIds: newIds } : g
                            )
                          );
                          try {
                            const res = await fetch(`/api/me/concept-groups/${cg._id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ conceptIds: newIds }),
                            });
                            if (!res.ok) throw new Error("Failed");
                          } catch {
                            setConceptGroups((prev) =>
                              prev.map((g) =>
                                g._id === cg._id ? { ...g, conceptIds: currentIds } : g
                              )
                            );
                          }
                        }}
                        className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                          isInGroup
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-700/50 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-800 dark:hover:text-red-200 hover:border-red-200/60 dark:hover:border-red-700/50"
                            : "border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                        }`}
                      >
                        {cg.title}
                </button>
                    );
                  })}
                </div>
              </div>
              {generateModal?.type === "cc" && (
                <div
                  className="absolute inset-0 flex items-center justify-center p-4 bg-black/50 rounded-3xl z-10"
                  onClick={() => setGenerateModal(null)}
                >
                  <div
                    className="bg-background rounded-2xl shadow-xl max-w-md w-full p-5 border border-neutral-200 dark:border-neutral-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="font-semibold text-base mb-3">Generated message</h3>
                    {generateModal.loading ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-neutral-500 dark:text-neutral-400">
                        <span className="inline-block w-4 h-4 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                        <span>Generating…</span>
                      </div>
                    ) : (
                      <textarea
                        value={generateModal.generatedText}
                        onChange={(e) =>
                          setGenerateModal((prev) =>
                            prev ? { ...prev, generatedText: e.target.value } : null
                          )
                        }
                        className="w-full min-h-[100px] px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-background text-sm resize-y"
                        placeholder="Generated message…"
                      />
                    )}
                    <div className="flex gap-2 justify-end mt-4">
                      <button
                        onClick={() => setGenerateModal(null)}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const text = generateModal.generatedText.trim();
                          if (text) {
                            sendMessage(text);
                            setGenerateModal(null);
                            setCcDetailModal(null);
                          }
                        }}
                        disabled={generateModal.loading || !generateModal.generatedText.trim()}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex flex-nowrap items-center gap-2 min-w-0">
              <GenerateRelevantMessageButton
                label={getModalTranslations(language).generateRelevantMessage}
                aria-label={getModalTranslations(language).generateRelevantMessage}
                onClick={async () => {
                  const suggestion = `${ccDetailModal.title}\n\n${ccDetailModal.summary}\n\nEnrichment: ${ccDetailModal.enrichmentPrompt}`;
                  setGenerateModal({ type: "cc", generatedText: "", loading: true });
                  try {
                    const res = await fetch("/api/generate-relevant-prompt", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        suggestion,
                        messages: messages.map((m) => ({ role: m.role, content: m.content })),
                      }),
                    });
                    const data = await res.json();
                    setGenerateModal((prev) =>
                      prev ? { ...prev, generatedText: data.text ?? suggestion, loading: false } : null
                    );
                  } catch {
                    setGenerateModal((prev) =>
                      prev ? { ...prev, generatedText: suggestion, loading: false } : null
                    );
                  }
                }}
              />
              <div ref={ccTranslatePopoverRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCcTranslatePopoverOpen((o) => !o)}
                  disabled={ccTranslating}
                  className="px-3 py-2 rounded-xl text-sm border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-foreground/20 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-60"
                >
                  {getModalTranslations(language).translateTo}
                </button>
                {ccTranslatePopoverOpen && (
                  <div className="absolute left-0 bottom-full mb-1.5 z-20 min-w-[180px] max-h-64 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background shadow-xl py-2 animate-fade-in-up">
                    {LANGUAGES.map(({ code, name }) => (
                      <button
                        key={code}
                        type="button"
                        onClick={async () => {
                          setCcTranslatePopoverOpen(false);
                          setCcTranslating(true);
                          try {
                            const res = await fetch("/api/me/custom-concepts/translate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                conceptId: ccDetailModal._id,
                                targetLanguage: code,
                              }),
                            });
                            const data = res.ok ? await res.json() : null;
                            if (data) {
                              setCustomConcepts((prev) =>
                                prev.map((c) =>
                                  c._id === ccDetailModal._id
                                    ? {
                                        ...c,
                                        title: data.title ?? c.title,
                                        summary: data.summary ?? c.summary,
                                        enrichmentPrompt: data.enrichmentPrompt ?? c.enrichmentPrompt,
                                      }
                                    : c
                                )
                              );
                              setCcDetailModal((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      title: data.title ?? prev.title,
                                      summary: data.summary ?? prev.summary,
                                      enrichmentPrompt: data.enrichmentPrompt ?? prev.enrichmentPrompt,
                                    }
                                  : null
                              );
                            }
                          } finally {
                            setCcTranslating(false);
                          }
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/80 transition-colors"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCcDeleteConfirmModal(ccDetailModal);
                  setCcDetailModal(null);
                }}
                className="shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                aria-label={getModalTranslations(language).deleteCustomConcept}
              >
                {getModalTranslations(language).deleteButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {ccDeleteConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setCcDeleteConfirmModal(null)}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-lg">Delete custom concept?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Removing &quot;{ccDeleteConfirmModal.title}&quot; will stop the agent from using this context in future conversations.
            </p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
              Are you sure you want to delete?
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setCcDeleteConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const cc = ccDeleteConfirmModal;
                  setCcDeleteConfirmModal(null);
                  try {
                    const res = await fetch(`/api/me/custom-concepts/${cc._id}`, {
                      method: "DELETE",
                    });
                    if (res.ok) {
                      setCustomConcepts((prev) => prev.filter((x) => x._id !== cc._id));
                      refetchCustomConcepts();
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {cgCreateSuccess && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-800 dark:text-neutral-200 animate-celebrate flex items-center gap-2 shadow-lg">
          <span className="text-lg">✨</span>
          Domain created!
        </div>
      )}

      {cgCustomCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => !cgCustomCreateLoading && (setCgCustomCreateModal(false), setCgCustomCreateTitle(""), setCgCustomCreateSelectedIds(new Set()))}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="font-semibold text-lg mb-2">Create custom group</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Name your group and select concepts to include.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">Group name</label>
                <input
                  type="text"
                  value={cgCustomCreateTitle}
                  onChange={(e) => setCgCustomCreateTitle(e.target.value)}
                  placeholder="e.g. Finance basics"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  disabled={cgCustomCreateLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Select concepts</label>
                {customConcepts.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700 p-2">
                    <div className="flex flex-wrap gap-2">
                    {customConcepts.map((cc) => (
                      <button
                        type="button"
                        key={cc._id}
                        onClick={() => {
                          if (cgCustomCreateLoading) return;
                          setCgCustomCreateSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(cc._id)) next.delete(cc._id);
                            else next.add(cc._id);
                            return next;
                          });
                        }}
                        disabled={cgCustomCreateLoading}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border-[0.75px] transition-colors ${
                          cgCustomCreateSelectedIds.has(cc._id)
                            ? "bg-foreground text-background border-foreground"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-white/12 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        } disabled:opacity-60`}
                        title={cc.title}
                      >
                        {cc.title}
                      </button>
                    ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">No concepts yet. Create concepts first in the Concepts panel.</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
              <button
                onClick={() => !cgCustomCreateLoading && (setCgCustomCreateModal(false), setCgCustomCreateTitle(""), setCgCustomCreateSelectedIds(new Set()))}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!cgCustomCreateTitle.trim() || cgCustomCreateLoading) return;
                  setCgCustomCreateLoading(true);
                  try {
                    const res = await fetch("/api/me/concept-groups", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: cgCustomCreateTitle.trim(),
                        conceptIds: Array.from(cgCustomCreateSelectedIds),
                      }),
                    });
                    if (res.ok) {
                      setCgCustomCreateModal(false);
                      setCgCustomCreateTitle("");
                      setCgCustomCreateSelectedIds(new Set());
                      refetchConceptGroups();
                      refetchCustomConcepts();
                    }
                  } catch {
                    /* ignore */
                  } finally {
                    setCgCustomCreateLoading(false);
                  }
                }}
                disabled={!cgCustomCreateTitle.trim() || cgCustomCreateLoading}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {cgCustomCreateLoading ? "Creating…" : "Create group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cgCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => !cgCreateLoading && (setCgCreateModal(false), setCgCreateStep(1), setCgCreateDomain(""), setCgCreateQuestions([]), setCgCreateAnswers({}), setCgCreateConcepts([]))}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            {cgCreateStep === 1 && (
              <>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <h2 className="font-semibold text-lg mb-2">Create Domain</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    What domain or goal? (e.g. Finance, Career, Health)
                  </p>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                  <input
                    type="text"
                    value={cgCreateDomain}
                    onChange={(e) => setCgCreateDomain(e.target.value)}
                    placeholder="e.g. Finance"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    disabled={cgCreateLoading}
                  />
                </div>
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
                  <button
                    onClick={() => !cgCreateLoading && (setCgCreateModal(false), setCgCreateStep(1), setCgCreateDomain(""), setCgCreateQuestions([]), setCgCreateAnswers({}), setCgCreateConcepts([]))}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!cgCreateDomain.trim() || cgCreateLoading) return;
                      setCgCreateLoading(true);
                      try {
                        const res = await fetch("/api/me/concept-groups/generate-questions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ domain: cgCreateDomain.trim(), language }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          const questions = (data.questions ?? []) as string[];
                          const suggestedAnswers = (data.suggestedAnswers ?? []) as string[];
                          const initialAnswers: Record<string, string> = {};
                          questions.forEach((q, i) => {
                            initialAnswers[q] = (suggestedAnswers[i] ?? "").trim();
                          });
                          setCgCreateQuestions(questions);
                          setCgCreateAnswers(initialAnswers);
                          setCgCreateStep(2);
                        }
                      } catch {
                        /* ignore */
                      } finally {
                        setCgCreateLoading(false);
                      }
                    }}
                    disabled={!cgCreateDomain.trim() || cgCreateLoading}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {cgCreateLoading ? "Generating…" : "Next"}
                  </button>
                </div>
              </>
            )}
            {cgCreateStep === 2 && cgCreateQuestions.length > 0 && (
              <>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <h2 className="font-semibold text-lg mb-2">Answer these questions</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Suggested answers are pre-filled. Edit or clear any to tailor your concepts for &quot;{cgCreateDomain}&quot;
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cgCreateQuestions.map((q) => (
                    <div key={q} className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0">
                        <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                          {q}
                        </label>
                        <textarea
                          value={cgCreateAnswers[q] ?? ""}
                          onChange={(e) =>
                            setCgCreateAnswers((prev) => ({ ...prev, [q]: e.target.value }))
                          }
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y min-h-[60px]"
                          placeholder="Your answer..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCgCreateAnswers((prev) => ({ ...prev, [q]: "" }))
                        }
                        className="mt-6 p-2 rounded-xl text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                        aria-label="Clear answer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
                  <button
                    onClick={() => setCgCreateStep(1)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      if (cgCreateLoading) return;
                      const answers = cgCreateQuestions
                        .filter((q) => (cgCreateAnswers[q] ?? "").trim())
                        .map((q) => ({ question: q, answer: cgCreateAnswers[q]!.trim() }));
                      if (answers.length === 0) return;
                      setCgCreateLoading(true);
                      try {
                        const res = await fetch("/api/me/concept-groups/generate-concepts", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            domain: cgCreateDomain.trim(),
                            answers,
                            language,
                          }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setCgCreateConcepts(data.concepts ?? []);
                          setCgCreateStep(3);
                        }
                      } catch {
                        /* ignore */
                      } finally {
                        setCgCreateLoading(false);
                      }
                    }}
                    disabled={cgCreateLoading}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {cgCreateLoading ? "Generating…" : "Generate concepts"}
                  </button>
                </div>
              </>
            )}
            {cgCreateStep === 3 && cgCreateConcepts.length > 0 && (
              <>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <h2 className="font-semibold text-lg mb-2">Review and edit concepts</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Edit the generated concepts, then click Save to create your domain.
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {cgCreateConcepts.map((c, i) => (
                    <div key={i} className="space-y-3">
                      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                        Concept {i + 1}
                      </div>
                      <input
                        type="text"
                        value={c.title}
                        onChange={(e) =>
                          setCgCreateConcepts((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i]!, title: e.target.value };
                            return next;
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        placeholder="Title"
                      />
                      <textarea
                        value={c.summary}
                        onChange={(e) =>
                          setCgCreateConcepts((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i]!, summary: e.target.value };
                            return next;
                          })
                        }
                        rows={3}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        placeholder="Summary"
                      />
                      <input
                        type="text"
                        value={c.enrichmentPrompt}
                        onChange={(e) =>
                          setCgCreateConcepts((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i]!, enrichmentPrompt: e.target.value };
                            return next;
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        placeholder="Core idea + when it's relevant (25-40 words)"
                      />
                      {i < cgCreateConcepts.length - 1 && (
                        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-2 justify-end">
                  <button
                    onClick={() => setCgCreateStep(2)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      const valid = cgCreateConcepts.filter(
                        (c) => c.title.trim() && c.summary.trim() && c.enrichmentPrompt.trim()
                      );
                      if (valid.length === 0 || cgCreateLoading) return;
                      setCgCreateLoading(true);
                      try {
                        const res = await fetch("/api/me/concept-groups", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            domain: cgCreateDomain.trim(),
                            concepts: valid,
                          }),
                        });
                        if (res.ok) {
                          setCgCreateModal(false);
                          setCgCreateStep(1);
                          setCgCreateDomain("");
                          setCgCreateQuestions([]);
                          setCgCreateAnswers({});
                          setCgCreateConcepts([]);
                          refetchConceptGroups();
                          refetchCustomConcepts();
                          setCgCreateSuccess(true);
                          setTimeout(() => setCgCreateSuccess(false), 2000);
                        }
                      } catch {
                        /* ignore */
                      } finally {
                        setCgCreateLoading(false);
                      }
                    }}
                    disabled={
                      cgCreateConcepts.every(
                        (c) => !c.title.trim() || !c.summary.trim() || !c.enrichmentPrompt.trim()
                      ) || cgCreateLoading
                    }
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {cgCreateLoading ? "Saving…" : "Save domain"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cgDetailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setCgDetailModal(null)}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="font-semibold text-lg truncate pr-2">{cgDetailModal.title}</h2>
              <button
                onClick={() => setCgDetailModal(null)}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(cgDetailModal.concepts ?? []).length > 0 ? (
                <div className="space-y-2">
                  {(cgDetailModal.concepts ?? []).map((cc) => (
                    <div
                      key={cc._id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors relative"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const updatedIds = (cgDetailModal.conceptIds ?? []).filter((id) => id !== cc._id);
                          fetch(`/api/me/concept-groups/${cgDetailModal._id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ conceptIds: updatedIds }),
                          }).then((r) => {
                            if (r.ok) {
                              setCgDetailModal((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      conceptIds: updatedIds,
                                      concepts: (prev.concepts ?? []).filter((c) => c._id !== cc._id),
                                    }
                                  : null
                              );
                              refetchConceptGroups();
                              refetchCustomConcepts();
                            }
                          });
                        }}
                        className="absolute top-2 right-2 z-20 p-1.5 rounded-lg opacity-70 hover:opacity-100 bg-black/50 text-white hover:bg-red-600 transition-all duration-200 touch-manipulation"
                        aria-label={`Remove ${cc.title} from ${cgDetailModal.isCustomGroup ? "group" : "domain"}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3.5 h-3.5"
                        >
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setCcDetailModal(cc)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && setCcDetailModal(cc)
                        }
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <span className="text-sm font-medium line-clamp-1">{cc.title}</span>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                          {cc.enrichmentPrompt}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No concepts in this {cgDetailModal.isCustomGroup ? "group" : "domain"} yet.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCgDeleteConfirmModal(cgDetailModal);
                    setCgDetailModal(null);
                  }}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Delete {cgDetailModal.isCustomGroup ? "group" : "domain"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cgDeleteConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setCgDeleteConfirmModal(null)}
          aria-modal
          role="dialog"
        >
          <div
            className="bg-background rounded-3xl shadow-xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-lg">Delete {cgDeleteConfirmModal.isCustomGroup ? "group" : "domain"}?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {cgDeleteConfirmModal.isCustomGroup
                ? `Deleting "${cgDeleteConfirmModal.title}" will remove the group. Concepts will remain in your library.`
                : `Deleting "${cgDeleteConfirmModal.title}" will remove the domain and all its concepts.`}
            </p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
              Are you sure you want to delete?
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setCgDeleteConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const cg = cgDeleteConfirmModal;
                  setCgDeleteConfirmModal(null);
                  try {
                    const res = await fetch(`/api/me/concept-groups/${cg._id}`, {
                      method: "DELETE",
                    });
                    if (res.ok) {
                      setConceptGroups((prev) => prev.filter((x) => x._id !== cg._id));
                      refetchConceptGroups();
                      refetchCustomConcepts();
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMentalModel && (
        <MentalModelModal
          model={selectedMentalModel}
          isRtl={isRtlLanguage(language)}
          canSaveToConcepts={!isAnonymous && !incognitoMode}
          isSavedInConcepts={savedConcepts.some((c) => c.modelId === selectedMentalModel.id)}
          onClose={() => {
            setSelectedMentalModel(null);
            setRelevanceContext(null);
          }}
          messages={messages}
          onSendMessage={(text) => {
            setSelectedMentalModel(null);
            sendMessage(text);
          }}
          sessionId={currentSessionId}
          relevanceContext={relevanceContext}
          onOpenRelated={(id) => {
            setRelevanceContext(null);
            const img = typeof window !== "undefined" ? new window.Image() : null;
            if (img && !id.startsWith("custom_")) img.src = `/images/${id.replace(/_/g, "-")}.png`;
            fetch(`/api/mental-models/${id}?language=${language}`)
              .then((r) => (r.ok ? r.json() : Promise.reject()))
              .then((m: MentalModel) => setSelectedMentalModel(m))
              .catch(() => {});
          }}
          onSavedToLibrary={() => {
            refetchSavedConcepts();
            setConceptSavedToast(true);
            setTimeout(() => setConceptSavedToast(false), 3000);
          }}
          onTagAdded={(updatedSession) => {
            if (updatedSession?.mentalModelTags) {
              setSessions((prev) =>
                prev.map((s) =>
                  s._id === updatedSession._id
                    ? { ...s, mentalModelTags: updatedSession.mentalModelTags }
                    : s
                )
              );
            } else {
              refetchSessions();
            }
          }}
        />
      )}

      {/* Prompt Games - dedicated modal with category selection and gallery-style browsing */}
      {waysOfLookingAtModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-sm"
          onClick={() => {
            if (waysOfLookingAtDigital) setWaysOfLookingAtDigital(null);
            else if (waysOfLookingAtHuman) setWaysOfLookingAtHuman(null);
            else if (waysOfLookingAtMicrocosm) setWaysOfLookingAtMicrocosm(null);
            else if (waysOfLookingAtCuisine) setWaysOfLookingAtCuisine(null);
            else if (waysOfLookingAtCity) setWaysOfLookingAtCity(null);
            else if (waysOfLookingAtCategory) setWaysOfLookingAtCategory(null);
            else { setWaysOfLookingAtModalOpen(false); setWaysOfLookingAtDrawMode(false); }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Prompt Games"
        >
          <div
            className="relative rounded-3xl shadow-xl w-full max-w-[min(94vw,720px)] max-h-[85vh] overflow-hidden flex flex-col bg-background border border-neutral-200 dark:border-neutral-700 animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
              <div className="flex items-center gap-2">
                {(waysOfLookingAtCategory || waysOfLookingAtCity || waysOfLookingAtCuisine || waysOfLookingAtMicrocosm || waysOfLookingAtHuman || waysOfLookingAtDigital) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (waysOfLookingAtDigital) setWaysOfLookingAtDigital(null);
                      else if (waysOfLookingAtHuman) setWaysOfLookingAtHuman(null);
                      else if (waysOfLookingAtMicrocosm) setWaysOfLookingAtMicrocosm(null);
                      else if (waysOfLookingAtCuisine) setWaysOfLookingAtCuisine(null);
                      else if (waysOfLookingAtCity) setWaysOfLookingAtCity(null);
                      else setWaysOfLookingAtCategory(null);
                    }}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
                    aria-label={waysOfLookingAtDigital || waysOfLookingAtHuman ? "Back to subdomains" : waysOfLookingAtMicrocosm ? "Back to subdomains" : waysOfLookingAtCuisine ? "Back to cuisines" : waysOfLookingAtCity ? "Back to cities" : "Back to categories"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2 className="text-lg font-semibold text-foreground">
                  {waysOfLookingAtDrawMode && !waysOfLookingAtCategory
                    ? "Draw a perspective card"
                    : waysOfLookingAtCity
                      ? `${domainDisplayName[waysOfLookingAtCategory ?? ""] ?? "Urban Jungle"} — ${waysOfLookingAtCity === "ny" ? "New York" : waysOfLookingAtCity === "sf" ? "San Francisco" : waysOfLookingAtCity === "london" ? "London" : waysOfLookingAtCity === "paris" ? "Paris" : "Bangalore"}`
                      : waysOfLookingAtCuisine
                        ? `Culinary Lab — ${culinaryLabCuisineToName[waysOfLookingAtCuisine] ?? waysOfLookingAtCuisine}`
                        : waysOfLookingAtMicrocosm
                          ? `Natural Microcosm — ${naturalMicrocosmSubToName[waysOfLookingAtMicrocosm] ?? waysOfLookingAtMicrocosm}`
                          : waysOfLookingAtHuman
                            ? `The Human Interface — ${humanInterfaceSubToName[waysOfLookingAtHuman] ?? waysOfLookingAtHuman}`
                            : waysOfLookingAtDigital
                              ? `Digital Ghost — ${digitalGhostSubToName[waysOfLookingAtDigital] ?? waysOfLookingAtDigital}`
                              : waysOfLookingAtCategory
                                ? domainDisplayName[waysOfLookingAtCategory] ?? perspectiveDecks.find((d) => (d.domain || "").toLowerCase() === waysOfLookingAtCategory)?.name ?? "Prompt Games"
                                : "Prompt Games"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => { setWaysOfLookingAtModalOpen(false); setWaysOfLookingAtDrawMode(false); }}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-600 dark:text-neutral-400"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!waysOfLookingAtCategory ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {waysOfLookingAtDrawMode ? "Choose a domain" : "Choose a category to browse perspective cards."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {perspectiveDecks.length === 0 ? (
                      <p className="text-sm text-neutral-500 col-span-2">Loading categories…</p>
                    ) : (
                      [...new Set(perspectiveDecks.map((d) => (d.domain || "other").toLowerCase()))].map((domain) => {
                        const deck = perspectiveDecks.find((d) => (d.domain || "").toLowerCase() === domain);
                        if (!deck) return null;
                        return (
                          <button
                            key={domain}
                            type="button"
                            onClick={async () => {
                              playSelectionChime();
                              if (waysOfLookingAtDrawMode && domain === "art") {
                                try {
                                  const deck = perspectiveDecks.find((d) => (d.domain || "").toLowerCase() === domain);
                                  if (deck?.id) {
                                    const res = await fetch(`/api/perspective-decks/${deck.id}/random`);
                                    const data = await res.json();
                                    if (data.card && data.deckId) {
                                      setDrawnPerspectiveCard({ card: data.card, deckId: data.deckId, deckName: deck.name });
                                      setWaysOfLookingAtModalOpen(false);
                                      setWaysOfLookingAtDrawMode(false);
                                    }
                                  }
                                } catch { /* ignore */ }
                                return;
                              }
                              setWaysOfLookingAtCategory(domain);
                              setWaysOfLookingAtCity(null);
                              setWaysOfLookingAtCuisine(null);
                              setWaysOfLookingAtMicrocosm(null);
                              setWaysOfLookingAtHuman(null);
                              setWaysOfLookingAtDigital(null);
                            }}
                            className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all text-left group"
                          >
                            <span className="text-base font-medium text-foreground capitalize group-hover:text-foreground">
                              {domainDisplayName[domain] ?? domain.replace(/_/g, " ")}
                            </span>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                              {domain === "urban_jungle"
                                ? "250 cards across New York, San Francisco, London, Paris, and Bangalore—from scale and light to layers of history."
                                : domain === "culinary_lab"
                                  ? "250 cards across Indian, Italian, Pizza, Chinese, and Sushi—from the chemistry of a bite to the archaeology of ingredients."
                                  : domain === "natural_microcosm"
                                    ? "250 cards across Forest Floor, Garden, Rocks, Pond, and Insect Territories—from the invisible engineering of a leaf to the territorial dramas of insects."
                                    : domain === "human_interface"
                                      ? "250 cards across Coffee Shop, Transit Hub, Workplace, Retail, and Public Space—from queue choreography to invisible scripts and the anthropology of shared space."
                                      : domain === "digital_ghost"
                                        ? "250 cards across Buttons, Loading, Error, Data, and Onboarding—from the intent behind a click to the physicality of data and when software breaks character."
                                        : deck.description}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : waysOfLookingAtCategory === "urban_jungle" && !waysOfLookingAtCity ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {waysOfLookingAtDrawMode ? "Choose a subdomain (city)" : "Choose a city to browse its 50 perspective cards."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "ny", name: "New York" },
                      { id: "sf", name: "San Francisco" },
                      { id: "london", name: "London" },
                      { id: "paris", name: "Paris" },
                      { id: "blr", name: "Bangalore" },
                    ].map((city) => (
                      <button
                        key={city.id}
                        type="button"
                        onClick={async () => {
                          playSelectionChime();
                          if (waysOfLookingAtDrawMode) {
                            try {
                              const deckId = urbanJungleCityToDeckId[city.id];
                              if (deckId) {
                                const res = await fetch(`/api/perspective-decks/${deckId}/random`);
                                const data = await res.json();
                                if (data.card && data.deckId) {
                                  const deck = perspectiveDecks.find((d) => d.id === deckId);
                                  setDrawnPerspectiveCard({
                                    card: data.card,
                                    deckId: data.deckId,
                                    deckName: deck?.name ?? `Urban Jungle — ${city.name}`,
                                  });
                                  setWaysOfLookingAtModalOpen(false);
                                  setWaysOfLookingAtDrawMode(false);
                                }
                              }
                            } catch { /* ignore */ }
                            return;
                          }
                          setWaysOfLookingAtCity(city.id);
                        }}
                        className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all text-left group"
                      >
                        <span className="text-base font-medium text-foreground group-hover:text-foreground">
                          {city.name}
                        </span>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          50 perspective cards for city and architecture
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : waysOfLookingAtCategory === "culinary_lab" && !waysOfLookingAtCuisine ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {waysOfLookingAtDrawMode ? "Choose a cuisine" : "Choose a cuisine to browse its 50 perspective cards."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "indian", name: "Indian" },
                      { id: "italian", name: "Italian" },
                      { id: "pizza", name: "Pizza" },
                      { id: "chinese", name: "Chinese" },
                      { id: "sushi", name: "Sushi" },
                    ].map((cuisine) => (
                      <button
                        key={cuisine.id}
                        type="button"
                        onClick={async () => {
                          playSelectionChime();
                          if (waysOfLookingAtDrawMode) {
                            try {
                              const deckId = culinaryLabCuisineToDeckId[cuisine.id];
                              if (deckId) {
                                const res = await fetch(`/api/perspective-decks/${deckId}/random`);
                                const data = await res.json();
                                if (data.card && data.deckId) {
                                  const deck = perspectiveDecks.find((d) => d.id === deckId);
                                  setDrawnPerspectiveCard({
                                    card: data.card,
                                    deckId: data.deckId,
                                    deckName: deck?.name ?? `Culinary Lab — ${cuisine.name}`,
                                  });
                                  setWaysOfLookingAtModalOpen(false);
                                  setWaysOfLookingAtDrawMode(false);
                                }
                              }
                            } catch { /* ignore */ }
                            return;
                          }
                          setWaysOfLookingAtCuisine(cuisine.id);
                        }}
                        className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all text-left group"
                      >
                        <span className="text-base font-medium text-foreground capitalize group-hover:text-foreground">
                          {cuisine.name}
                        </span>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          50 perspective cards for food and eating
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : waysOfLookingAtCategory === "natural_microcosm" && !waysOfLookingAtMicrocosm ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {waysOfLookingAtDrawMode ? "Choose a subdomain" : "Choose a subdomain to browse its 50 perspective cards."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "forest_floor", name: "Forest Floor" },
                      { id: "garden_backyard", name: "Garden & Backyard" },
                      { id: "rocks_stones", name: "Rocks & Stones" },
                      { id: "pond_puddle", name: "Pond & Puddle" },
                      { id: "insect_territories", name: "Insect Territories" },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={async () => {
                          playSelectionChime();
                          if (waysOfLookingAtDrawMode) {
                            try {
                              const deckId = naturalMicrocosmSubToDeckId[sub.id];
                              if (deckId) {
                                const res = await fetch(`/api/perspective-decks/${deckId}/random`);
                                const data = await res.json();
                                if (data.card && data.deckId) {
                                  const deck = perspectiveDecks.find((d) => d.id === deckId);
                                  setDrawnPerspectiveCard({
                                    card: data.card,
                                    deckId: data.deckId,
                                    deckName: deck?.name ?? `Natural Microcosm — ${sub.name}`,
                                  });
                                  setWaysOfLookingAtModalOpen(false);
                                  setWaysOfLookingAtDrawMode(false);
                                }
                              }
                            } catch { /* ignore */ }
                            return;
                          }
                          setWaysOfLookingAtMicrocosm(sub.id);
                        }}
                        className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all text-left group"
                      >
                        <span className="text-base font-medium text-foreground capitalize group-hover:text-foreground">
                          {sub.name}
                        </span>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          50 perspective cards for ecology and the outdoors
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : waysOfLookingAtCategory === "human_interface" && !waysOfLookingAtHuman ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {waysOfLookingAtDrawMode ? "Choose a subdomain" : "Choose a subdomain to browse its 50 perspective cards."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "coffee_shop", name: "Coffee Shop" },
                      { id: "transit_hub", name: "Transit Hub" },
                      { id: "workplace", name: "Workplace" },
                      { id: "retail", name: "Retail" },
                      { id: "public_space", name: "Public Space" },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={async () => {
                          playSelectionChime();
                          if (waysOfLookingAtDrawMode) {
                            try {
                              const deckId = humanInterfaceSubToDeckId[sub.id];
                              if (deckId) {
                                const res = await fetch(`/api/perspective-decks/${deckId}/random`);
                                const data = await res.json();
                                if (data.card && data.deckId) {
                                  const deck = perspectiveDecks.find((d) => d.id === deckId);
                                  setDrawnPerspectiveCard({
                                    card: data.card,
                                    deckId: data.deckId,
                                    deckName: deck?.name ?? `The Human Interface — ${sub.name}`,
                                  });
                                  setWaysOfLookingAtModalOpen(false);
                                  setWaysOfLookingAtDrawMode(false);
                                }
                              }
                            } catch { /* ignore */ }
                            return;
                          }
                          setWaysOfLookingAtHuman(sub.id);
                        }}
                        className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all text-left group"
                      >
                        <span className="text-base font-medium text-foreground capitalize group-hover:text-foreground">
                          {sub.name}
                        </span>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          50 perspective cards for social observation and anthropology
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : waysOfLookingAtCategory === "digital_ghost" && !waysOfLookingAtDigital ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {waysOfLookingAtDrawMode ? "Choose a subdomain" : "Choose a subdomain to browse its 50 perspective cards."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "buttons_controls", name: "Buttons & Controls" },
                      { id: "loading_states", name: "Loading States" },
                      { id: "error_edge", name: "Error & Edge" },
                      { id: "data_storage", name: "Data & Storage" },
                      { id: "onboarding_flow", name: "Onboarding & Flow" },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={async () => {
                          playSelectionChime();
                          if (waysOfLookingAtDrawMode) {
                            try {
                              const deckId = digitalGhostSubToDeckId[sub.id];
                              if (deckId) {
                                const res = await fetch(`/api/perspective-decks/${deckId}/random`);
                                const data = await res.json();
                                if (data.card && data.deckId) {
                                  const deck = perspectiveDecks.find((d) => d.id === deckId);
                                  setDrawnPerspectiveCard({
                                    card: data.card,
                                    deckId: data.deckId,
                                    deckName: deck?.name ?? `Digital Ghost — ${sub.name}`,
                                  });
                                  setWaysOfLookingAtModalOpen(false);
                                  setWaysOfLookingAtDrawMode(false);
                                }
                              }
                            } catch { /* ignore */ }
                            return;
                          }
                          setWaysOfLookingAtDigital(sub.id);
                        }}
                        className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all text-left group"
                      >
                        <span className="text-base font-medium text-foreground capitalize group-hover:text-foreground">
                          {sub.name}
                        </span>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          50 perspective cards for technology and software
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {waysOfLookingAtCardsLoading ? (
                    <p className="text-sm text-neutral-500">Loading cards…</p>
                  ) : waysOfLookingAtCards && waysOfLookingAtCards.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {waysOfLookingAtCards.map((card) => {
                        const deck = waysOfLookingAtCity
                          ? perspectiveDecks.find((d) => d.id === urbanJungleCityToDeckId[waysOfLookingAtCity])
                          : waysOfLookingAtCuisine
                            ? perspectiveDecks.find((d) => d.id === culinaryLabCuisineToDeckId[waysOfLookingAtCuisine])
                            : waysOfLookingAtMicrocosm
                              ? perspectiveDecks.find((d) => d.id === naturalMicrocosmSubToDeckId[waysOfLookingAtMicrocosm])
                              : waysOfLookingAtHuman
                                ? perspectiveDecks.find((d) => d.id === humanInterfaceSubToDeckId[waysOfLookingAtHuman])
                                : waysOfLookingAtDigital
                                  ? perspectiveDecks.find((d) => d.id === digitalGhostSubToDeckId[waysOfLookingAtDigital])
                                  : perspectiveDecks.find((d) => (d.domain || "").toLowerCase() === waysOfLookingAtCategory);
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => {
                              playSelectionChime();
                              setDrawnPerspectiveCard({
                                card,
                                deckId: deck?.id ?? "",
                                deckName: deck?.name ?? "Prompt Games",
                              });
                            }}
                            className="flex flex-col p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all text-left min-h-[100px]"
                          >
                            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                              {card.name}
                            </span>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                              {card.prompt}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">No cards in this category.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {drawnPerspectiveCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-sm"
          onClick={() => { setDrawnPerspectiveCard(null); setTtsHighlight(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="perspective-card-title"
        >
          <div
            className="relative rounded-3xl shadow-xl w-full max-w-[var(--modal-perspective-card-max-w)] overflow-hidden flex flex-col bg-background border border-neutral-200 dark:border-neutral-700 animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <div>
                <h2 id="perspective-card-title" className="font-semibold text-lg text-foreground">
                  {drawnPerspectiveCard.card.name}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  from {drawnPerspectiveCard.deckName}
                </p>
              </div>
              <button
                onClick={() => { setDrawnPerspectiveCard(null); setTtsHighlight(null); }}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="group/tts flex items-start gap-3">
                <p className="flex-1 min-w-0 text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap" dir={isRtlLanguage(language) ? "rtl" : undefined}>
                  {ttsHighlight && "textId" in ttsHighlight && ttsHighlight.textId === "perspective-card-prompt" ? (
                    <TtsHighlightedText text={drawnPerspectiveCard.card.prompt} charEnd={ttsHighlight.charEnd} />
                  ) : (
                    drawnPerspectiveCard.card.prompt
                  )}
                </p>
                <TTSButton
                  text={drawnPerspectiveCard.card.prompt}
                  showOnHover={false}
                  layout="vertical"
                  ariaLabel="Listen to prompt"
                  className="shrink-0"
                  onTtsProgress={(charEnd) => setTtsHighlight({ textId: "perspective-card-prompt", charEnd })}
                  onTtsEnd={() => setTtsHighlight(null)}
                />
              </div>
              {drawnPerspectiveCard.card.follow_ups && drawnPerspectiveCard.card.follow_ups.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                    Follow-up questions
                  </p>
                  <ul className="space-y-1">
                    {drawnPerspectiveCard.card.follow_ups.map((q, i) => (
                      <li key={i} className="text-sm text-neutral-600 dark:text-neutral-400">
                        • {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => {
                  playSelectionChime();
                  const prompt = drawnPerspectiveCard.card.prompt;
                  const name = drawnPerspectiveCard.card.name;
                  const assistantContent = `Let me invite you to look through this lens:\n\n${prompt}\n\nWhat comes to mind?`;
                  const initialMessage = {
                    role: "assistant" as const,
                    content: assistantContent,
                    perspectiveCard: { name, prompt },
                  };
                  setDrawnPerspectiveCard(null);
                  setWaysOfLookingAtModalOpen(false);
                  setWaysOfLookingAtDrawMode(false);
                  setWaysOfLookingAtCategory(null);
                  setWaysOfLookingAtCity(null);
                  setWaysOfLookingAtCuisine(null);
                  setWaysOfLookingAtMicrocosm(null);
                  if (typeof window !== "undefined" && window.innerWidth < 1024) {
                    setLibraryPanelOpen(null);
                    setSidebarOpen(false);
                  }
                  if (sessionId !== "new" && sessionId !== "incognito") {
                    try {
                      sessionStorage.setItem(PERSPECTIVE_CARD_START_KEY, JSON.stringify({
                        assistantContent,
                        prompt,
                        name,
                      }));
                    } catch {
                      /* ignore */
                    }
                    router.push("/chat/new");
                  } else {
                    setMessages([initialMessage]);
                    setPendingCardContext({ prompt, name });
                    setCurrentSessionId(null);
                    setCurrentSession(null);
                    setCollapsedSummary(null);
                    inputRef.current?.focus();
                  }
                }}
                className="w-full px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
              >
                Start conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </TtsHighlightContext.Provider>
  );
}
