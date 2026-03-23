import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCitedContextFromText,
  diffCitationsAgainstPredicted,
  extractCitedContextIds,
  hasCitationMismatches,
  sanitizeDisallowedCitations,
} from "./citation-alignment";
import type { RelevantContext } from "./chat-utils";

function emptyContext(): RelevantContext {
  return {
    mentalModels: [],
    longTermMemories: [],
    customConcepts: [],
    conceptGroups: [],
  };
}

test("extractCitedContextIds parses all citation categories", () => {
  const ids = extractCitedContextIds(
    "Use [[endowment_effect]], [[memory:0123456789abcdef01234567]], [[concept:abcdefabcdefabcdefabcdef]], [[group:fedcbafedcbafedcbafedcba]]."
  );
  assert.deepEqual(ids.mentalModels, ["endowment_effect"]);
  assert.deepEqual(ids.longTermMemories, ["0123456789abcdef01234567"]);
  assert.deepEqual(ids.customConcepts, ["abcdefabcdefabcdefabcdef"]);
  assert.deepEqual(ids.conceptGroups, ["fedcbafedcbafedcbafedcba"]);
});

test("extractCitedContextIds parses [[model:id]] as mental model id", () => {
  const ids = extractCitedContextIds(
    "See [[model:regression_to_the_mean]] and [[map_is_not_the_territory]]."
  );
  assert.deepEqual(ids.mentalModels, ["regression_to_the_mean", "map_is_not_the_territory"]);
});

test("diffCitationsAgainstPredicted identifies disallowed citations", () => {
  const predicted: RelevantContext = {
    ...emptyContext(),
    mentalModels: [{ id: "confirmation_bias", reason: "predicted" }],
  };
  const cited = buildCitedContextFromText(
    "Text [[confirmation_bias]] and [[endowment_effect]]."
  );
  const diff = diffCitationsAgainstPredicted(predicted, cited);
  assert.equal(hasCitationMismatches(diff), true);
  assert.deepEqual(diff.disallowedMentalModels, ["endowment_effect"]);
});

test("sanitizeDisallowedCitations replaces disallowed references with plain labels", () => {
  const predicted: RelevantContext = {
    ...emptyContext(),
    mentalModels: [{ id: "confirmation_bias", reason: "predicted" }],
  };
  const sanitized = sanitizeDisallowedCitations(
    "Keep [[confirmation_bias]] but remove [[endowment_effect]].",
    predicted,
    {
      mentalModelLabels: new Map([
        ["confirmation_bias", "Confirmation Bias"],
        ["endowment_effect", "Endowment Effect"],
      ]),
    }
  );
  assert.equal(
    sanitized,
    "Keep [[confirmation_bias]] but remove Endowment Effect."
  );
});

test("sanitizeDisallowedCitations keeps mental models in full index when not in predicted", () => {
  const predicted: RelevantContext = {
    ...emptyContext(),
    mentalModels: [{ id: "confirmation_bias", reason: "predicted" }],
  };
  const fullIndex = new Set(["confirmation_bias", "endowment_effect"]);
  const sanitized = sanitizeDisallowedCitations(
    "[[confirmation_bias]] and [[endowment_effect]] both stay.",
    predicted,
    {
      mentalModelLabels: new Map([
        ["confirmation_bias", "Confirmation Bias"],
        ["endowment_effect", "Endowment Effect"],
      ]),
    },
    fullIndex
  );
  assert.equal(
    sanitized,
    "[[confirmation_bias]] and [[endowment_effect]] both stay."
  );
});
