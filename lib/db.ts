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
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  _id?: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface SessionDoc {
  _id: ObjectId;
  userId: string;
  title?: string;
  mentalModelTags?: string[];
  isCollapsed?: boolean;
  longTermMemoryId?: string;
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
  createdAt: Date;
  updatedAt: Date;
}

interface ConceptGroupDoc extends Omit<ConceptGroup, "_id"> {
  _id: ObjectId;
}

export interface SavedTranscript {
  _id?: string;
  userId: string;
  videoId: string;
  videoTitle?: string;
  channel?: string;
  transcriptText: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SavedTranscriptDoc extends Omit<SavedTranscript, "_id"> {
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
  /** ElevenLabs Instant Voice Clone ID; when set, TTS uses this voice. Audio clips are never stored—only this ID. */
  clonedVoiceId?: string;
  clonedVoiceName?: string;
  /** Preferred cloned voices tagged by app language code. */
  clonedVoices?: ClonedVoiceSetting[];
  background?: BackgroundElement;
  weatherFormat?: "condition-temp" | "emoji-temp" | "temp-only";
  updatedAt: Date;
}

interface UserSettingsDoc extends UserSettings {
  _id?: ObjectId;
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
  content: string
): Promise<void> {
  const database = await getDb();
  let id: ObjectId;
  try {
    id = new ObjectId(sessionId);
  } catch {
    throw new Error("Invalid session ID");
  }
  await database.collection<Message>("messages").insertOne({
    sessionId,
    role,
    content,
    createdAt: new Date(),
  });
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
  }
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
      { $set: { ...updates, updatedAt: new Date() } }
    );
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
  enrichmentPrompt: string
): Promise<LongTermMemory & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<LongTermMemory, "_id"> = {
    userId,
    sourceSessionId,
    title,
    summary,
    enrichmentPrompt,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("long_term_memory").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as LongTermMemory & { _id: string };
}

export async function updateLongTermMemory(
  id: string,
  userId: string,
  updates: { title?: string; summary?: string; enrichmentPrompt?: string }
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
  enrichmentPrompt: string
): Promise<CustomConcept & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<CustomConcept, "_id"> = {
    userId,
    title,
    summary,
    enrichmentPrompt,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("custom_concepts").insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() } as CustomConcept & { _id: string };
}

export async function updateCustomConcept(
  id: string,
  userId: string,
  updates: { title?: string; summary?: string; enrichmentPrompt?: string }
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
  updates: { title?: string; conceptIds?: string[] }
): Promise<boolean> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<ConceptGroupDoc>("concept_groups")
    .updateOne(
      { _id: oid, userId },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
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
    updatedAt: doc.updatedAt,
  };
}

export async function upsertUserSettings(
  userId: string,
  updates: Partial<Pick<UserSettings, "theme" | "language" | "userType" | "ttsSpeed" | "clonedVoiceId" | "clonedVoiceName" | "clonedVoices" | "background" | "weatherFormat">>
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
  await database.collection<UserSettingsDoc>("user_settings").deleteMany({ userId });
}
