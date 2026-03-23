import { normalizeMentalModelCitationMarkup } from "@/lib/chat-utils";
import { stripMarkdown } from "@/lib/strip-markdown";

const FIGURE_TOKEN_REGEX = /\[\[figure:([a-z0-9_]+)\]\]/g;
const MM_TOKEN_REGEX = /\[\[(?!memory:|concept:|group:|figure:)([a-z0-9_]+)\]\]/g;
const MM_NAME_TOKEN_REGEX = /\[\[\s*([^[\]]+?)\s*\]\]/g;
const LTM_TOKEN_REGEX = /\[\[memory:([a-fA-F0-9]{24})\]\]/g;
const CC_TOKEN_REGEX = /\[\[concept:([a-fA-F0-9]{24})\]\]/g;
const CG_TOKEN_REGEX = /\[\[group:([a-fA-F0-9]{24})\]\]/g;
const LEGACY_MM_REGEX = /@mm:([a-z0-9_]+)/g;
const LEGACY_LTM_REGEX = /@ltm:([a-fA-F0-9]{24})/g;
const LEGACY_CC_REGEX = /@cc:([a-fA-F0-9]{24})/g;
const LEGACY_CD_REGEX = /@cd:([a-fA-F0-9]{24})/g;
const LEGACY_CG_REGEX = /@cg:([a-fA-F0-9]{24})/g;

export function resolveTtsReferenceText(
  text: string,
  {
    idToName,
    ltmIdToTitle,
    ccIdToTitle,
    cgIdToTitle,
    figureIdToName,
  }: {
    idToName?: Map<string, string>;
    ltmIdToTitle?: Map<string, string>;
    ccIdToTitle?: Map<string, string>;
    cgIdToTitle?: Map<string, string>;
    figureIdToName?: Map<string, string>;
  } = {}
): string {
  const nameToId = new Map<string, string>();
  idToName?.forEach((name, id) => nameToId.set(name, id));

  const normalized = normalizeMentalModelCitationMarkup(text);

  return stripMarkdown(
    normalized
      .replace(FIGURE_TOKEN_REGEX, (_, id: string) =>
        figureIdToName?.get(id) ?? id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      )
      .replace(LTM_TOKEN_REGEX, (_, id: string) => ltmIdToTitle?.get(id) ?? "Memory")
      .replace(LEGACY_LTM_REGEX, (_, id: string) => ltmIdToTitle?.get(id) ?? "Memory")
      .replace(CC_TOKEN_REGEX, (_, id: string) => ccIdToTitle?.get(id) ?? "Concept")
      .replace(LEGACY_CC_REGEX, (_, id: string) => ccIdToTitle?.get(id) ?? "Concept")
      .replace(CG_TOKEN_REGEX, (_, id: string) => cgIdToTitle?.get(id) ?? "Group")
      .replace(LEGACY_CD_REGEX, (_, id: string) => cgIdToTitle?.get(id) ?? "Group")
      .replace(LEGACY_CG_REGEX, (_, id: string) => cgIdToTitle?.get(id) ?? "Group")
      .replace(MM_TOKEN_REGEX, (_, id: string) => idToName?.get(id) ?? id.replace(/_/g, " "))
      .replace(LEGACY_MM_REGEX, (_, id: string) => idToName?.get(id) ?? id.replace(/_/g, " "))
      .replace(MM_NAME_TOKEN_REGEX, (_, rawName: string) => {
        const trimmed = rawName.trim();
        if (trimmed.startsWith("memory:") || trimmed.startsWith("concept:") || trimmed.startsWith("group:")) {
          return trimmed;
        }
        const resolvedId = nameToId.get(trimmed);
        return resolvedId ? (idToName?.get(resolvedId) ?? trimmed) : trimmed;
      })
  ).trim();
}
