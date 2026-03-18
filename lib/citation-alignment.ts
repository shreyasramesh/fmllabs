import type { RelevantContext } from "./chat-utils";

const MM_CITATION_REGEX = /\[\[([a-z0-9_]+)\]\]/g;
const LTM_CITATION_REGEX = /\[\[memory:([a-fA-F0-9]{24})\]\]/g;
const CC_CITATION_REGEX = /\[\[concept:([a-fA-F0-9]{24})\]\]/g;
const CG_CITATION_REGEX = /\[\[group:([a-fA-F0-9]{24})\]\]/g;

export type CitationAlignmentPolicy = "observe" | "warn" | "enforce";

export interface CitationAlignmentDiff {
  disallowedMentalModels: string[];
  disallowedLongTermMemories: string[];
  disallowedCustomConcepts: string[];
  disallowedConceptGroups: string[];
}

export interface CitationLabelMaps {
  mentalModelLabels?: Map<string, string>;
  longTermMemoryLabels?: Map<string, string>;
  customConceptLabels?: Map<string, string>;
  conceptGroupLabels?: Map<string, string>;
}

export function normalizeCitationAlignmentPolicy(
  policy?: string
): CitationAlignmentPolicy {
  if (policy === "warn" || policy === "enforce") return policy;
  return "observe";
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

export function extractCitedContextIds(text: string): {
  mentalModels: string[];
  longTermMemories: string[];
  customConcepts: string[];
  conceptGroups: string[];
} {
  return {
    mentalModels: unique([...text.matchAll(MM_CITATION_REGEX)].map((m) => m[1])),
    longTermMemories: unique(
      [...text.matchAll(LTM_CITATION_REGEX)].map((m) => m[1])
    ),
    customConcepts: unique([...text.matchAll(CC_CITATION_REGEX)].map((m) => m[1])),
    conceptGroups: unique([...text.matchAll(CG_CITATION_REGEX)].map((m) => m[1])),
  };
}

export function buildCitedContextFromText(
  text: string,
  labels: CitationLabelMaps = {}
): RelevantContext {
  const cited = extractCitedContextIds(text);
  return {
    mentalModels: cited.mentalModels.map((id) => ({
      id,
      reason: "cited in response",
      title: labels.mentalModelLabels?.get(id),
    })),
    longTermMemories: cited.longTermMemories.map((id) => ({
      id,
      reason: "cited in response",
      title: labels.longTermMemoryLabels?.get(id),
    })),
    customConcepts: cited.customConcepts.map((id) => ({
      id,
      reason: "cited in response",
      title: labels.customConceptLabels?.get(id),
    })),
    conceptGroups: cited.conceptGroups.map((id) => ({
      id,
      reason: "cited in response",
      title: labels.conceptGroupLabels?.get(id),
    })),
  };
}

export function diffCitationsAgainstPredicted(
  predicted: RelevantContext,
  cited: RelevantContext
): CitationAlignmentDiff {
  const allowedMm = new Set(predicted.mentalModels.map((m) => m.id));
  const allowedLtm = new Set(predicted.longTermMemories.map((m) => m.id));
  const allowedCc = new Set(predicted.customConcepts.map((m) => m.id));
  const allowedCg = new Set(predicted.conceptGroups.map((m) => m.id));

  return {
    disallowedMentalModels: cited.mentalModels
      .map((m) => m.id)
      .filter((id) => !allowedMm.has(id)),
    disallowedLongTermMemories: cited.longTermMemories
      .map((m) => m.id)
      .filter((id) => !allowedLtm.has(id)),
    disallowedCustomConcepts: cited.customConcepts
      .map((m) => m.id)
      .filter((id) => !allowedCc.has(id)),
    disallowedConceptGroups: cited.conceptGroups
      .map((m) => m.id)
      .filter((id) => !allowedCg.has(id)),
  };
}

export function hasCitationMismatches(diff: CitationAlignmentDiff): boolean {
  return (
    diff.disallowedMentalModels.length > 0 ||
    diff.disallowedLongTermMemories.length > 0 ||
    diff.disallowedCustomConcepts.length > 0 ||
    diff.disallowedConceptGroups.length > 0
  );
}

export function sanitizeDisallowedCitations(
  text: string,
  predicted: RelevantContext,
  labels: CitationLabelMaps = {}
): string {
  const allowedMm = new Set(predicted.mentalModels.map((m) => m.id));
  const allowedLtm = new Set(predicted.longTermMemories.map((m) => m.id));
  const allowedCc = new Set(predicted.customConcepts.map((m) => m.id));
  const allowedCg = new Set(predicted.conceptGroups.map((m) => m.id));

  return text
    .replace(MM_CITATION_REGEX, (full, id: string) => {
      if (allowedMm.has(id)) return full;
      return labels.mentalModelLabels?.get(id) ?? id.replace(/_/g, " ");
    })
    .replace(LTM_CITATION_REGEX, (full, id: string) => {
      if (allowedLtm.has(id)) return full;
      return labels.longTermMemoryLabels?.get(id) ?? "Memory";
    })
    .replace(CC_CITATION_REGEX, (full, id: string) => {
      if (allowedCc.has(id)) return full;
      return labels.customConceptLabels?.get(id) ?? "Concept";
    })
    .replace(CG_CITATION_REGEX, (full, id: string) => {
      if (allowedCg.has(id)) return full;
      return labels.conceptGroupLabels?.get(id) ?? "Group";
    });
}
