import { MongoClient, Db, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/and-then-what";

let client: MongoClient | null = null;
let db: Db | null = null;

// M0 clusters have low connection limits (~500). Default maxPoolSize is 100 per client.
// Limit pool size to avoid exhausting connections in serverless/multi-instance deployments.
// Override with MONGODB_MAX_POOL_SIZE env var (e.g. 20 if you upgrade to M10+).
const MAX_POOL_SIZE = parseInt(process.env.MONGODB_MAX_POOL_SIZE || "10", 10) || 10;
// Close idle connections after 60s to free up slots when traffic is bursty.
const MAX_IDLE_TIME_MS = 60_000;

export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri, {
    maxPoolSize: MAX_POOL_SIZE,
    maxIdleTimeMS: MAX_IDLE_TIME_MS,
  });
  await client.connect();
  db = client.db();
  return db;
}

export interface Session {
  _id?: string;
  userId: string;
  title?: string;
  mentalModelTags?: string[];
  isCollapsed?: boolean;
  longTermMemoryId?: string;
  /** When true, perspective-card conversations use full system context (mental models, memories, etc.) */
  convertedToDeepConversation?: boolean;
  /** Stored when conversation started with a perspective card */
  perspectiveCardPrompt?: string;
  perspectiveCardName?: string;
  perspectiveCardFigureId?: string;
  perspectiveCardFigureName?: string;
  /** 1:1 mentor mode: full SYSTEM_PROMPT with this figure's voice */
  oneOnOneMentorFigureId?: string;
  oneOnOneMentorFigureName?: string;
  /** Second-order thinking mode (minimal prompt; no RAG) */
  secondOrderThinking?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  _id?: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  /** When set, this user message was created from a journal checkpoint; used for display and LTM */
  journalCheckpoint?: string;
  createdAt: Date;
}

