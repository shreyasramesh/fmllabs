import test from "node:test";
import assert from "node:assert/strict";
import {
  getRelevantContextBlockDelimiters,
  parseRelevantContextBlock,
  parseRelevantContextFromStreamStart,
} from "./chat-utils";

test("parseRelevantContextFromStreamStart prefers predicted context in envelope", () => {
  const { start, end } = getRelevantContextBlockDelimiters();
  const payload = {
    predictedContext: {
      mentalModels: [{ id: "confirmation_bias", reason: "predicted" }],
      longTermMemories: [],
      customConcepts: [],
      conceptGroups: [],
    },
    citedContext: {
      mentalModels: [{ id: "endowment_effect", reason: "cited" }],
      longTermMemories: [],
      customConcepts: [],
      conceptGroups: [],
    },
  };
  const text = `${start}\n${JSON.stringify(payload)}\n${end}\nassistant text`;
  const parsed = parseRelevantContextFromStreamStart(text);
  assert.equal(parsed.relevantContext?.mentalModels[0]?.id, "confirmation_bias");
  assert.equal(parsed.contentWithoutBlock, "assistant text");
});

test("parseRelevantContextBlock prefers cited context in envelope", () => {
  const payload = {
    predictedContext: {
      mentalModels: [{ id: "confirmation_bias", reason: "predicted" }],
      longTermMemories: [],
      customConcepts: [],
      conceptGroups: [],
    },
    citedContext: {
      mentalModels: [{ id: "endowment_effect", reason: "cited" }],
      longTermMemories: [],
      customConcepts: [],
      conceptGroups: [],
    },
  };
  const content = `Model output.\n---RELEVANT-CONTEXT---\n${JSON.stringify(payload)}`;
  const parsed = parseRelevantContextBlock(content);
  assert.equal(parsed.relevantContext?.mentalModels[0]?.id, "endowment_effect");
  assert.equal(parsed.contentWithoutBlock, "Model output.");
});
