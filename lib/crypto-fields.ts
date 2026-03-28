import { decryptMaybe, encrypt, isEncryptionEnabled } from "./crypto";

/** Mirrors `ExtractedConceptGroup` in db.ts — duplicated to avoid circular imports */
export type ExtractedConceptGroupFields = {
  domain: string;
  concepts: { title: string; summary: string; enrichmentPrompt: string }[];
};

export type ClonedVoiceSettingFields = {
  voiceId: string;
  name: string;
  language: string;
};

function enc(s: string): string {
  return encrypt(s);
}

function dec(s: string): string {
  return decryptMaybe(s);
}

function encOpt(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  return enc(s);
}

function decOpt(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  return dec(s);
}

/** Encrypt each string in array; skip null entries */
function encStringArray(arr: string[] | undefined | null): string[] | undefined {
  if (arr == null) return undefined;
  return arr.map((x) => (typeof x === "string" ? enc(x) : x));
}

function decStringArray(arr: string[] | undefined | null): string[] | undefined {
  if (arr == null) return undefined;
  return arr.map((x) => (typeof x === "string" ? dec(x) : x));
}

function encRecord(r: Record<string, string> | undefined | null): Record<string, string> | undefined {
  if (r == null) return undefined;
  const out: Record<string, string> = {};
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (typeof v === "string") out[k] = enc(v);
    else out[k] = v as string;
  }
  return out;
}

function decRecord(r: Record<string, string> | undefined | null): Record<string, string> | undefined {
  if (r == null) return undefined;
  const out: Record<string, string> = {};
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (typeof v === "string") out[k] = dec(v);
    else out[k] = v as string;
  }
  return out;
}

function encStringOrRecord(
  v: string | Record<string, string> | undefined | null
): string | Record<string, string> | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return enc(v);
  return encRecord(v) as Record<string, string>;
}

function decStringOrRecord(
  v: string | Record<string, string> | undefined | null
): string | Record<string, string> | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return dec(v);
  return decRecord(v) as Record<string, string>;
}

function encClonedVoices(
  arr: ClonedVoiceSettingFields[] | undefined | null
): ClonedVoiceSettingFields[] | undefined {
  if (arr == null) return undefined;
  return arr.map((c) => ({
    ...c,
    voiceId: enc(c.voiceId),
    name: enc(c.name),
  }));
}

function decClonedVoices(
  arr: ClonedVoiceSettingFields[] | undefined | null
): ClonedVoiceSettingFields[] | undefined {
  if (arr == null) return undefined;
  return arr.map((c) => ({
    ...c,
    voiceId: dec(c.voiceId),
    name: dec(c.name),
  }));
}

function encExtracted(
  groups: ExtractedConceptGroupFields[] | undefined | null
): ExtractedConceptGroupFields[] | undefined {
  if (groups == null) return undefined;
  return groups.map((g) => ({
    domain: enc(g.domain),
    concepts: g.concepts.map((c) => ({
      title: enc(c.title),
      summary: enc(c.summary),
      enrichmentPrompt: enc(c.enrichmentPrompt),
    })),
  }));
}

function decExtracted(
  groups: ExtractedConceptGroupFields[] | undefined | null
): ExtractedConceptGroupFields[] | undefined {
  if (groups == null) return undefined;
  return groups.map((g) => ({
    domain: dec(g.domain),
    concepts: g.concepts.map((c) => ({
      title: dec(c.title),
      summary: dec(c.summary),
      enrichmentPrompt: dec(c.enrichmentPrompt),
    })),
  }));
}

// --- Session (Mongo SessionDoc / Session) ---

export type SessionEncryptable = {
  title?: string;
  mentalModelTags?: string[];
  perspectiveCardPrompt?: string;
  perspectiveCardName?: string;
  perspectiveCardFigureName?: string;
  oneOnOneMentorFigureName?: string;
};

