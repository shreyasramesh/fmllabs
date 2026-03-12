const CONTEXT_END = "---END-CONTEXT---";

/**
 * Strip the context block from the start of the stream and return the message content.
 */
export function stripContextBlock(accumulated: string): string {
  const idx = accumulated.indexOf(CONTEXT_END);
  if (idx === -1) return accumulated;
  return accumulated.slice(idx + CONTEXT_END.length).trimStart();
}
