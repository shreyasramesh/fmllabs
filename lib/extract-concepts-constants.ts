/** Characters per Gemini call when text is split into multiple extraction passes */
export const EXTRACT_CONCEPTS_CHUNK_CHARS = 36_000;

/** Overlap between consecutive chunks so ideas aren’t lost at boundaries */
export const EXTRACT_CONCEPTS_CHUNK_OVERLAP_CHARS = 1_500;

/** Hard cap on total input length (abuse / cost guardrail) */
export const EXTRACT_CONCEPTS_MAX_TOTAL_CHARS = 600_000;

/**
 * @deprecated Use EXTRACT_CONCEPTS_CHUNK_CHARS for UI copy about segment size.
 * Kept as alias so imports don’t break.
 */
export const EXTRACT_CONCEPTS_MAX_CHARS = EXTRACT_CONCEPTS_CHUNK_CHARS;