interface SessionDoc {
  _id: ObjectId;
  userId: string;
  title?: string;
  mentalModelTags?: string[];
  isCollapsed?: boolean;
  longTermMemoryId?: string;
  convertedToDeepConversation?: boolean;
  perspectiveCardPrompt?: string;
  perspectiveCardName?: string;
  perspectiveCardFigureId?: string;
  perspectiveCardFigureName?: string;
  oneOnOneMentorFigureId?: string;
  oneOnOneMentorFigureName?: string;
  secondOrderThinking?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LongTermMemory {
  _id?: string;
  userId: string;
  sourceSessionId: string;
  title: string;
  summary: string;
  enrichmentPrompt: string;
  /** Chain-of-thought reasoning steps shown as chips in summary modals */
  chainOfThought?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface LongTermMemoryDoc extends Omit<LongTermMemory, "_id"> {
  _id: ObjectId;
}

export interface CustomConcept {
  _id?: string;
  userId: string;
  title: string;
  summary: string;
  enrichmentPrompt: string;
  /** When set, concept was extracted from a YouTube transcript */
  sourceVideoTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomConceptDoc extends Omit<CustomConcept, "_id"> {
  _id: ObjectId;
}

export interface ConceptGroup {
  _id?: string;
  userId: string;
  title: string;
  conceptIds: string[];
  /** When true, group was user-created (add existing concepts). Deleting does not delete concepts. */
  isCustomGroup?: boolean;
  /** Chain-of-thought chips only (same style as long-term memory summaries). */
  chainOfThought?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ConceptGroupDoc extends Omit<ConceptGroup, "_id"> {
  _id: ObjectId;
}

export interface Habit {
  _id?: string;
  userId: string;
  /** Source: "concept" | "ltm" */
  sourceType: "concept" | "ltm";
  sourceId: string;
  name: string;
  description: string;
  howToFollowThrough: string;
  tips: string;
  createdAt: Date;
  updatedAt: Date;
}

interface HabitDoc extends Omit<Habit, "_id"> {
  _id: ObjectId;
}

export type ExtractedConcept = {
  title: string;
  summary: string;
  enrichmentPrompt: string;
};

export type ExtractedConceptGroup = {
  domain: string;
  concepts: ExtractedConcept[];
};

export interface SavedTranscript {
  _id?: string;
  userId: string;
  videoId: string;
  videoTitle?: string;
  channel?: string;
  /** When omitted, treated as YouTube for backward compatibility. */
  sourceType?: "youtube" | "journal";
  transcriptText: string;
  extractedConcepts?: ExtractedConceptGroup[];
  createdAt: Date;
  updatedAt: Date;
}

interface SavedTranscriptDoc extends Omit<SavedTranscript, "_id"> {
  _id: ObjectId;
}

export interface SavedPerspectiveCard {
  _id?: string;
  userId: string;
  name: string;
  prompt: string;
  follow_ups: string[];
  sourceDeckId?: string;
  sourceDeckName?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SavedPerspectiveCardDoc extends Omit<SavedPerspectiveCard, "_id"> {
  _id: ObjectId;
}

export interface Nugget {
  _id?: string;
  userId: string;
  content: string;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface NuggetDoc extends Omit<Nugget, "_id"> {
  _id: ObjectId;
}

export type BackgroundElement = "default" | "air" | "water" | "earth" | "fire";
export interface ClonedVoiceSetting {
  voiceId: string;
  name: string;
  language: string;
}

export interface UserSettings {
  userId: string;
  theme?: "light" | "dark";
  language?: string;
  userType?: string;
  ttsSpeed?: number;
  /** IDs of famous figures the user follows (for contextual nudges in chat) */
  followedFigureIds?: string[];
  /** ElevenLabs Instant Voice Clone ID; when set, TTS uses this voice. Audio clips are never stored—only this ID. */
  clonedVoiceId?: string;
  clonedVoiceName?: string;
  /** Preferred cloned voices tagged by app language code. */
  clonedVoices?: ClonedVoiceSetting[];
  background?: BackgroundElement;
  weatherFormat?: "condition-temp" | "emoji-temp" | "temp-only";
  /** When true, user appears on the global XP leaderboard */
  leaderboardOptIn?: boolean;
  updatedAt: Date;
}

interface UserSettingsDoc extends UserSettings {
  _id?: ObjectId;
}

/** User-created mental models; same schema as MentalModel, stored per user. */
export interface UserMentalModel {
  _id?: string;
  userId: string;
  id: string;
  name: string;
  quick_introduction: string;
  in_more_detail: string;
  why_this_is_important: string;
  when_to_use: string[];
  how_can_you_spot_it: Record<string, string>;
  examples: Record<string, string>;
  real_world_implications: string | Record<string, string>;
  professional_application: Record<string, string>;
  how_can_this_be_misapplied: Record<string, string>;
  related_content: string[];
  one_liner?: string;
  try_this?: string[];
  ask_yourself?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface UserMentalModelDoc extends Omit<UserMentalModel, "_id"> {
  _id: ObjectId;
}

export type UsageService =
  | "transcribr"
  | "mongodb"
  | "gemini"
  | "elevenlabs_tts"
  | "elevenlabs_stt";

export interface UsageEventDoc {
  _id?: ObjectId;
  userId: string | null;
  service: UsageService;
  eventType: string;
  costUsd: number;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export async function getSessions(userId: string): Promise<(Session & { _id: string })[]> {
  const database = await getDb();
  const sessions = await database
    .collection<Session>("sessions")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return sessions.map((s) => ({ ...s, _id: s._id?.toString() ?? "" })) as (Session & { _id: string })[];
}

export async function createSession(userId: string, title?: string): Promise<Session & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const session: Omit<Session, "_id"> = {
    userId,
    title: title || "New conversation",
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("sessions").insertOne(session);
  return { ...session, _id: result.insertedId.toString() } as Session & { _id: string };
}

export async function getSession(sessionId: string, userId: string): Promise<(Session & { _id: string }) | null> {
  const database = await getDb();
  let id: ObjectId;
  try {
    id = new ObjectId(sessionId);
  } catch {
    return null;
  }
  const session = await database
    .collection<SessionDoc>("sessions")
    .findOne({ _id: id, userId });
  if (!session) return null;
  return {
    ...session,
    _id: session._id.toString(),
  } as Session & { _id: string };
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  const database = await getDb();
  const messages = await database
    .collection<Message>("messages")
    .find({ sessionId })
    .sort({ createdAt: 1 })
    .toArray();
  return messages.map((m) => ({
    ...m,
    _id: m._id?.toString(),
  }));
}

export async function truncateMessagesAfter(
  sessionId: string,
  userId: string,
  keepCount: number
): Promise<boolean> {
  const database = await getDb();
  let id: ObjectId;
  try {
    id = new ObjectId(sessionId);
  } catch {
    return false;
  }
  const session = await database
    .collection<SessionDoc>("sessions")
    .findOne({ _id: id, userId });
  if (!session) return false;

  const messages = await database
    .collection<Message>("messages")
    .find({ sessionId })
    .sort({ createdAt: 1 })
    .toArray();

  if (keepCount >= messages.length) return true;

  const toDelete = messages.slice(keepCount).map((m) => m._id).filter(Boolean);
  if (toDelete.length === 0) return true;

  await database
    .collection<Message>("messages")
    .deleteMany({ _id: { $in: toDelete } });
  await database
    .collection<SessionDoc>("sessions")
    .updateOne({ _id: id }, { $set: { updatedAt: new Date() } });
  return true;
}

export async function appendMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  options?: { journalCheckpoint?: string }
): Promise<void> {
  const database = await getDb();
  let id: ObjectId;
  try {
    id = new ObjectId(sessionId);
  } catch {
    throw new Error("Invalid session ID");
  }
  const doc: Message = {
    sessionId,
    role,
    content,
    ...(options?.journalCheckpoint ? { journalCheckpoint: options.journalCheckpoint } : {}),
    createdAt: new Date(),
  };
  await database.collection<Message>("messages").insertOne(doc);
  await database.collection<SessionDoc>("sessions").updateOne(
    { _id: id },
    { $set: { updatedAt: new Date() } }
  );
}

export async function updateSession(
  sessionId: string,
  userId: string,
  updates: {
    title?: string;
    mentalModelTags?: string[];
    isCollapsed?: boolean;
    longTermMemoryId?: string;
    convertedToDeepConversation?: boolean;
    perspectiveCardPrompt?: string;
    perspectiveCardName?: string;
    perspectiveCardFigureId?: string;
    perspectiveCardFigureName?: string;
    oneOnOneMentorFigureId?: string;
    oneOnOneMentorFigureName?: string;
    secondOrderThinking?: boolean;
    /** Remove 1:1 mentor fields from the session document */
    clearOneOnOneMentor?: boolean;
    /** Remove second-order flag from the session document */
    clearSecondOrder?: boolean;
  }
): Promise<boolean> {
  const database = await getDb();
  let id: ObjectId;
  try {
    id = new ObjectId(sessionId);
  } catch {
    return false;
  }
  const {
    clearOneOnOneMentor,
    clearSecondOrder,
    ...rest
  } = updates;
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) {
      $set[k] = v;
    }
  }
  const $unset: Record<string, ""> = {};
  if (clearOneOnOneMentor) {
    $unset.oneOnOneMentorFigureId = "";
    $unset.oneOnOneMentorFigureName = "";
  }
  if (clearSecondOrder) {
    $unset.secondOrderThinking = "";
  }
  const updateDoc: { $set: Record<string, unknown>; $unset?: Record<string, ""> } = {
    $set,
  };
  if (Object.keys($unset).length > 0) {
    updateDoc.$unset = $unset;
  }
  const result = await database
    .collection<SessionDoc>("sessions")
    .updateOne({ _id: id, userId }, updateDoc);
  return result.modifiedCount > 0;
}

export async function expandSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const database = await getDb();
  let id: ObjectId;
  try {
    id = new ObjectId(sessionId);
  } catch {
    return false;
  }
  const result = await database
    .collection<SessionDoc>("sessions")
    .updateOne(
      { _id: id, userId },
      { $unset: { longTermMemoryId: "" }, $set: { isCollapsed: false, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
}

export async function addMentalModelTag(
  sessionId: string,
  userId: string,
  tag: string
): Promise<boolean> {
  const database = await getDb();
  let id: ObjectId;
  try {
    id = new ObjectId(sessionId);
  } catch {
    return false;
  }
  const result = await database
    .collection<SessionDoc>("sessions")
    .updateOne(
      { _id: id, userId },
      {
        $addToSet: { mentalModelTags: tag },
        $set: { updatedAt: new Date() },
      }
    );
  // Success if we found the session (matchedCount) - tag may already exist (modifiedCount 0)
  return result.matchedCount > 0;
}

export interface SavedConcept {
  userId: string;
  modelId: string;
  savedAt: Date;
  reflection?: string;
}

export async function getSavedConcepts(
  userId: string
): Promise<{ modelId: string; savedAt: Date; reflection?: string }[]> {
  const database = await getDb();
  const docs = await database
    .collection<SavedConcept>("user_saved_concepts")
    .find({ userId })
    .sort({ savedAt: -1 })
    .toArray();
  return docs.map((d) => ({
    modelId: d.modelId,
    savedAt: d.savedAt,
    reflection: d.reflection,
  }));
}

export async function addSavedConcept(
  userId: string,
  modelId: string,
  reflection?: string
): Promise<boolean> {
  const database = await getDb();
  const result = await database
    .collection<SavedConcept>("user_saved_concepts")
    .updateOne(
      { userId, modelId },
      {
        $set: {
          savedAt: new Date(),
          ...(reflection != null && { reflection }),
        },
      },
      { upsert: true }
    );
  return result.acknowledged;
}

export async function removeSavedConcept(
  userId: string,
  modelId: string
): Promise<boolean> {
  const database = await getDb();
  const result = await database
    .collection<SavedConcept>("user_saved_concepts")
    .deleteOne({ userId, modelId });
  return result.deletedCount > 0;
}

export async function getUserMentalModels(userId: string): Promise<UserMentalModel[]> {
  const database = await getDb();
  const docs = await database
    .collection<UserMentalModelDoc>("user_mental_models")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({
    ...d,
    _id: d._id.toString(),
  })) as UserMentalModel[];
}

export async function getUserMentalModelById(
  userId: string,
  id: string
): Promise<UserMentalModel | null> {
  const database = await getDb();
  const doc = await database
    .collection<UserMentalModelDoc>("user_mental_models")
    .findOne({ userId, id });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() } as UserMentalModel;
}

export async function createUserMentalModel(
  userId: string,
  model: Omit<UserMentalModel, "userId" | "createdAt" | "updatedAt" | "_id">
): Promise<UserMentalModel> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<UserMentalModelDoc, "_id"> = {
    userId,
    id: model.id,
    name: model.name,
    quick_introduction: model.quick_introduction,
    in_more_detail: model.in_more_detail,
    why_this_is_important: model.why_this_is_important,
    when_to_use: model.when_to_use,
    how_can_you_spot_it: model.how_can_you_spot_it,
    examples: model.examples,
    real_world_implications: model.real_world_implications,
    professional_application: model.professional_application,
    how_can_this_be_misapplied: model.how_can_this_be_misapplied,
    related_content: model.related_content,
    one_liner: model.one_liner,
    try_this: model.try_this,
    ask_yourself: model.ask_yourself,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("user_mental_models").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as UserMentalModel;
}

export async function updateUserMentalModel(
  userId: string,
  id: string,
  updates: Partial<Omit<UserMentalModel, "userId" | "id" | "createdAt" | "_id">>
): Promise<boolean> {
  const database = await getDb();
  const result = await database
    .collection<UserMentalModelDoc>("user_mental_models")
    .updateOne(
      { userId, id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
}

export async function deleteUserMentalModel(userId: string, id: string): Promise<boolean> {
  const database = await getDb();
  const result = await database
    .collection<UserMentalModelDoc>("user_mental_models")
    .deleteOne({ userId, id });
  return result.deletedCount > 0;
}

export async function getLongTermMemories(
  userId: string
): Promise<(LongTermMemory & { _id: string })[]> {
  const database = await getDb();
  const docs = await database
    .collection<LongTermMemory>("long_term_memory")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (LongTermMemory & { _id: string })[];
}

export async function getLongTermMemory(
  id: string,
  userId: string
): Promise<(LongTermMemory & { _id: string }) | null> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await database
    .collection<LongTermMemoryDoc>("long_term_memory")
    .findOne({ _id: oid, userId });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() } as LongTermMemory & { _id: string };
}

export async function getLongTermMemoriesByIds(
  ids: string[],
  userId: string
): Promise<(LongTermMemory & { _id: string })[]> {
  if (ids.length === 0) return [];
  const database = await getDb();
  const objectIds: ObjectId[] = [];
  for (const id of ids) {
    try {
      objectIds.push(new ObjectId(id));
    } catch {
      /* skip invalid id */
    }
  }
  if (objectIds.length === 0) return [];
  const docs = await database
    .collection<LongTermMemoryDoc>("long_term_memory")
    .find({ _id: { $in: objectIds }, userId })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (LongTermMemory & { _id: string })[];
}

export async function getLongTermMemoryBySessionId(
  userId: string,
  sourceSessionId: string
): Promise<(LongTermMemory & { _id: string }) | null> {
  const database = await getDb();
  const doc = await database
    .collection<LongTermMemoryDoc>("long_term_memory")
    .findOne({ userId, sourceSessionId });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() } as LongTermMemory & { _id: string };
}

export async function createLongTermMemory(
  userId: string,
  sourceSessionId: string,
  title: string,
  summary: string,
  enrichmentPrompt: string,
  chainOfThought?: string[]
): Promise<LongTermMemory & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<LongTermMemory, "_id"> = {
    userId,
    sourceSessionId,
    title,
    summary,
    enrichmentPrompt,
    ...(chainOfThought?.length ? { chainOfThought } : {}),
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("long_term_memory").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as LongTermMemory & { _id: string };
}

export async function updateLongTermMemory(
  id: string,
  userId: string,
  updates: { title?: string; summary?: string; enrichmentPrompt?: string; chainOfThought?: string[] }
): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<LongTermMemoryDoc>("long_term_memory")
    .updateOne(
      { _id: oid, userId },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
}

export async function deleteLongTermMemory(id: string, userId: string): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<LongTermMemoryDoc>("long_term_memory")
    .deleteOne({ _id: oid, userId });
  if (result.deletedCount > 0) {
    await database.collection<SessionDoc>("sessions").updateMany(
      { longTermMemoryId: id, userId },
      { $unset: { longTermMemoryId: "" }, $set: { isCollapsed: false, updatedAt: new Date() } }
    );
  }
  return result.deletedCount > 0;
}

export async function getCustomConcepts(
  userId: string
): Promise<(CustomConcept & { _id: string })[]> {
  const database = await getDb();
  const docs = await database
    .collection<CustomConceptDoc>("custom_concepts")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (CustomConcept & { _id: string })[];
}

export async function getCustomConcept(
  id: string,
  userId: string
): Promise<(CustomConcept & { _id: string }) | null> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await database
    .collection<CustomConceptDoc>("custom_concepts")
    .findOne({ _id: oid, userId });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() } as CustomConcept & { _id: string };
}

export async function getCustomConceptsByIds(
  ids: string[],
  userId: string
): Promise<(CustomConcept & { _id: string })[]> {
  if (ids.length === 0) return [];
  const database = await getDb();
  const objectIds: ObjectId[] = [];
  for (const id of ids) {
    try {
      objectIds.push(new ObjectId(id));
    } catch {
      /* skip invalid id */
    }
  }
  if (objectIds.length === 0) return [];
  const docs = await database
    .collection<CustomConceptDoc>("custom_concepts")
    .find({ _id: { $in: objectIds }, userId })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (CustomConcept & { _id: string })[];
}

export async function getCustomConceptEnrichmentPromptsWithIds(
  userId: string
): Promise<{ id: string; enrichmentPrompt: string; title?: string }[]> {
  const database = await getDb();
  const docs = await database
    .collection<CustomConceptDoc>("custom_concepts")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .project({ _id: 1, enrichmentPrompt: 1, title: 1 })
    .toArray();
  return docs
    .filter((d) => d.enrichmentPrompt)
    .map((d) => ({
      id: d._id.toString(),
      enrichmentPrompt: d.enrichmentPrompt,
      title: d.title,
    }));
}

export async function createCustomConcept(
  userId: string,
  title: string,
  summary: string,
  enrichmentPrompt: string,
  sourceVideoTitle?: string
): Promise<CustomConcept & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<CustomConcept, "_id"> = {
    userId,
    title,
    summary,
    enrichmentPrompt,
    ...(sourceVideoTitle != null && sourceVideoTitle !== "" && { sourceVideoTitle }),
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("custom_concepts").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as CustomConcept & { _id: string };
}

export async function updateCustomConcept(
  id: string,
  userId: string,
  updates: {
    title?: string;
    summary?: string;
    enrichmentPrompt?: string;
    sourceVideoTitle?: string;
  }
): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<CustomConceptDoc>("custom_concepts")
    .updateOne(
      { _id: oid, userId },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
}

export async function deleteCustomConcept(id: string, userId: string): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<CustomConceptDoc>("custom_concepts")
    .deleteOne({ _id: oid, userId });
  return result.deletedCount > 0;
}

