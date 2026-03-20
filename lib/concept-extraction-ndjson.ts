/** Shared Content-Type for streaming concept extraction (newline-delimited JSON) */
export const CONCEPT_EXTRACTION_NDJSON_CONTENT_TYPE =
  "application/x-ndjson; charset=utf-8";

export type ConceptExtractionProgress = { pass: number; total: number };

/**
 * Reads a newline-delimited JSON stream from a successful fetch Response.
 * Invokes `onProgress` for each `{ progress: { pass, total } }` line.
 * Returns the final payload object (must include `groups`).
 */
export async function consumeConceptExtractionNdjsonStream(
  res: Response,
  onProgress: (p: ConceptExtractionProgress) => void
): Promise<Record<string, unknown>> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      typeof err.error === "string" ? err.error : `Request failed (${res.status})`
    );
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("ndjson") && !ct.includes("x-ndjson")) {
    return (await res.json()) as Record<string, unknown>;
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  let lastWithGroups: Record<string, unknown> | null = null;

  const handleMessage = (msg: Record<string, unknown>) => {
    if (msg.error) throw new Error(String(msg.error));
    const prog = msg.progress;
    if (prog && typeof prog === "object" && prog !== null) {
      const p = prog as { pass?: unknown; total?: unknown };
      if (typeof p.pass === "number" && typeof p.total === "number") {
        onProgress({ pass: p.pass, total: p.total });
      }
    }
    if (Array.isArray(msg.groups)) {
      lastWithGroups = msg;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handleMessage(JSON.parse(line) as Record<string, unknown>);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  if (buffer.trim()) {
    try {
      handleMessage(JSON.parse(buffer) as Record<string, unknown>);
    } catch {
      /* incomplete line */
    }
  }
  if (!lastWithGroups) {
    throw new Error("Invalid extraction response");
  }
  const groups = lastWithGroups["groups"];
  if (!Array.isArray(groups)) {
    throw new Error("Invalid extraction response");
  }
  return lastWithGroups;
}
