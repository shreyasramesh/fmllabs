"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

const MENTAL_MODEL_HREF_PREFIX = "#mm-";
const LTM_HREF_PREFIX = "#ltm-";
const CC_HREF_PREFIX = "#cc-";
const CG_HREF_PREFIX = "#cg-";

const LTM_TOKEN_REGEX = /\[\[memory:([a-fA-F0-9]{24})\]\]/g;
const CC_TOKEN_REGEX = /\[\[concept:([a-fA-F0-9]{24})\]\]/g;
const CG_TOKEN_REGEX = /\[\[group:([a-fA-F0-9]{24})\]\]/g;
const LEGACY_LTM_REGEX = /@ltm:([a-fA-F0-9]{24})/g;
const LEGACY_CC_REGEX = /@cc:([a-fA-F0-9]{24})/g;
const LEGACY_CD_REGEX = /@cd:([a-fA-F0-9]{24})/g;
const LEGACY_CG_REGEX = /@cg:([a-fA-F0-9]{24})/g;

function MentalModelLink({
  id,
  content,
  onMentalModelClick,
  tooltip,
  children,
}: {
  id: string;
  content: string;
  onMentalModelClick: (id: string, sourceMessage?: string) => void;
  tooltip: string | null;
  children: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMentalModelClick(id, content);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onMentalModelClick(id, content);
        }
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      className="relative inline-flex items-baseline py-px px-1.5 rounded-lg text-sm font-medium bg-foreground text-background border-[0.5px] border-background/30 dark:border-neutral-600 cursor-pointer hover:opacity-90 transition-opacity duration-150 active:scale-[0.98] align-baseline"
    >
      {children}
      {tooltip && showTooltip && (
        <span
          className="absolute left-0 bottom-full mb-1 px-2 py-1.5 text-xs bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 rounded-lg shadow-lg max-w-[240px] z-50 pointer-events-none animate-fade-in-up"
          role="tooltip"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}

function ReferenceLink({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="relative inline-flex items-baseline py-px px-1.5 rounded-lg text-sm font-medium bg-foreground text-background border-[0.5px] border-background/30 dark:border-neutral-600 cursor-pointer hover:opacity-90 transition-opacity duration-150 active:scale-[0.98] align-baseline"
    >
      {children}
    </span>
  );
}

export interface MentalModelPreview {
  oneLiner?: string;
  quickIntro?: string;
}

function preprocessReferenceLinks(
  text: string,
  ltmIdToTitle: Map<string, string>,
  ccIdToTitle: Map<string, string>,
  cgIdToTitle: Map<string, string>
): string {
  const replaceLtm = (id: string) =>
    `[${ltmIdToTitle.get(id) ?? "Memory"}](${LTM_HREF_PREFIX}${id})`;
  const replaceCc = (id: string) =>
    `[${ccIdToTitle.get(id) ?? "Concept"}](${CC_HREF_PREFIX}${id})`;
  const replaceCg = (id: string) =>
    `[${cgIdToTitle.get(id) ?? "Domain"}](${CG_HREF_PREFIX}${id})`;

  return text
    .replace(LTM_TOKEN_REGEX, (_, id) => replaceLtm(id))
    .replace(LEGACY_LTM_REGEX, (_, id) => replaceLtm(id))
    .replace(CC_TOKEN_REGEX, (_, id) => replaceCc(id))
    .replace(LEGACY_CC_REGEX, (_, id) => replaceCc(id))
    .replace(CG_TOKEN_REGEX, (_, id) => replaceCg(id))
    .replace(LEGACY_CD_REGEX, (_, id) => replaceCg(id))
    .replace(LEGACY_CG_REGEX, (_, id) => replaceCg(id));
}

function preprocessMentalModelLinks(
  text: string,
  idToName: Map<string, string>
): string {
  // Build name -> id map and sort names by length descending to avoid partial matches
  const nameToId = new Map<string, string>();
  idToName.forEach((name, id) => nameToId.set(name, id));
  const names = [...nameToId.keys()].sort((a, b) => b.length - a.length);

  // First: convert plain mental model names to [[id]] format (so they become links)
  let result = text;
  for (const name of names) {
    const id = nameToId.get(name)!;
    result = result.replace(
      new RegExp(`(?<!\\[\\[)\\b(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b(?!\\]\\])`, "g"),
      `[[${id}]]`
    );
  }

  // Second: convert [[id]] or [[Display Name]] to markdown links
  // Match [[id]] (lowercase, underscores) or [[any text]] for display names
  return result.replace(/\[\s*\[\s*([^\]]+?)\s*\]\s*\]/g, (_, content) => {
    const trimmed = content.trim();
    // If it's an id (lowercase, underscores), use it
    if (/^[a-z0-9_]+$/.test(trimmed)) {
      const name = idToName.get(trimmed) ?? trimmed.replace(/_/g, " ");
      return `[${name}](${MENTAL_MODEL_HREF_PREFIX}${trimmed})`;
    }
    // Otherwise treat as display name and look up id
    const id = nameToId.get(trimmed);
    if (id) {
      return `[${trimmed}](${MENTAL_MODEL_HREF_PREFIX}${id})`;
    }
    // No match - return as-is (will render as plain text)
    return `[[${trimmed}]]`;
  });
}

export function ChatMarkdown({
  content,
  idToName,
  ltmIdToTitle = new Map(),
  ccIdToTitle = new Map(),
  cgIdToTitle = new Map(),
  onMentalModelClick,
  onLtmClick,
  onCustomConceptClick,
  onConceptGroupClick,
  previewMap,
}: {
  content: string;
  idToName: Map<string, string>;
  ltmIdToTitle?: Map<string, string>;
  ccIdToTitle?: Map<string, string>;
  cgIdToTitle?: Map<string, string>;
  onMentalModelClick: (id: string, sourceMessage?: string) => void;
  onLtmClick?: (id: string) => void;
  onCustomConceptClick?: (id: string) => void;
  onConceptGroupClick?: (id: string) => void;
  previewMap?: Map<string, MentalModelPreview>;
}) {
  const withRefs = preprocessReferenceLinks(
    content,
    ltmIdToTitle,
    ccIdToTitle,
    cgIdToTitle
  );
  const processed = preprocessMentalModelLinks(withRefs, idToName);

  return (
    <div className="prose prose-lg sm:prose-base prose-neutral dark:prose-invert max-w-prose leading-relaxed prose-p:my-3 prose-ul:my-2 prose-li:my-0.5">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith(MENTAL_MODEL_HREF_PREFIX)) {
              const id = href.slice(MENTAL_MODEL_HREF_PREFIX.length);
              const preview = previewMap?.get(id);
              const tooltip = preview?.oneLiner ?? preview?.quickIntro ?? null;
              return (
                <MentalModelLink
                  id={id}
                  content={content}
                  onMentalModelClick={onMentalModelClick}
                  tooltip={tooltip}
                >
                  {children}
                </MentalModelLink>
              );
            }
            if (href?.startsWith(LTM_HREF_PREFIX)) {
              const id = href.slice(LTM_HREF_PREFIX.length);
              const label = ltmIdToTitle.get(id) ?? "Memory";
              return onLtmClick ? (
                <ReferenceLink label={label} onClick={() => onLtmClick(id)}>
                  {children}
                </ReferenceLink>
              ) : (
                <span className="font-medium">{children}</span>
              );
            }
            if (href?.startsWith(CC_HREF_PREFIX)) {
              const id = href.slice(CC_HREF_PREFIX.length);
              const label = ccIdToTitle.get(id) ?? "Concept";
              return onCustomConceptClick ? (
                <ReferenceLink label={label} onClick={() => onCustomConceptClick(id)}>
                  {children}
                </ReferenceLink>
              ) : (
                <span className="font-medium">{children}</span>
              );
            }
            if (href?.startsWith(CG_HREF_PREFIX)) {
              const id = href.slice(CG_HREF_PREFIX.length);
              const label = cgIdToTitle.get(id) ?? "Domain";
              return onConceptGroupClick ? (
                <ReferenceLink label={label} onClick={() => onConceptGroupClick(id)}>
                  {children}
                </ReferenceLink>
              ) : (
                <span className="font-medium">{children}</span>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