export async function getHabits(userId: string): Promise<(Habit & { _id: string })[]> {
  const database = await getDb();
  const docs = await database
    .collection<HabitDoc>("habits")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (Habit & { _id: string })[];
}

export async function getHabit(id: string, userId: string): Promise<(Habit & { _id: string }) | null> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await database
    .collection<HabitDoc>("habits")
    .findOne({ _id: oid, userId });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() } as Habit & { _id: string };
}

export async function createHabit(
  userId: string,
  habit: { sourceType: "concept" | "ltm"; sourceId: string; name: string; description: string; howToFollowThrough: string; tips: string }
): Promise<Habit & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<Habit, "_id"> = {
    userId,
    sourceType: habit.sourceType,
    sourceId: habit.sourceId,
    name: habit.name,
    description: habit.description,
    howToFollowThrough: habit.howToFollowThrough,
    tips: habit.tips,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("habits").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as Habit & { _id: string };
}

export async function updateHabit(
  id: string,
  userId: string,
  updates: { name?: string; description?: string; howToFollowThrough?: string; tips?: string }
): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<HabitDoc>("habits")
    .updateOne({ _id: oid, userId }, { $set: { ...updates, updatedAt: new Date() } });
  return result.modifiedCount > 0;
}

export async function deleteHabit(id: string, userId: string): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database.collection<HabitDoc>("habits").deleteOne({ _id: oid, userId });
  return result.deletedCount > 0;
}

