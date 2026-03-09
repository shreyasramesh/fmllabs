/**
 * Strips markdown to plain text for TTS. Handles common markdown syntax.
 */
export function stripMarkdown(md: string): string {
  if (!md || typeof md !== "string") return "";
  let s = md
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1)) // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // images
    .replace(/^#{1,6}\s+/gm, "") // headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/__([^_]+)__/g, "$1") // bold alt
    .replace(/_([^_]+)_/g, "$1") // italic alt
    .replace(/~~([^~]+)~~/g, "$1") // strikethrough
    .replace(/^\s*[-*+]\s+/gm, "") // list bullets
    .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
    .replace(/^\s*>\s*/gm, "") // blockquotes
    .replace(/\n{3,}/g, "\n\n") // collapse multiple newlines
    .trim();
  return s;
}
