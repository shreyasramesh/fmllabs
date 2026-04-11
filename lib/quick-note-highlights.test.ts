import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuickNoteHighlightSegments,
  mergeNonOverlappingHighlightSegments,
  mergeRegexPreferredOverApi,
} from "./quick-note-highlights";

test("mergeNonOverlapping prefers longer span", () => {
  const merged = mergeNonOverlappingHighlightSegments([
    { start: 0, end: 3, kind: "temporal" },
    { start: 0, end: 5, kind: "duration" },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].end, 5);
});

test("buildQuickNoteHighlightSegments finds time and vague temporal", () => {
  const text = "Can we do later in the evening (5-7pm)?";
  const segs = buildQuickNoteHighlightSegments(text);
  const kinds = new Set(segs.map((s) => s.kind));
  assert.ok(kinds.has("temporal"));
  const joined = segs.map((s) => text.slice(s.start, s.end)).join("|");
  assert.match(joined, /later/i);
  assert.match(joined, /5-7pm/i);
});

test("mergeRegexPreferredOverApi drops api overlap with regex", () => {
  const text = "5-7pm run";
  const regex = buildQuickNoteHighlightSegments(text);
  const api = [{ start: 0, end: 7, kind: "nutrition" as const }];
  const out = mergeRegexPreferredOverApi(regex, api);
  assert.ok(out.some((s) => s.kind === "temporal" || text.slice(s.start, s.end).includes("5-7")));
});