export async function getSavedPerspectiveCards(
  userId: string
): Promise<(SavedPerspectiveCard & { _id: string })[]> {
  const database = await getDb();
  const docs = await database
    .collection<SavedPerspectiveCardDoc>("saved_perspective_cards")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (SavedPerspectiveCard & { _id: string })[];
}

export async function createSavedPerspectiveCard(
  userId: string,
  name: string,
  prompt: string,
  follow_ups: string[],
  sourceDeckId?: string,
  sourceDeckName?: string
): Promise<SavedPerspectiveCard & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<SavedPerspectiveCard, "_id"> = {
    userId,
    name,
    prompt,
    follow_ups,
    sourceDeckId,
    sourceDeckName,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("saved_perspective_cards").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as SavedPerspectiveCard & { _id: string };
}

export async function deleteSavedPerspectiveCard(id: string, userId: string): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<SavedPerspectiveCardDoc>("saved_perspective_cards")
    .deleteOne({ _id: oid, userId });
  return result.deletedCount > 0;
}

export async function getConceptGroups(
  userId: string
): Promise<(ConceptGroup & { _id: string })[]> {
  const database = await getDb();
  const docs = await database
    .collection<ConceptGroupDoc>("concept_groups")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (ConceptGroup & { _id: string })[];
}