export function encryptSessionFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.title === "string") o.title = enc(o.title);
  if (Array.isArray(o.mentalModelTags)) {
    o.mentalModelTags = encStringArray(o.mentalModelTags as string[]) as string[];
  }
  if (typeof o.perspectiveCardPrompt === "string") o.perspectiveCardPrompt = enc(o.perspectiveCardPrompt);
  if (typeof o.perspectiveCardName === "string") o.perspectiveCardName = enc(o.perspectiveCardName);
  if (typeof o.perspectiveCardFigureName === "string") {
    o.perspectiveCardFigureName = enc(o.perspectiveCardFigureName);
  }
  if (typeof o.oneOnOneMentorFigureName === "string") {
    o.oneOnOneMentorFigureName = enc(o.oneOnOneMentorFigureName);
  }
  return o as T;
}

export function decryptSessionFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.title === "string") o.title = dec(o.title);
  if (Array.isArray(o.mentalModelTags)) {
    o.mentalModelTags = decStringArray(o.mentalModelTags as string[]) as string[];
  }
  if (typeof o.perspectiveCardPrompt === "string") o.perspectiveCardPrompt = dec(o.perspectiveCardPrompt);
  if (typeof o.perspectiveCardName === "string") o.perspectiveCardName = dec(o.perspectiveCardName);
  if (typeof o.perspectiveCardFigureName === "string") {
    o.perspectiveCardFigureName = dec(o.perspectiveCardFigureName);
  }
  if (typeof o.oneOnOneMentorFigureName === "string") {
    o.oneOnOneMentorFigureName = dec(o.oneOnOneMentorFigureName);
  }
  return o as T;
}

// --- Message ---

export function encryptMessageFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.content === "string") o.content = enc(o.content);
  if (typeof o.journalCheckpoint === "string") o.journalCheckpoint = enc(o.journalCheckpoint);
  return o as T;
}

export function decryptMessageFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.content === "string") o.content = dec(o.content);
  if (typeof o.journalCheckpoint === "string") o.journalCheckpoint = dec(o.journalCheckpoint);
  return o as T;
}

// --- User mental model ---

export function encryptUserMentalModelFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  const e = (k: string) => {
    const v = o[k];
    if (v == null) return;
    if (k === "when_to_use" || k === "related_content" || k === "try_this" || k === "ask_yourself") {
      o[k] = encStringArray(v as string[]);
      return;
    }
    if (
      k === "how_can_you_spot_it" ||
      k === "examples" ||
      k === "professional_application" ||
      k === "how_can_this_be_misapplied"
    ) {
      o[k] = encRecord(v as Record<string, string>);
      return;
    }
    if (k === "real_world_implications") {
      o[k] = encStringOrRecord(v as string | Record<string, string>);
      return;
    }
    if (typeof v === "string") o[k] = enc(v);
  };
  for (const k of [
    "name",
    "quick_introduction",
    "in_more_detail",
    "why_this_is_important",
    "when_to_use",
    "how_can_you_spot_it",
    "examples",
    "real_world_implications",
    "professional_application",
    "how_can_this_be_misapplied",
    "related_content",
    "one_liner",
    "try_this",
    "ask_yourself",
  ]) {
    e(k);
  }
  return o as T;
}

export function decryptUserMentalModelFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  const d = (k: string) => {
    const v = o[k];
    if (v == null) return;
    if (k === "when_to_use" || k === "related_content" || k === "try_this" || k === "ask_yourself") {
      o[k] = decStringArray(v as string[]);
      return;
    }
    if (
      k === "how_can_you_spot_it" ||
      k === "examples" ||
      k === "professional_application" ||
      k === "how_can_this_be_misapplied"
    ) {
      o[k] = decRecord(v as Record<string, string>);
      return;
    }
    if (k === "real_world_implications") {
      o[k] = decStringOrRecord(v as string | Record<string, string>);
      return;
    }
    if (typeof v === "string") o[k] = dec(v);
  };
  for (const k of [
    "name",
    "quick_introduction",
    "in_more_detail",
    "why_this_is_important",
    "when_to_use",
    "how_can_you_spot_it",
    "examples",
    "real_world_implications",
    "professional_application",
    "how_can_this_be_misapplied",
    "related_content",
    "one_liner",
    "try_this",
    "ask_yourself",
  ]) {
    d(k);
  }
  return o as T;
}