export async function getConceptGroup(
  id: string,
  userId: string
): Promise<(ConceptGroup & { _id: string }) | null> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await database
    .collection<ConceptGroupDoc>("concept_groups")
    .findOne({ _id: oid, userId });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() } as ConceptGroup & { _id: string };
}

export async function getConceptGroupsByIds(
  ids: string[],
  userId: string
): Promise<(ConceptGroup & { _id: string })[]> {
  if (ids.length === 0) return [];
  const database = await getDb();
  const objectIds: ObjectId[] = [];
  for (const id of ids) {
    try {
      objectIds.push(new ObjectId(id));
    } catch {
      /* skip invalid id */
    }
  }
  if (objectIds.length === 0) return [];
  const docs = await database
    .collection<ConceptGroupDoc>("concept_groups")
    .find({ _id: { $in: objectIds }, userId })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (ConceptGroup & { _id: string })[];
}

export async function createConceptGroup(
  userId: string,
  title: string,
  conceptIds: string[],
  isCustomGroup?: boolean
): Promise<ConceptGroup & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<ConceptGroup, "_id"> = {
    userId,
    title,
    conceptIds,
    ...(isCustomGroup && { isCustomGroup: true }),
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("concept_groups").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as ConceptGroup & { _id: string };
}

export async function updateConceptGroup(
  id: string,
  userId: string,
  updates: {
    title?: string;
    conceptIds?: string[];
    chainOfThought?: string[];
  },
  options?: { unsetLegacyFrameworkSummary?: boolean }
): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const payload: {
    $set: Record<string, unknown>;
    $unset?: Record<string, "">;
  } = {
    $set: { ...updates, updatedAt: new Date() },
  };
  if (options?.unsetLegacyFrameworkSummary) {
    payload.$unset = { summary: "" };
  }
  const result = await database
    .collection<ConceptGroupDoc>("concept_groups")
    .updateOne({ _id: oid, userId }, payload);
  /* matchedCount: idempotent updates still succeed */
  return result.matchedCount > 0;
}

export async function getConceptGroupEnrichmentWithIds(
  userId: string
): Promise<{ id: string; title: string; enrichmentPrompts: string[] }[]> {
  const groups = await getConceptGroups(userId);
  const result: { id: string; title: string; enrichmentPrompts: string[] }[] = [];
  for (const g of groups) {
    if (g.conceptIds.length === 0) {
      result.push({ id: g._id, title: g.title, enrichmentPrompts: [] });
      continue;
    }
    const concepts = await getCustomConceptsByIds(g.conceptIds, userId);
    const enrichmentPrompts = concepts
      .map((c) => c.enrichmentPrompt)
      .filter(Boolean);
    result.push({ id: g._id, title: g.title, enrichmentPrompts });
  }
  return result;
}

export async function deleteConceptGroup(id: string, userId: string): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const group = await getConceptGroup(id, userId);
  // Only delete concepts when it's a domain (AI-created). Custom groups reference existing concepts.
  if (group && !group.isCustomGroup && group.conceptIds.length > 0) {
    for (const conceptId of group.conceptIds) {
      await deleteCustomConcept(conceptId, userId);
    }
  }
  const result = await database
    .collection<ConceptGroupDoc>("concept_groups")
    .deleteOne({ _id: oid, userId });
  return result.deletedCount > 0;
}