// --- Long-term memory ---

export function encryptLongTermMemoryFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.title === "string") o.title = enc(o.title);
  if (typeof o.summary === "string") o.summary = enc(o.summary);
  if (typeof o.enrichmentPrompt === "string") o.enrichmentPrompt = enc(o.enrichmentPrompt);
  if (Array.isArray(o.chainOfThought)) {
    o.chainOfThought = encStringArray(o.chainOfThought as string[]) as string[];
  }
  return o as T;
}

export function decryptLongTermMemoryFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.title === "string") o.title = dec(o.title);
  if (typeof o.summary === "string") o.summary = dec(o.summary);
  if (typeof o.enrichmentPrompt === "string") o.enrichmentPrompt = dec(o.enrichmentPrompt);
  if (Array.isArray(o.chainOfThought)) {
    o.chainOfThought = decStringArray(o.chainOfThought as string[]) as string[];
  }
  return o as T;
}

// --- Custom concept ---

export function encryptCustomConceptFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.title === "string") o.title = enc(o.title);
  if (typeof o.summary === "string") o.summary = enc(o.summary);
  if (typeof o.enrichmentPrompt === "string") o.enrichmentPrompt = enc(o.enrichmentPrompt);
  if (typeof o.sourceVideoTitle === "string") o.sourceVideoTitle = enc(o.sourceVideoTitle);
  return o as T;
}

export function decryptCustomConceptFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.title === "string") o.title = dec(o.title);
  if (typeof o.summary === "string") o.summary = dec(o.summary);
  if (typeof o.enrichmentPrompt === "string") o.enrichmentPrompt = dec(o.enrichmentPrompt);
  if (typeof o.sourceVideoTitle === "string") o.sourceVideoTitle = dec(o.sourceVideoTitle);
  return o as T;
}

// --- Concept group ---

export function encryptConceptGroupFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.title === "string") o.title = enc(o.title);
  if (Array.isArray(o.chainOfThought)) {
    o.chainOfThought = encStringArray(o.chainOfThought as string[]) as string[];
  }
  return o as T;
}

export function decryptConceptGroupFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.title === "string") o.title = dec(o.title);
  if (Array.isArray(o.chainOfThought)) {
    o.chainOfThought = decStringArray(o.chainOfThought as string[]) as string[];
  }
  return o as T;
}

// --- Saved perspective cards ---

export function encryptSavedPerspectiveCardFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.name === "string") o.name = enc(o.name);
  if (typeof o.prompt === "string") o.prompt = enc(o.prompt);
  if (Array.isArray(o.follow_ups)) {
    o.follow_ups = encStringArray(o.follow_ups as string[]) as string[];
  }
  if (typeof o.sourceDeckName === "string") o.sourceDeckName = enc(o.sourceDeckName);
  return o as T;
}

export function decryptSavedPerspectiveCardFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.name === "string") o.name = dec(o.name);
  if (typeof o.prompt === "string") o.prompt = dec(o.prompt);
  if (Array.isArray(o.follow_ups)) {
    o.follow_ups = decStringArray(o.follow_ups as string[]) as string[];
  }
  if (typeof o.sourceDeckName === "string") o.sourceDeckName = dec(o.sourceDeckName);
  return o as T;
}

// --- Transcripts ---