export async function getEnrichmentPrompts(userId: string): Promise<string[]> {
  const database = await getDb();
  const docs = await database
    .collection<LongTermMemoryDoc>("long_term_memory")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .project({ enrichmentPrompt: 1 })
    .toArray();
  return docs.map((d) => d.enrichmentPrompt).filter(Boolean);
}

export async function getEnrichmentPromptsWithIds(
  userId: string
): Promise<{ id: string; enrichmentPrompt: string; title?: string }[]> {
  const database = await getDb();
  const docs = await database
    .collection<LongTermMemoryDoc>("long_term_memory")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .project({ _id: 1, enrichmentPrompt: 1, title: 1 })
    .toArray();
  return docs
    .filter((d) => d.enrichmentPrompt)
    .map((d) => ({
      id: d._id.toString(),
      enrichmentPrompt: d.enrichmentPrompt,
      title: d.title,
    }));
}

export async function deleteSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const database = await getDb();
  let id: ObjectId;
  try {
    id = new ObjectId(sessionId);
  } catch {
    return false;
  }
  await database.collection<Message>("messages").deleteMany({ sessionId });
  const result = await database
    .collection<SessionDoc>("sessions")
    .deleteOne({ _id: id, userId });
  return result.deletedCount > 0;
}

export async function getSavedTranscripts(
  userId: string
): Promise<(SavedTranscript & { _id: string })[]> {
  const database = await getDb();
  const docs = await database
    .collection<SavedTranscriptDoc>("transcripts")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (SavedTranscript & { _id: string })[];
}

export async function getSavedTranscript(
  id: string,
  userId: string
): Promise<(SavedTranscript & { _id: string }) | null> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await database
    .collection<SavedTranscriptDoc>("transcripts")
    .findOne({ _id: oid, userId });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() } as SavedTranscript & { _id: string };
}

export async function getSavedTranscriptByVideoId(
  videoId: string,
  userId: string
): Promise<(SavedTranscript & { _id: string }) | null> {
  const database = await getDb();
  const doc = await database
    .collection<SavedTranscriptDoc>("transcripts")
    .findOne({ videoId, userId });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() } as SavedTranscript & { _id: string };
}

export async function saveTranscript(
  userId: string,
  videoId: string,
  transcriptText: string,
  videoTitle?: string,
  channel?: string
): Promise<SavedTranscript & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const existing = await getSavedTranscriptByVideoId(videoId, userId);
  if (existing) {
    await database
      .collection<SavedTranscriptDoc>("transcripts")
      .updateOne(
        { _id: new ObjectId(existing._id), userId },
        {
          $set: {
            transcriptText,
            videoTitle: videoTitle ?? existing.videoTitle,
            channel: channel ?? existing.channel,
            updatedAt: now,
          },
        }
      );
    return { ...existing, transcriptText, videoTitle: videoTitle ?? existing.videoTitle, channel: channel ?? existing.channel, updatedAt: now };
  }
  const doc: Omit<SavedTranscript, "_id"> = {
    userId,
    videoId,
    videoTitle,
    channel,
    transcriptText,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("transcripts").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as SavedTranscript & { _id: string };
}

/** Persist a user journal as a transcript row (no YouTube URL). `videoId` is synthetic. */
export async function saveJournalTranscript(
  userId: string,
  transcriptText: string,
  journalTitle?: string
): Promise<SavedTranscript & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const videoId = `journal_${new ObjectId().toHexString()}`;
  const doc: Omit<SavedTranscript, "_id"> = {
    userId,
    videoId,
    videoTitle: journalTitle?.trim() || "Journal entry",
    sourceType: "journal",
    transcriptText,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("transcripts").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as SavedTranscript & { _id: string };
}

export async function deleteSavedTranscript(id: string, userId: string): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<SavedTranscriptDoc>("transcripts")
    .deleteOne({ _id: oid, userId });
  return result.deletedCount > 0;
}