export function encryptTranscriptFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.transcriptText === "string") o.transcriptText = enc(o.transcriptText);
  if (typeof o.videoTitle === "string") o.videoTitle = enc(o.videoTitle);
  if (typeof o.channel === "string") o.channel = enc(o.channel);
  if (o.extractedConcepts !== undefined && o.extractedConcepts !== null) {
    const ex = encExtracted(o.extractedConcepts as ExtractedConceptGroupFields[]);
    if (ex !== undefined) o.extractedConcepts = ex;
  }
  return o as T;
}

export function decryptTranscriptFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.transcriptText === "string") o.transcriptText = dec(o.transcriptText);
  if (typeof o.videoTitle === "string") o.videoTitle = dec(o.videoTitle);
  if (typeof o.channel === "string") o.channel = dec(o.channel);
  if (o.extractedConcepts !== undefined && o.extractedConcepts !== null) {
    const ex = decExtracted(o.extractedConcepts as ExtractedConceptGroupFields[]);
    if (ex !== undefined) o.extractedConcepts = ex;
  }
  return o as T;
}

// --- User settings (sensitive voice fields only) ---

export function encryptUserSettingsFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.clonedVoiceId === "string") o.clonedVoiceId = enc(o.clonedVoiceId);
  if (typeof o.clonedVoiceName === "string") o.clonedVoiceName = enc(o.clonedVoiceName);
  if (Array.isArray(o.clonedVoices)) {
    const cv = encClonedVoices(o.clonedVoices as ClonedVoiceSettingFields[]);
    if (cv !== undefined) o.clonedVoices = cv;
  }
  if (typeof o.preferredName === "string") o.preferredName = enc(o.preferredName);
  return o as T;
}

export function decryptUserSettingsFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.clonedVoiceId === "string") o.clonedVoiceId = dec(o.clonedVoiceId);
  if (typeof o.clonedVoiceName === "string") o.clonedVoiceName = dec(o.clonedVoiceName);
  if (Array.isArray(o.clonedVoices)) {
    const cv = decClonedVoices(o.clonedVoices as ClonedVoiceSettingFields[]);
    if (cv !== undefined) o.clonedVoices = cv;
  }
  if (typeof o.preferredName === "string") o.preferredName = dec(o.preferredName);
  return o as T;
}

// --- Habits ---

export function encryptHabitFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.name === "string") o.name = enc(o.name);
  if (typeof o.description === "string") o.description = enc(o.description);
  if (typeof o.howToFollowThrough === "string") o.howToFollowThrough = enc(o.howToFollowThrough);
  if (typeof o.tips === "string") o.tips = enc(o.tips);
  return o as T;
}

export function decryptHabitFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.name === "string") o.name = dec(o.name);
  if (typeof o.description === "string") o.description = dec(o.description);
  if (typeof o.howToFollowThrough === "string") o.howToFollowThrough = dec(o.howToFollowThrough);
  if (typeof o.tips === "string") o.tips = dec(o.tips);
  return o as T;
}

// --- Saved concepts (reflection) ---

export function encryptSavedConceptFields<T>(doc: object): T {
  if (!isEncryptionEnabled()) return { ...doc } as T;
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.reflection === "string") o.reflection = enc(o.reflection);
  return o as T;
}

export function decryptSavedConceptFields<T>(doc: object): T {
  const o = { ...doc } as Record<string, unknown>;
  if (typeof o.reflection === "string") o.reflection = dec(o.reflection);
  return o as T;
}

// --- Usage event metadata (JSON blob) ---

export function encryptUsageMetadata(meta: Record<string, unknown>): Record<string, unknown> | string {
  if (!isEncryptionEnabled()) return meta;
  const json = JSON.stringify(meta);
  return enc(json);
}

export function decryptUsageMetadata(
  meta: Record<string, unknown> | string | undefined
): Record<string, unknown> {
  if (meta === undefined) return {};
  if (typeof meta === "string") {
    const plain = dec(meta);
    try {
      return JSON.parse(plain) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return meta;
}