export async function updateTranscriptExtractedConcepts(
  id: string,
  userId: string,
  groups: ExtractedConceptGroup[]
): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<SavedTranscriptDoc>("transcripts")
    .updateOne(
      { _id: oid, userId },
      { $set: { extractedConcepts: groups, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
}

export async function getNuggets(userId: string): Promise<(Nugget & { _id: string })[]> {
  const database = await getDb();
  const docs = await database
    .collection<NuggetDoc>("nuggets")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() })) as (Nugget & { _id: string })[];
}

export async function createNugget(
  userId: string,
  content: string,
  source?: string
): Promise<Nugget & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<Nugget, "_id"> = {
    userId,
    content: content.trim(),
    source: source?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  // MongoDB insertOne accepts docs without _id; it will be generated
  const result = await database
    .collection<NuggetDoc>("nuggets")
    .insertOne(doc as unknown as NuggetDoc);
  return { ...doc, _id: result.insertedId.toString() } as Nugget & { _id: string };
}

export async function deleteNugget(id: string, userId: string): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<NuggetDoc>("nuggets")
    .deleteOne({ _id: oid, userId });
  return result.deletedCount > 0;
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const database = await getDb();
  const doc = await database
    .collection<UserSettingsDoc>("user_settings")
    .findOne({ userId });
  if (!doc) return null;
  return {
    userId: doc.userId,
    theme: doc.theme,
    language: doc.language,
    userType: doc.userType,
    ttsSpeed: doc.ttsSpeed,
    clonedVoiceId: doc.clonedVoiceId,
    clonedVoiceName: doc.clonedVoiceName,
    clonedVoices: doc.clonedVoices,
    background: doc.background,
    weatherFormat: doc.weatherFormat,
    followedFigureIds: doc.followedFigureIds,
    leaderboardOptIn: doc.leaderboardOptIn,
    updatedAt: doc.updatedAt,
  };
}

export async function upsertUserSettings(
  userId: string,
  updates: Partial<Pick<UserSettings, "theme" | "language" | "userType" | "ttsSpeed" | "clonedVoiceId" | "clonedVoiceName" | "clonedVoices" | "background" | "weatherFormat" | "followedFigureIds" | "leaderboardOptIn">>
): Promise<UserSettings> {
  const database = await getDb();
  const now = new Date();
  const result = await database.collection<UserSettingsDoc>("user_settings").findOneAndUpdate(
    { userId },
    { $set: { userId, ...updates, updatedAt: now } },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) {
    return { userId, ...updates, updatedAt: now };
  }
  return {
    userId: result.userId,
    theme: result.theme,
    language: result.language,
    userType: result.userType,
    ttsSpeed: result.ttsSpeed,
    clonedVoiceId: result.clonedVoiceId,
    clonedVoiceName: result.clonedVoiceName,
    clonedVoices: result.clonedVoices,
    background: result.background,
    weatherFormat: result.weatherFormat,
    followedFigureIds: result.followedFigureIds,
    leaderboardOptIn: result.leaderboardOptIn,
    updatedAt: result.updatedAt,
  };
}

/** Delete all user data: sessions, messages, LTM, custom concepts, concept groups, saved concepts, transcripts, nuggets, settings */
export async function deleteAllUserData(userId: string): Promise<void> {
  const database = await getDb();
  const sessions = await database
    .collection<SessionDoc>("sessions")
    .find({ userId })
    .project({ _id: 1 })
    .toArray();
  const sessionIds = sessions.map((s) => s._id.toString());
  await database.collection<Message>("messages").deleteMany({
    sessionId: { $in: sessionIds },
  });
  await database.collection<SessionDoc>("sessions").deleteMany({ userId });
  await database.collection<LongTermMemoryDoc>("long_term_memory").deleteMany({ userId });
  await database.collection<CustomConceptDoc>("custom_concepts").deleteMany({ userId });
  await database.collection<ConceptGroupDoc>("concept_groups").deleteMany({ userId });
  await database.collection<SavedConcept>("user_saved_concepts").deleteMany({ userId });
  await database.collection<SavedTranscriptDoc>("transcripts").deleteMany({ userId });
  await database.collection<NuggetDoc>("nuggets").deleteMany({ userId });
  await database.collection<UserMentalModelDoc>("user_mental_models").deleteMany({ userId });
  await database.collection<UserSettingsDoc>("user_settings").deleteMany({ userId });
  await database.collection<SavedPerspectiveCardDoc>("saved_perspective_cards").deleteMany({ userId });
  await database.collection<HabitDoc>("habits").deleteMany({ userId });
  await database.collection("user_progress").deleteMany({ userId });
}
