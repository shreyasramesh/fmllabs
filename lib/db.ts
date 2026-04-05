import { MongoClient, Db, ObjectId } from "mongodb";
import { getCache } from "./cache";
import {
  decryptConceptGroupFields,
  decryptCustomConceptFields,
  decryptHabitFields,
  decryptLongTermMemoryFields,
  decryptMessageFields,
  decryptSavedConceptFields,
  decryptSavedPerspectiveCardFields,
  decryptSessionFields,
  decryptTranscriptFields,
  decryptUserMentalModelFields,
  decryptUserSettingsFields,
  encryptConceptGroupFields,
  encryptCustomConceptFields,
  encryptHabitFields,
  encryptLongTermMemoryFields,
  encryptMessageFields,
  encryptSavedConceptFields,
  encryptSavedPerspectiveCardFields,
  encryptSessionFields,
  encryptTranscriptFields,
  encryptUserMentalModelFields,
  encryptUserSettingsFields,
} from "./crypto-fields";
import { getPacificTimeParts } from "./journal-entry-time";
import type { HabitBucket } from "./habit-buckets";
export type { HabitBucket } from "./habit-buckets";
export { HABIT_BUCKET_IDS, isHabitBucket } from "./habit-buckets";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/and-then-what";

let client: MongoClient | null = null;
let db: Db | null = null;

// ── Cache namespaces (TTLs in ms) ──
// Short TTLs for mutation-heavy data that must feel instant after writes.
// Longer TTLs for rarely-mutated reference data (mental models, settings).
const TTL_1M  = 30_000;        // 30s — habit completions
const TTL_2M  = 45_000;        // 45s — sessions, habits, focus, transcripts
const TTL_3M  = 2 * 60_000;    // 2m  — sleep, weight, custom concepts, memories
const TTL_5M  = 10 * 60_000;   // 10m — settings, mental models, saved concepts, perspective cards

const settingsCache     = getCache("settings");
const sessionsCache     = getCache("sessions");
const habitsCache       = getCache("habits");
const completionsCache  = getCache("completions");
const sleepCache        = getCache("sleep");
const weightCache       = getCache("weight");
const focusCache        = getCache("focus");
const transcriptsCache  = getCache("transcripts");
const mentalModelsCache = getCache("mentalModels");
const savedConceptsCache = getCache("savedConcepts");
const customConceptsCache = getCache("customConcepts");
const perspectiveCardsCache = getCache("perspectiveCards");
const conceptGroupsCache = getCache("conceptGroups");
const memoriesCache     = getCache("memories");
const reusableItemsCache = getCache("reusableItems");

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
  void ensureIndexes(db);
  return db;
}

let indexesEnsured = false;
async function ensureIndexes(database: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    await Promise.all([
      database.collection("sessions").createIndex({ userId: 1, updatedAt: -1 }, { background: true }),
      database.collection("messages").createIndex({ sessionId: 1, createdAt: 1 }, { background: true }),
      database.collection("transcripts").createIndex({ userId: 1, updatedAt: -1 }, { background: true }),
      database.collection("habits").createIndex({ userId: 1 }, { background: true }),
      database.collection("habit_completions").createIndex({ userId: 1, habitId: 1, dateKey: 1 }, { background: true }),
      database.collection("user_settings").createIndex({ userId: 1 }, { unique: true, background: true }),
      database.collection("user_sleep_entries").createIndex({ userId: 1, entryYear: -1, entryMonth: -1 }, { background: true }),
      database.collection("user_weight_entries").createIndex({ userId: 1, recordedAt: -1 }, { background: true }),
      database.collection("user_focus_entries").createIndex({ userId: 1, startedAt: -1 }, { background: true }),
      database.collection("user_mental_models").createIndex({ userId: 1, updatedAt: -1 }, { background: true }),
      database.collection("user_saved_concepts").createIndex({ userId: 1, savedAt: -1 }, { background: true }),
      database.collection("custom_concepts").createIndex({ userId: 1, updatedAt: -1 }, { background: true }),
      database.collection("saved_perspective_cards").createIndex({ userId: 1, updatedAt: -1 }, { background: true }),
      database.collection("concept_groups").createIndex({ userId: 1, updatedAt: -1 }, { background: true }),
      database.collection("long_term_memory").createIndex({ userId: 1, updatedAt: -1 }, { background: true }),
      database.collection("user_reusable_journal_items").createIndex({ userId: 1, kind: 1, usageCount: -1 }, { background: true }),
    ]);
  } catch {
    indexesEnsured = false;
  }
}

export interface Session {
  _id?: string;
  userId: string;
  title?: string;
  responseVerbosity?: "compact" | "detailed";
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
  /** Second-order thinking mode */
  secondOrderThinking?: boolean;
  /** When true with secondOrderThinking, no mental-model index or user-library context in the prompt (plain language only). */
  secondOrderPlain?: boolean;
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
  responseVerbosity?: "compact" | "detailed";
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
  secondOrderPlain?: boolean;
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
  /** When set, concept was saved from extraction tied to this saved transcript row */
  sourceTranscriptId?: string;
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
  /** Source: linked concept/LTM, or manual (no upstream source). */
  sourceType: "concept" | "ltm" | "manual";
  /** Empty string when sourceType is manual. */
  sourceId: string;
  /** Life-area bucket; omitted on legacy documents until user assigns one. */
  bucket?: HabitBucket;
  /** Optional month (1–12) and year when the user plans to start this habit. */
  intendedMonth?: number;
  intendedYear?: number;
  name: string;
  description: string;
  howToFollowThrough: string;
  tips: string;
  /** AI-generated research notes to better understand this experiment. */
  researchNotes?: string;
  researchUpdatedAt?: Date;
  /** When true, habit appears in the Hero Habits landing module. */
  isHeroHabit?: boolean;
  /** AI-estimated calorie impact when the habit is completed once. */
  calorieImpact?: {
    type: "intake" | "burn";
    calories: number;
    label: string;
  };
  /** Optional per-habit reminder schedule. */
  reminder?: {
    enabled: boolean;
    hour: number;
    minute: number;
    days: number[];
  };
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
  /** Journal subtype used for calorie tracking entries. */
  journalCategory?: "nutrition" | "exercise";
  /** Optional shared id to link related journal rows (e.g. mixed nutrition+exercise input). */
  journalBatchId?: string;
  /** Calendar date the user assigned to the entry (journal only); display and sorting. */
  journalEntryDay?: number;
  journalEntryMonth?: number;
  journalEntryYear?: number;
  /** Optional local entry time assigned to journal entries for same-day ordering. */
  journalEntryHour?: number;
  journalEntryMinute?: number;
  transcriptText: string;
  extractedConcepts?: ExtractedConceptGroup[];
  /** AI mentor reflections for journal entries only */
  journalMentorReflections?: JournalMentorReflectionItem[];
  journalMentorReflectionsStatus?: JournalMentorReflectionsStatus;
  journalMentorReflectionsUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedNutritionExerciseItem {
  _id?: string;
  userId: string;
  kind: "nutrition" | "exercise";
  canonicalName: string;
  displayName: string;
  sampleEntry: string;
  usageCount: number;
  aliases?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
}

interface SavedNutritionExerciseItemDoc extends Omit<SavedNutritionExerciseItem, "_id"> {
  _id: ObjectId;
}

export interface ReusableJournalTag {
  _id?: string;
  userId: string;
  kind: "nutrition" | "exercise";
  tag: string;
  displayName: string;
  aliases?: string[];
  sampleEntry: string;
  nutritionSnapshot?: {
    calories?: number | null;
    proteinGrams?: number | null;
    carbsGrams?: number | null;
    fatGrams?: number | null;
    facts?: {
      totalCarbohydratesGrams?: number | null;
      dietaryFiberGrams?: number | null;
      sugarGrams?: number | null;
      addedSugarsGrams?: number | null;
      sugarAlcoholsGrams?: number | null;
      netCarbsGrams?: number | null;
      saturatedFatGrams?: number | null;
      transFatGrams?: number | null;
      polyunsaturatedFatGrams?: number | null;
      monounsaturatedFatGrams?: number | null;
      cholesterolMg?: number | null;
      sodiumMg?: number | null;
      calciumMg?: number | null;
      ironMg?: number | null;
      potassiumMg?: number | null;
      vitaminAIu?: number | null;
      vitaminCMg?: number | null;
      vitaminDMcg?: number | null;
    };
  };
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
}

interface ReusableJournalTagDoc extends Omit<ReusableJournalTag, "_id"> {
  _id: ObjectId;
}

export interface ReusableNutritionEntryUsage {
  _id?: string;
  userId: string;
  sourceTranscriptId: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
}

interface ReusableNutritionEntryUsageDoc extends Omit<ReusableNutritionEntryUsage, "_id"> {
  _id?: ObjectId;
}

export interface WeightEntry {
  _id?: string;
  userId: string;
  weightKg: number;
  targetWeightKg?: number | null;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface WeightEntryDoc extends Omit<WeightEntry, "_id"> {
  _id?: ObjectId;
}

export interface FocusEntry {
  _id?: string;
  userId: string;
  tag?: string;
  minutes: number;
  startedAt: Date;
  endedAt: Date;
  entryDay: number;
  entryMonth: number;
  entryYear: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FocusEntryDoc extends Omit<FocusEntry, "_id"> {
  _id?: ObjectId;
}

export interface SleepEntry {
  _id?: string;
  userId: string;
  sleepHours: number;
  hrvMs: number | null;
  /** User-provided sleep quality score (1-100), e.g. from a wearable. */
  sleepScore: number | null;
  entryDay: number;
  entryMonth: number;
  entryYear: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SleepEntryDoc extends Omit<SleepEntry, "_id"> {
  _id?: ObjectId;
}

export interface ConceptReview {
  _id?: string;
  userId: string;
  conceptId: string;
  reviewedAt: Date;
}

interface ConceptReviewDoc extends Omit<ConceptReview, "_id"> {
  _id?: ObjectId;
}

export interface DailyLifeReportSnapshot {
  _id?: string;
  userId: string;
  dayKey: string;
  entryDay: number;
  entryMonth: number;
  entryYear: number;
  dayLabel: string;
  mentorFigureId?: string;
  mentorFigureName?: string;
  report: {
    coachIntro: string;
    summary: string;
    wins: string[];
    momentumSignals: string[];
    tomorrowGamePlan: string[];
    sectionCards: Array<{
      key: "conversations" | "memories" | "focus" | "nutrition_exercise" | "journaling";
      title: string;
      body: string;
      accent: "violet" | "teal" | "emerald" | "amber" | "rose" | "sky";
    }>;
    closingNote: string;
  };
  snapshot: {
    conversationsCount: number;
    conversationMessagesCount: number;
    memoriesTouchedCount: number;
    focusSessionsCount: number;
    focusMinutes: number;
    nutritionEntriesCount: number;
    exerciseEntriesCount: number;
    journalEntriesCount: number;
    caloriesFood: number;
    caloriesExercise: number;
    carbsGrams: number;
    proteinGrams: number;
    fatGrams: number;
  };
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface DailyLifeReportSnapshotDoc extends Omit<DailyLifeReportSnapshot, "_id"> {
  _id?: ObjectId;
}

export type JournalMentorReflectionsStatus = "pending" | "ready" | "failed";

export interface JournalMentorReflectionItem {
  figureId: string;
  figureName: string;
  reflection: string;
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

export type BackgroundElement = "default" | "air" | "water" | "earth" | "fire";
export type NutritionFatLossMethod =
  | "calorie_counting"
  | "intermittent_fasting"
  | "diet_based";
export type NutritionDietTemplate = "balanced" | "low_carb" | "high_protein" | "low_fat";
export type NutritionMethodConfig = {
  intermittentFastingEatingWindowHours?: number;
  dietBasedTemplate?: NutritionDietTemplate;
};
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
  /** Daily nutrition goals shown on landing cards. */
  goalCaloriesTarget?: number;
  goalCarbsGrams?: number;
  goalProteinGrams?: number;
  goalFatGrams?: number;
  /** Primary fat-loss approach selected in daily goals calculator. */
  nutritionFatLossMethod?: NutritionFatLossMethod;
  /** Multi-select fat-loss approaches selected in daily goals calculator. */
  nutritionFatLossMethods?: NutritionFatLossMethod[];
  /** Optional method-specific configuration (fasting window / macro template). */
  nutritionMethodConfig?: NutritionMethodConfig;
  /** User-entered natural-language objective for nutrition coaching. */
  nutritionGoalIntent?: string;
  /** When true, user appears on the global XP leaderboard */
  leaderboardOptIn?: boolean;
  /** How the assistant should address the user; falls back to Clerk name when unset */
  preferredName?: string;
  /** Local reminder schedule preferences for Android notifications. */
  reminderPreferences?: {
    nutrition: { enabled: boolean; hour: number; minute: number; days: number[] };
    exercise: { enabled: boolean; hour: number; minute: number; days: number[] };
    gratitude: { enabled: boolean; hour: number; minute: number; days: number[] };
    weight: { enabled: boolean; hour: number; minute: number; days: number[] };
    mentalModel: { enabled: boolean; hour: number; minute: number; days: number[] };
  };
  updatedAt: Date;
}

interface UserSettingsDoc extends UserSettings {
  _id?: ObjectId;
}

function normalizeReusableItemName(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_=+[{\]}\\|;:'",<>/?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120);
}

function buildReusableAliases(canonicalName: string): string[] {
  const aliases = new Set<string>();
  aliases.add(canonicalName);
  const words = canonicalName.split(" ").filter(Boolean);
  if (words.length >= 2) {
    aliases.add(words.slice(0, 2).join(" "));
    aliases.add(words.slice(-2).join(" "));
  }
  if (words.length >= 1) aliases.add(words[0]);
  return Array.from(aliases).map((a) => a.slice(0, 80)).filter(Boolean).slice(0, 6);
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
  /** Encrypted JSON string when `ENCRYPTION_KEY` is set; legacy plaintext object otherwise */
  metadata: Record<string, unknown> | string;
  timestamp: Date;
}

export async function getSessions(userId: string): Promise<(Session & { _id: string })[]> {
  const cached = sessionsCache.get<(Session & { _id: string })[]>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const sessions = await database
    .collection<Session>("sessions")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  const result = sessions.map((s) =>
    decryptSessionFields({ ...s, _id: s._id?.toString() ?? "" } as Session & { _id: string })
  ) as (Session & { _id: string })[];
  sessionsCache.set(userId, result, TTL_2M);
  return result;
}

export async function createSession(
  userId: string,
  title?: string,
  responseVerbosity?: "compact" | "detailed"
): Promise<Session & { _id: string }> {
  sessionsCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const session: Omit<Session, "_id"> = encryptSessionFields({
    userId,
    title: title || "New conversation",
    responseVerbosity,
    createdAt: now,
    updatedAt: now,
  }) as Omit<Session, "_id">;
  const result = await database.collection("sessions").insertOne(session);
  return decryptSessionFields({
    ...session,
    _id: result.insertedId.toString(),
  }) as Session & { _id: string };
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
  return decryptSessionFields({
    ...session,
    _id: session._id.toString(),
  } as Session & { _id: string });
}

export async function getMessages(sessionId: string, userId: string): Promise<Message[]> {
  const session = await getSession(sessionId, userId);
  if (!session) return [];
  const database = await getDb();
  const messages = await database
    .collection<Message>("messages")
    .find({ sessionId })
    .sort({ createdAt: 1 })
    .toArray();
  return messages.map((m) =>
    decryptMessageFields({
      ...m,
      _id: m._id?.toString(),
    })
  );
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
    .updateOne({ _id: id, userId }, { $set: { updatedAt: new Date() } });
  return true;
}

export async function appendMessage(
  sessionId: string,
  userId: string,
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
  const doc = encryptMessageFields({
    sessionId,
    role,
    content,
    createdAt: new Date(),
  }) as Message;
  await database.collection<Message>("messages").insertOne(doc);
  await database.collection<SessionDoc>("sessions").updateOne(
    { _id: id, userId },
    { $set: { updatedAt: new Date() } }
  );
}

export async function updateSession(
  sessionId: string,
  userId: string,
  updates: {
    title?: string;
    responseVerbosity?: "compact" | "detailed";
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
    secondOrderPlain?: boolean;
    /** Remove 1:1 mentor fields from the session document */
    clearOneOnOneMentor?: boolean;
    /** Remove second-order flags from the session document */
    clearSecondOrder?: boolean;
    /** Remove perspective card fields from the session document */
    clearPerspectiveCard?: boolean;
  }
): Promise<boolean> {
  sessionsCache.invalidate(userId);
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
    clearPerspectiveCard,
    ...rest
  } = updates;
  const encryptedRest = encryptSessionFields<Record<string, unknown>>(rest as object);
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(encryptedRest)) {
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
    $unset.secondOrderPlain = "";
  }
  if (clearPerspectiveCard) {
    $unset.perspectiveCardPrompt = "";
    $unset.perspectiveCardName = "";
    $unset.perspectiveCardFigureId = "";
    $unset.perspectiveCardFigureName = "";
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
  const encTag =
    encryptSessionFields<{ mentalModelTags?: string[] }>({ mentalModelTags: [tag] })
      .mentalModelTags?.[0] ?? tag;
  const result = await database
    .collection<SessionDoc>("sessions")
    .updateOne(
      { _id: id, userId },
      {
        $addToSet: { mentalModelTags: encTag },
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
  const cached = savedConceptsCache.get<{ modelId: string; savedAt: Date; reflection?: string }[]>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const docs = await database
    .collection<SavedConcept>("user_saved_concepts")
    .find({ userId })
    .sort({ savedAt: -1 })
    .toArray();
  const result = docs.map((d) => {
    const dec = decryptSavedConceptFields<SavedConcept>(d);
    return {
      modelId: dec.modelId,
      savedAt: dec.savedAt,
      reflection: dec.reflection,
    };
  });
  savedConceptsCache.set(userId, result, TTL_5M);
  return result;
}

export async function addSavedConcept(
  userId: string,
  modelId: string,
  reflection?: string
): Promise<boolean> {
  savedConceptsCache.invalidate(userId);
  const database = await getDb();
  const enc =
    reflection != null
      ? encryptSavedConceptFields<{ reflection?: string }>({ reflection }).reflection
      : undefined;
  const result = await database
    .collection<SavedConcept>("user_saved_concepts")
    .updateOne(
      { userId, modelId },
      {
        $set: {
          savedAt: new Date(),
          ...(enc != null && { reflection: enc }),
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
  savedConceptsCache.invalidate(userId);
  const database = await getDb();
  const result = await database
    .collection<SavedConcept>("user_saved_concepts")
    .deleteOne({ userId, modelId });
  return result.deletedCount > 0;
}

export async function getUserMentalModels(userId: string): Promise<UserMentalModel[]> {
  const cached = mentalModelsCache.get<UserMentalModel[]>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const docs = await database
    .collection<UserMentalModelDoc>("user_mental_models")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  const result = docs.map((d) =>
    decryptUserMentalModelFields({
      ...d,
      _id: d._id.toString(),
    } as UserMentalModel)
  ) as UserMentalModel[];
  mentalModelsCache.set(userId, result, TTL_5M);
  return result;
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
  return decryptUserMentalModelFields({
    ...doc,
    _id: doc._id.toString(),
  } as UserMentalModel);
}

export async function createUserMentalModel(
  userId: string,
  model: Omit<UserMentalModel, "userId" | "createdAt" | "updatedAt" | "_id">
): Promise<UserMentalModel> {
  mentalModelsCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const doc = encryptUserMentalModelFields({
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
  }) as Omit<UserMentalModelDoc, "_id">;
  const result = await database.collection("user_mental_models").insertOne(doc);
  return decryptUserMentalModelFields({
    ...doc,
    _id: result.insertedId.toString(),
  }) as UserMentalModel;
}

export async function updateUserMentalModel(
  userId: string,
  id: string,
  updates: Partial<Omit<UserMentalModel, "userId" | "id" | "createdAt" | "_id">>
): Promise<boolean> {
  mentalModelsCache.invalidate(userId);
  const database = await getDb();
  const enc = encryptUserMentalModelFields<Record<string, unknown>>(updates as object);
  const result = await database
    .collection<UserMentalModelDoc>("user_mental_models")
    .updateOne(
      { userId, id },
      { $set: { ...enc, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
}

export async function deleteUserMentalModel(userId: string, id: string): Promise<boolean> {
  mentalModelsCache.invalidate(userId);
  const database = await getDb();
  const result = await database
    .collection<UserMentalModelDoc>("user_mental_models")
    .deleteOne({ userId, id });
  return result.deletedCount > 0;
}

export async function getLongTermMemories(
  userId: string
): Promise<(LongTermMemory & { _id: string })[]> {
  const cached = memoriesCache.get<(LongTermMemory & { _id: string })[]>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const docs = await database
    .collection<LongTermMemory>("long_term_memory")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  const result = docs.map((d) =>
    decryptLongTermMemoryFields({ ...d, _id: d._id.toString() } as LongTermMemory & { _id: string })
  ) as (LongTermMemory & { _id: string })[];
  memoriesCache.set(userId, result, TTL_3M);
  return result;
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
  return decryptLongTermMemoryFields({
    ...doc,
    _id: doc._id.toString(),
  } as LongTermMemory & { _id: string });
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
  return docs.map((d) =>
    decryptLongTermMemoryFields({ ...d, _id: d._id.toString() } as LongTermMemory & { _id: string })
  ) as (LongTermMemory & { _id: string })[];
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
  return decryptLongTermMemoryFields({
    ...doc,
    _id: doc._id.toString(),
  } as LongTermMemory & { _id: string });
}

export async function createLongTermMemory(
  userId: string,
  sourceSessionId: string,
  title: string,
  summary: string,
  enrichmentPrompt: string,
  chainOfThought?: string[]
): Promise<LongTermMemory & { _id: string }> {
  memoriesCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const doc = encryptLongTermMemoryFields({
    userId,
    sourceSessionId,
    title,
    summary,
    enrichmentPrompt,
    ...(chainOfThought?.length ? { chainOfThought } : {}),
    createdAt: now,
    updatedAt: now,
  }) as Omit<LongTermMemory, "_id">;
  const result = await database.collection("long_term_memory").insertOne(doc);
  return decryptLongTermMemoryFields({
    ...doc,
    _id: result.insertedId.toString(),
  }) as LongTermMemory & { _id: string };
}

export async function updateLongTermMemory(
  id: string,
  userId: string,
  updates: { title?: string; summary?: string; enrichmentPrompt?: string; chainOfThought?: string[] }
): Promise<boolean> {
  memoriesCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const enc = encryptLongTermMemoryFields<Record<string, unknown>>(updates as object);
  const result = await database
    .collection<LongTermMemoryDoc>("long_term_memory")
    .updateOne(
      { _id: oid, userId },
      { $set: { ...enc, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
}

export async function deleteLongTermMemory(id: string, userId: string): Promise<boolean> {
  memoriesCache.invalidate(userId);
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
  const cached = customConceptsCache.get<(CustomConcept & { _id: string })[]>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const docs = await database
    .collection<CustomConceptDoc>("custom_concepts")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  const result = docs.map((d) =>
    decryptCustomConceptFields({ ...d, _id: d._id.toString() } as CustomConcept & { _id: string })
  ) as (CustomConcept & { _id: string })[];
  customConceptsCache.set(userId, result, TTL_3M);
  return result;
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
  return decryptCustomConceptFields({
    ...doc,
    _id: doc._id.toString(),
  } as CustomConcept & { _id: string });
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
  return docs.map((d) =>
    decryptCustomConceptFields({ ...d, _id: d._id.toString() } as CustomConcept & { _id: string })
  ) as (CustomConcept & { _id: string })[];
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
    .map((d) =>
      decryptCustomConceptFields<CustomConceptDoc & { _id: ObjectId }>(d as object)
    )
    .filter((d) => d.enrichmentPrompt)
    .map((d) => ({
      id: d._id!.toString(),
      enrichmentPrompt: d.enrichmentPrompt,
      title: d.title,
    }));
}

export async function createCustomConcept(
  userId: string,
  title: string,
  summary: string,
  enrichmentPrompt: string,
  sourceVideoTitle?: string,
  sourceTranscriptId?: string
): Promise<CustomConcept & { _id: string }> {
  customConceptsCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const doc = encryptCustomConceptFields({
    userId,
    title,
    summary,
    enrichmentPrompt,
    ...(sourceVideoTitle != null && sourceVideoTitle !== "" && { sourceVideoTitle }),
    ...(sourceTranscriptId != null &&
      sourceTranscriptId !== "" && { sourceTranscriptId }),
    createdAt: now,
    updatedAt: now,
  }) as Omit<CustomConcept, "_id">;
  const result = await database.collection("custom_concepts").insertOne(doc);
  return decryptCustomConceptFields({
    ...doc,
    _id: result.insertedId.toString(),
  }) as CustomConcept & { _id: string };
}

export async function updateCustomConcept(
  id: string,
  userId: string,
  updates: {
    title?: string;
    summary?: string;
    enrichmentPrompt?: string;
    sourceVideoTitle?: string;
    sourceTranscriptId?: string;
  }
): Promise<boolean> {
  customConceptsCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const enc = encryptCustomConceptFields<Record<string, unknown>>(updates as object);
  const result = await database
    .collection<CustomConceptDoc>("custom_concepts")
    .updateOne(
      { _id: oid, userId },
      { $set: { ...enc, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
}

export async function deleteCustomConcept(id: string, userId: string): Promise<boolean> {
  customConceptsCache.invalidate(userId);
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

/**
 * Removes all custom concepts saved from a given saved transcript (video/journal),
 * updates or removes affected concept groups, then deletes the concept documents.
 */
export async function deleteCustomConceptsFromTranscript(
  userId: string,
  transcriptId: string
): Promise<{ deletedConcepts: number; removedEmptyGroups: number }> {
  customConceptsCache.invalidate(userId);
  const database = await getDb();
  const docs = await database
    .collection<CustomConceptDoc>("custom_concepts")
    .find({ userId, sourceTranscriptId: transcriptId })
    .project({ _id: 1 })
    .toArray();
  const idsToDelete = new Set(docs.map((d) => d._id.toString()));
  if (idsToDelete.size === 0) {
    return { deletedConcepts: 0, removedEmptyGroups: 0 };
  }

  const groups = await getConceptGroups(userId);
  let removedEmptyGroups = 0;
  for (const g of groups) {
    const newIds = g.conceptIds.filter((id) => !idsToDelete.has(id));
    if (newIds.length === g.conceptIds.length) continue;
    let gid: ObjectId;
    try {
      gid = new ObjectId(g._id);
    } catch {
      continue;
    }
    if (newIds.length === 0) {
      await database
        .collection<ConceptGroupDoc>("concept_groups")
        .deleteOne({ _id: gid, userId });
      removedEmptyGroups++;
    } else {
      await updateConceptGroup(g._id, userId, { conceptIds: newIds });
    }
  }

  let deletedConcepts = 0;
  for (const id of idsToDelete) {
    if (await deleteCustomConcept(id, userId)) deletedConcepts++;
  }
  return { deletedConcepts, removedEmptyGroups };
}

export async function getHabits(userId: string): Promise<(Habit & { _id: string })[]> {
  const cached = habitsCache.get<(Habit & { _id: string })[]>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const docs = await database
    .collection<HabitDoc>("habits")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  const result = docs.map((d) =>
    decryptHabitFields({ ...d, _id: d._id.toString() } as Habit & { _id: string })
  ) as (Habit & { _id: string })[];
  habitsCache.set(userId, result, TTL_2M);
  return result;
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
  return decryptHabitFields({
    ...doc,
    _id: doc._id.toString(),
  }) as Habit & { _id: string };
}

export async function createHabit(
  userId: string,
  habit: {
    sourceType: "concept" | "ltm" | "manual";
    sourceId: string;
    bucket: HabitBucket;
    name: string;
    description: string;
    howToFollowThrough: string;
    tips: string;
    intendedMonth?: number;
    intendedYear?: number;
    isHeroHabit?: boolean;
    calorieImpact?: { type: "intake" | "burn"; calories: number; label: string };
  }
): Promise<Habit & { _id: string }> {
  habitsCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const doc = encryptHabitFields({
    userId,
    sourceType: habit.sourceType,
    sourceId: habit.sourceId,
    bucket: habit.bucket,
    ...(habit.intendedMonth !== undefined && habit.intendedYear !== undefined
      ? { intendedMonth: habit.intendedMonth, intendedYear: habit.intendedYear }
      : {}),
    name: habit.name,
    description: habit.description,
    howToFollowThrough: habit.howToFollowThrough,
    tips: habit.tips,
    ...(habit.isHeroHabit ? { isHeroHabit: true } : {}),
    ...(habit.calorieImpact ? { calorieImpact: habit.calorieImpact } : {}),
    createdAt: now,
    updatedAt: now,
  }) as Omit<Habit, "_id">;
  const result = await database.collection("habits").insertOne(doc);
  return decryptHabitFields({
    ...doc,
    _id: result.insertedId.toString(),
  }) as Habit & { _id: string };
}

export async function updateHabit(
  id: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    howToFollowThrough?: string;
    tips?: string;
    researchNotes?: string;
    researchUpdatedAt?: Date;
    bucket?: HabitBucket;
    intendedMonth?: number | null;
    intendedYear?: number | null;
    isHeroHabit?: boolean;
    calorieImpact?: { type: "intake" | "burn"; calories: number; label: string } | null;
    reminder?: { enabled: boolean; hour: number; minute: number; days: number[] } | null;
  }
): Promise<boolean> {
  habitsCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const {
    bucket: _b,
    researchUpdatedAt: researchUpdatedAt,
    intendedMonth: im,
    intendedYear: iy,
    isHeroHabit: _hero,
    calorieImpact: _cal,
    ...textUpdates
  } = updates;
  const enc = encryptHabitFields<Record<string, unknown>>(textUpdates as object);
  const setDoc: Record<string, unknown> = { ...enc, updatedAt: new Date() };
  if (updates.bucket !== undefined) setDoc.bucket = updates.bucket;
  if (updates.isHeroHabit !== undefined) setDoc.isHeroHabit = updates.isHeroHabit;
  if (updates.calorieImpact !== undefined) {
    if (updates.calorieImpact === null) {
      setDoc.calorieImpact = null;
    } else {
      setDoc.calorieImpact = updates.calorieImpact;
    }
  }
  if (updates.reminder !== undefined) {
    if (updates.reminder === null) {
      setDoc.reminder = null;
    } else {
      setDoc.reminder = {
        enabled: !!updates.reminder.enabled,
        hour: Math.max(0, Math.min(23, Math.floor(updates.reminder.hour))),
        minute: Math.max(0, Math.min(59, Math.floor(updates.reminder.minute))),
        days: (updates.reminder.days ?? []).filter((d) => d >= 0 && d <= 6).map(Math.floor),
      };
    }
  }
  if (researchUpdatedAt instanceof Date) {
    setDoc.researchUpdatedAt = researchUpdatedAt;
  }

  const unsetDoc: Record<string, ""> = {};
  if (im !== undefined && iy !== undefined) {
    if (im === null && iy === null) {
      unsetDoc.intendedMonth = "";
      unsetDoc.intendedYear = "";
    } else if (typeof im === "number" && typeof iy === "number") {
      setDoc.intendedMonth = im;
      setDoc.intendedYear = iy;
    } else {
      return false;
    }
  }

  const updateOp: Record<string, unknown> = { $set: setDoc };
  if (Object.keys(unsetDoc).length > 0) {
    updateOp.$unset = unsetDoc;
  }

  const result = await database
    .collection<HabitDoc>("habits")
    .updateOne({ _id: oid, userId }, updateOp);
  return result.modifiedCount > 0;
}

export async function deleteHabit(id: string, userId: string): Promise<boolean> {
  habitsCache.invalidate(userId);
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

// ---------------------------------------------------------------------------
// Habit completions (daily check-offs for 30-day experiments)
// ---------------------------------------------------------------------------

export interface HabitCompletion {
  _id?: string;
  userId: string;
  habitId: string;
  dateKey: string;
  completedAt: Date;
  /** ID of the journal transcript created for calorie tracking (if applicable). */
  journalTranscriptId?: string;
}

interface HabitCompletionDoc extends Omit<HabitCompletion, "_id"> {
  _id: ObjectId;
}

let habitCompletionIndexEnsured = false;

async function ensureHabitCompletionIndex(db: Db) {
  if (habitCompletionIndexEnsured) return;
  await db
    .collection("habit_completions")
    .createIndex({ userId: 1, habitId: 1, dateKey: 1 }, { unique: true });
  habitCompletionIndexEnsured = true;
}

export async function getHabitCompletions(
  userId: string,
  fromDateKey: string,
  toDateKey: string
): Promise<Array<{ habitId: string; dateKey: string }>> {
  const cacheKey = `${userId}:${fromDateKey}:${toDateKey}`;
  const cached = completionsCache.get<Array<{ habitId: string; dateKey: string }>>(cacheKey);
  if (cached !== undefined) return cached;
  const database = await getDb();
  await ensureHabitCompletionIndex(database);
  const docs = await database
    .collection<HabitCompletionDoc>("habit_completions")
    .find({
      userId,
      dateKey: { $gte: fromDateKey, $lte: toDateKey },
    })
    .project<{ habitId: string; dateKey: string }>({ habitId: 1, dateKey: 1, _id: 0 })
    .toArray();
  completionsCache.set(cacheKey, docs, TTL_1M);
  return docs;
}

export async function toggleHabitCompletion(
  userId: string,
  habitId: string,
  dateKey: string,
  calorieImpact?: { type: "intake" | "burn"; calories: number; label: string } | null
): Promise<{ completed: boolean }> {
  completionsCache.invalidatePrefix(userId);
  const database = await getDb();
  await ensureHabitCompletionIndex(database);
  const col = database.collection<HabitCompletionDoc>("habit_completions");
  const existing = await col.findOne({ userId, habitId, dateKey });
  if (existing) {
    if (existing.journalTranscriptId) {
      try {
        await database.collection("transcripts").deleteOne({
          _id: new ObjectId(existing.journalTranscriptId),
          userId,
        });
      } catch {
        /* best-effort cleanup */
      }
    }
    await col.deleteOne({ _id: existing._id });
    return { completed: false };
  }

  let journalTranscriptId: string | undefined;
  if (calorieImpact && calorieImpact.calories > 0) {
    const [yearStr, monthStr, dayStr] = dateKey.split("-");
    const entryDate = {
      day: parseInt(dayStr, 10),
      month: parseInt(monthStr, 10),
      year: parseInt(yearStr, 10),
    };

    let transcriptText: string;
    if (calorieImpact.type === "intake") {
      transcriptText = [
        "Calorie Tracking Journal (Nutrition)",
        "",
        `Enriched entry:`,
        calorieImpact.label,
        "",
        "Nutritional estimate:",
        `- Calories: ${calorieImpact.calories} kcal`,
        `- Carbs: 0 g`,
        `- Protein: 0 g`,
        `- Fat: 0 g`,
        "",
        "Source: Habit completion",
      ].join("\n");
    } else {
      transcriptText = [
        "Calorie Tracking Journal (Exercise)",
        "",
        `Activity:`,
        calorieImpact.label,
        "",
        "Exercise estimate:",
        `- Calories burned: ${calorieImpact.calories} kcal`,
        `- Carbs used: 0 g`,
        `- Fat used: 0 g`,
        `- Protein delta: 0 g`,
        "",
        "Source: Habit completion",
      ].join("\n");
    }

    const journalEntry = await saveJournalTranscript(
      userId,
      transcriptText,
      `Habit: ${calorieImpact.label}`,
      entryDate,
      { journalCategory: calorieImpact.type === "intake" ? "nutrition" : "exercise" }
    );
    journalTranscriptId = journalEntry._id;
  }

  await col.insertOne({
    _id: new ObjectId(),
    userId,
    habitId,
    dateKey,
    completedAt: new Date(),
    ...(journalTranscriptId ? { journalTranscriptId } : {}),
  });
  return { completed: true };
}

export async function getSavedPerspectiveCards(
  userId: string
): Promise<(SavedPerspectiveCard & { _id: string })[]> {
  const cached = perspectiveCardsCache.get<(SavedPerspectiveCard & { _id: string })[]>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const docs = await database
    .collection<SavedPerspectiveCardDoc>("saved_perspective_cards")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  const result = docs.map((d) =>
    decryptSavedPerspectiveCardFields({
      ...d,
      _id: d._id.toString(),
    } as SavedPerspectiveCard & { _id: string })
  ) as (SavedPerspectiveCard & { _id: string })[];
  perspectiveCardsCache.set(userId, result, TTL_5M);
  return result;
}

export async function createSavedPerspectiveCard(
  userId: string,
  name: string,
  prompt: string,
  follow_ups: string[],
  sourceDeckId?: string,
  sourceDeckName?: string
): Promise<SavedPerspectiveCard & { _id: string }> {
  perspectiveCardsCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const doc = encryptSavedPerspectiveCardFields({
    userId,
    name,
    prompt,
    follow_ups,
    sourceDeckId,
    sourceDeckName,
    createdAt: now,
    updatedAt: now,
  }) as Omit<SavedPerspectiveCard, "_id">;
  const result = await database.collection("saved_perspective_cards").insertOne(doc);
  return decryptSavedPerspectiveCardFields({
    ...doc,
    _id: result.insertedId.toString(),
  }) as SavedPerspectiveCard & { _id: string };
}

export async function deleteSavedPerspectiveCard(id: string, userId: string): Promise<boolean> {
  perspectiveCardsCache.invalidate(userId);
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
  const cached = conceptGroupsCache.get<(ConceptGroup & { _id: string })[]>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const docs = await database
    .collection<ConceptGroupDoc>("concept_groups")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  const result = docs.map((d) =>
    decryptConceptGroupFields({ ...d, _id: d._id.toString() } as ConceptGroup & { _id: string })
  ) as (ConceptGroup & { _id: string })[];
  conceptGroupsCache.set(userId, result, TTL_5M);
  return result;
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
  return decryptConceptGroupFields({
    ...doc,
    _id: doc._id.toString(),
  } as ConceptGroup & { _id: string });
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
  return docs.map((d) =>
    decryptConceptGroupFields({ ...d, _id: d._id.toString() } as ConceptGroup & { _id: string })
  ) as (ConceptGroup & { _id: string })[];
}

export async function createConceptGroup(
  userId: string,
  title: string,
  conceptIds: string[],
  isCustomGroup?: boolean
): Promise<ConceptGroup & { _id: string }> {
  conceptGroupsCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const doc = encryptConceptGroupFields({
    userId,
    title,
    conceptIds,
    ...(isCustomGroup && { isCustomGroup: true }),
    createdAt: now,
    updatedAt: now,
  }) as Omit<ConceptGroup, "_id">;
  const result = await database.collection("concept_groups").insertOne(doc);
  return decryptConceptGroupFields({
    ...doc,
    _id: result.insertedId.toString(),
  }) as ConceptGroup & { _id: string };
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
  conceptGroupsCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const enc = encryptConceptGroupFields<Record<string, unknown>>(updates as object);
  const payload: {
    $set: Record<string, unknown>;
    $unset?: Record<string, "">;
  } = {
    $set: { ...enc, updatedAt: new Date() },
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
  conceptGroupsCache.invalidate(userId);
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
  return docs
    .map((d) =>
      decryptLongTermMemoryFields<LongTermMemoryDoc>(d as object).enrichmentPrompt
    )
    .filter(Boolean);
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
    .map((d) => decryptLongTermMemoryFields<LongTermMemoryDoc>(d as object))
    .filter((d) => d.enrichmentPrompt)
    .map((d) => ({
      id: d._id!.toString(),
      enrichmentPrompt: d.enrichmentPrompt,
      title: d.title,
    }));
}

export async function deleteSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  sessionsCache.invalidate(userId);
  const database = await getDb();
  let id: ObjectId;
  try {
    id = new ObjectId(sessionId);
  } catch {
    return false;
  }
  const result = await database
    .collection<SessionDoc>("sessions")
    .deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) return false;
  await database.collection<Message>("messages").deleteMany({ sessionId });
  return true;
}

export async function getSavedTranscripts(
  userId: string
): Promise<(SavedTranscript & { _id: string })[]> {
  const cached = transcriptsCache.get<(SavedTranscript & { _id: string })[]>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const docs = await database
    .collection<SavedTranscriptDoc>("transcripts")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  const result = docs.map((d) =>
    decryptTranscriptFields({ ...d, _id: d._id.toString() } as SavedTranscript & { _id: string })
  ) as (SavedTranscript & { _id: string })[];
  transcriptsCache.set(userId, result, TTL_2M);
  return result;
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
  return decryptTranscriptFields({
    ...doc,
    _id: doc._id.toString(),
  } as SavedTranscript & { _id: string });
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
  return decryptTranscriptFields({
    ...doc,
    _id: doc._id.toString(),
  } as SavedTranscript & { _id: string });
}

export async function saveTranscript(
  userId: string,
  videoId: string,
  transcriptText: string,
  videoTitle?: string,
  channel?: string
): Promise<SavedTranscript & { _id: string }> {
  transcriptsCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const existing = await getSavedTranscriptByVideoId(videoId, userId);
  if (existing) {
    const encPart = encryptTranscriptFields<Record<string, unknown>>({
      transcriptText,
      videoTitle: videoTitle ?? existing.videoTitle,
      channel: channel ?? existing.channel,
    });
    const $set = {
      ...encPart,
      updatedAt: now,
    };
    await database
      .collection<SavedTranscriptDoc>("transcripts")
      .updateOne(
        { _id: new ObjectId(existing._id), userId },
        {
          $set: $set as Record<string, unknown>,
        }
      );
    return {
      ...existing,
      transcriptText,
      videoTitle: videoTitle ?? existing.videoTitle,
      channel: channel ?? existing.channel,
      updatedAt: now,
    };
  }
  const doc = encryptTranscriptFields({
    userId,
    videoId,
    videoTitle,
    channel,
    transcriptText,
    createdAt: now,
    updatedAt: now,
  }) as Omit<SavedTranscript, "_id">;
  const result = await database.collection("transcripts").insertOne(doc);
  return decryptTranscriptFields({
    ...doc,
    _id: result.insertedId.toString(),
  }) as SavedTranscript & { _id: string };
}

/** Persist a user journal as a transcript row (no YouTube URL). `videoId` is synthetic. */
export async function saveJournalTranscript(
  userId: string,
  transcriptText: string,
  journalTitle?: string,
  journalEntryDate?: { day: number; month: number; year: number },
  options?: {
    journalCategory?: "nutrition" | "exercise";
    journalBatchId?: string;
    journalEntryTime?: { hour: number; minute: number };
  }
): Promise<SavedTranscript & { _id: string }> {
  transcriptsCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const videoId = `journal_${new ObjectId().toHexString()}`;
  const pacificFallbackTime = getPacificTimeParts(now);
  const entryHour = options?.journalEntryTime?.hour ?? pacificFallbackTime.hour;
  const entryMinute = options?.journalEntryTime?.minute ?? pacificFallbackTime.minute;
  const doc = encryptTranscriptFields({
    userId,
    videoId,
    videoTitle: journalTitle?.trim() || "Journal entry",
    sourceType: "journal",
    ...(options?.journalCategory ? { journalCategory: options.journalCategory } : {}),
    ...(options?.journalBatchId ? { journalBatchId: options.journalBatchId } : {}),
    transcriptText,
    ...(journalEntryDate && {
      journalEntryDay: journalEntryDate.day,
      journalEntryMonth: journalEntryDate.month,
      journalEntryYear: journalEntryDate.year,
    }),
    journalEntryHour: Math.max(0, Math.min(23, Math.floor(entryHour))),
    journalEntryMinute: Math.max(0, Math.min(59, Math.floor(entryMinute))),
    createdAt: now,
    updatedAt: now,
  }) as Omit<SavedTranscript, "_id">;
  const result = await database.collection("transcripts").insertOne(doc);
  return decryptTranscriptFields({
    ...doc,
    _id: result.insertedId.toString(),
  }) as SavedTranscript & { _id: string };
}

export async function upsertReusableJournalItem(
  userId: string,
  kind: "nutrition" | "exercise",
  entryText: string,
  preferredDisplayName?: string
): Promise<void> {
  reusableItemsCache.invalidatePrefix(userId);
  const database = await getDb();
  const baseText = preferredDisplayName?.trim() || entryText.trim();
  if (!baseText) return;
  const canonicalName = normalizeReusableItemName(baseText);
  if (!canonicalName) return;

  const displayName = baseText.slice(0, 140);
  const sampleEntry = entryText.trim().slice(0, 500);
  const now = new Date();

  await database
    .collection<SavedNutritionExerciseItemDoc>("user_reusable_journal_items")
    .createIndex({ userId: 1, kind: 1, canonicalName: 1 }, { unique: true });

  await database
    .collection<SavedNutritionExerciseItemDoc>("user_reusable_journal_items")
    .updateOne(
      { userId, kind, canonicalName },
      {
        $setOnInsert: {
          userId,
          kind,
          canonicalName,
          createdAt: now,
        },
        $set: {
          displayName,
          sampleEntry,
          aliases: buildReusableAliases(canonicalName),
          updatedAt: now,
          lastUsedAt: now,
        },
        $inc: { usageCount: 1 },
      },
      { upsert: true }
    );
}

export async function getReusableJournalItems(
  userId: string,
  kind: "nutrition" | "exercise",
  query?: string,
  limit = 8
): Promise<Array<SavedNutritionExerciseItem & { _id: string }>> {
  const cacheKey = `${userId}:${kind}:${query ?? ""}:${limit}`;
  const cached = reusableItemsCache.get<Array<SavedNutritionExerciseItem & { _id: string }>>(cacheKey);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const q = normalizeReusableItemName(query ?? "");
  const filter: Record<string, unknown> = { userId, kind };

  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { canonicalName: { $regex: escaped, $options: "i" } },
      { displayName: { $regex: escaped, $options: "i" } },
      { aliases: { $elemMatch: { $regex: escaped, $options: "i" } } },
    ];
  }

  const docs = await database
    .collection<SavedNutritionExerciseItemDoc>("user_reusable_journal_items")
    .find(filter)
    .sort({ usageCount: -1, lastUsedAt: -1, updatedAt: -1 })
    .limit(safeLimit)
    .toArray();

  const result = docs.map((d) => ({
    ...d,
    _id: d._id?.toString() ?? "",
  }));
  reusableItemsCache.set(cacheKey, result, TTL_3M);
  return result;
}

export async function upsertReusableJournalTags(
  userId: string,
  kind: "nutrition" | "exercise",
  tags: Array<{ tag: string; displayName?: string; aliases?: string[] }>,
  sampleEntry: string,
  options?: {
    nutritionSnapshot?: ReusableJournalTag["nutritionSnapshot"];
  }
): Promise<void> {
  const database = await getDb();
  const now = new Date();
  const cleanSample = sampleEntry.trim().slice(0, 500);
  if (!cleanSample) return;

  await database
    .collection<ReusableJournalTagDoc>("user_reusable_journal_tags")
    .createIndex({ userId: 1, kind: 1, tag: 1 }, { unique: true });

  for (const raw of tags.slice(0, 6)) {
    const tag = normalizeReusableItemName(raw.tag);
    if (!tag) continue;
    const displayName = (raw.displayName?.trim() || tag.replace(/_/g, " ")).slice(0, 80);
    const aliases = Array.isArray(raw.aliases)
      ? raw.aliases.map((a) => normalizeReusableItemName(a)).filter(Boolean).slice(0, 8)
      : buildReusableAliases(tag);
    await database
      .collection<ReusableJournalTagDoc>("user_reusable_journal_tags")
      .updateOne(
        { userId, kind, tag },
        {
          $setOnInsert: {
            userId,
            kind,
            tag,
            createdAt: now,
          },
          $set: {
            displayName,
            aliases,
            sampleEntry: cleanSample,
            ...(options?.nutritionSnapshot
              ? { nutritionSnapshot: options.nutritionSnapshot }
              : {}),
            updatedAt: now,
            lastUsedAt: now,
          },
          $inc: { usageCount: 1 },
        },
        { upsert: true }
      );
  }
}

export async function getReusableJournalTags(
  userId: string,
  kind: "nutrition" | "exercise",
  query?: string,
  options?: { minUsageCount?: number; limit?: number }
): Promise<Array<ReusableJournalTag & { _id: string }>> {
  const database = await getDb();
  const minUsageCount = Math.max(1, Math.floor(options?.minUsageCount ?? 1));
  const limit = Math.max(1, Math.min(30, Math.floor(options?.limit ?? 8)));
  const q = normalizeReusableItemName(query ?? "");
  const filter: Record<string, unknown> = {
    userId,
    kind,
    usageCount: { $gte: minUsageCount },
  };
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { tag: { $regex: escaped, $options: "i" } },
      { displayName: { $regex: escaped, $options: "i" } },
      { aliases: { $elemMatch: { $regex: escaped, $options: "i" } } },
    ];
  }
  const docs = await database
    .collection<ReusableJournalTagDoc>("user_reusable_journal_tags")
    .find(filter)
    .sort({ usageCount: -1, lastUsedAt: -1, updatedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => ({
    ...d,
    _id: d._id.toString(),
  }));
}

export async function getReusableJournalTagById(
  userId: string,
  id: string
): Promise<(ReusableJournalTag & { _id: string }) | null> {
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await database
    .collection<ReusableJournalTagDoc>("user_reusable_journal_tags")
    .findOne({ _id: oid, userId });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() };
}

export async function getReusableNutritionEntryUsageMap(
  userId: string,
  sourceTranscriptIds: string[]
): Promise<Record<string, { usageCount: number; lastUsedAt: Date }>> {
  const ids = sourceTranscriptIds
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 2000);
  if (ids.length === 0) return {};
  const database = await getDb();
  const docs = await database
    .collection<ReusableNutritionEntryUsageDoc>("user_reusable_nutrition_entry_usage")
    .find({ userId, sourceTranscriptId: { $in: ids } })
    .toArray();
  const map: Record<string, { usageCount: number; lastUsedAt: Date }> = {};
  for (const d of docs) {
    map[d.sourceTranscriptId] = {
      usageCount: Math.max(0, Number.isFinite(d.usageCount) ? d.usageCount : 0),
      lastUsedAt: d.lastUsedAt ?? d.updatedAt ?? d.createdAt,
    };
  }
  return map;
}

export async function incrementReusableNutritionEntryUsage(
  userId: string,
  sourceTranscriptId: string
): Promise<void> {
  const cleanId = sourceTranscriptId.trim();
  if (!cleanId) return;
  const database = await getDb();
  const now = new Date();
  const collection = database.collection<ReusableNutritionEntryUsageDoc>("user_reusable_nutrition_entry_usage");
  await collection.createIndex({ userId: 1, sourceTranscriptId: 1 }, { unique: true });
  await collection.updateOne(
    { userId, sourceTranscriptId: cleanId },
    {
      $setOnInsert: {
        userId,
        sourceTranscriptId: cleanId,
        createdAt: now,
      },
      $set: {
        updatedAt: now,
        lastUsedAt: now,
      },
      $inc: {
        usageCount: 1,
      },
    },
    { upsert: true }
  );
}

export async function addWeightEntry(
  userId: string,
  weightKg: number,
  options?: { targetWeightKg?: number | null; recordedAt?: Date }
): Promise<WeightEntry & { _id: string }> {
  weightCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const recordedAt = options?.recordedAt ?? now;
  const targetWeightKg =
    typeof options?.targetWeightKg === "number" && Number.isFinite(options.targetWeightKg)
      ? options.targetWeightKg
      : null;
  const doc: Omit<WeightEntryDoc, "_id"> = {
    userId,
    weightKg,
    targetWeightKg,
    recordedAt,
    createdAt: now,
    updatedAt: now,
  };
  const collection = database.collection<WeightEntryDoc>("user_weight_entries");
  await collection.createIndex({ userId: 1, recordedAt: -1, createdAt: -1 });
  const result = await collection.insertOne(doc);
  return {
    ...doc,
    _id: result.insertedId.toString(),
  };
}

export async function getWeightEntries(
  userId: string,
  limit = 500
): Promise<Array<WeightEntry & { _id: string }>> {
  const cached = weightCache.get<Array<WeightEntry & { _id: string }>>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const safeLimit = Math.max(1, Math.min(2000, Math.floor(limit)));
  const docs = await database
    .collection<WeightEntryDoc>("user_weight_entries")
    .find({ userId })
    .sort({ recordedAt: -1, createdAt: -1 })
    .limit(safeLimit)
    .toArray();
  const result = docs.map((d) => ({
    ...d,
    _id: d._id.toString(),
  }));
  weightCache.set(userId, result, TTL_3M);
  return result;
}

export async function addFocusEntry(
  userId: string,
  input: {
    tag: string;
    minutes: number;
    startedAt: Date;
    endedAt: Date;
    entryDay: number;
    entryMonth: number;
    entryYear: number;
  }
): Promise<FocusEntry & { _id: string }> {
  focusCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const doc: Omit<FocusEntryDoc, "_id"> = {
    userId,
    tag: input.tag,
    minutes: input.minutes,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    entryDay: input.entryDay,
    entryMonth: input.entryMonth,
    entryYear: input.entryYear,
    createdAt: now,
    updatedAt: now,
  };
  const collection = database.collection<FocusEntryDoc>("user_focus_entries");
  await collection.createIndex({ userId: 1, entryYear: -1, entryMonth: -1, entryDay: -1, endedAt: -1 });
  const result = await collection.insertOne(doc);
  return {
    ...doc,
    _id: result.insertedId.toString(),
  };
}

export async function getFocusEntries(
  userId: string,
  options?: {
    day?: number;
    month?: number;
    year?: number;
    limit?: number;
  }
): Promise<Array<FocusEntry & { _id: string }>> {
  const cached = focusCache.get<Array<FocusEntry & { _id: string }>>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const safeLimit = Math.max(1, Math.min(2000, Math.floor(options?.limit ?? 500)));
  const filter: {
    userId: string;
    entryDay?: number;
    entryMonth?: number;
    entryYear?: number;
  } = { userId };
  if (typeof options?.day === "number") filter.entryDay = options.day;
  if (typeof options?.month === "number") filter.entryMonth = options.month;
  if (typeof options?.year === "number") filter.entryYear = options.year;
  const docs = await database
    .collection<FocusEntryDoc>("user_focus_entries")
    .find(filter)
    .sort({ endedAt: -1, createdAt: -1 })
    .limit(safeLimit)
    .toArray();
  const result = docs.map((d) => ({
    ...d,
    _id: d._id.toString(),
  }));
  focusCache.set(userId, result, TTL_2M);
  return result;
}

export async function deleteFocusEntry(id: string, userId: string): Promise<boolean> {
  focusCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<FocusEntryDoc>("user_focus_entries")
    .deleteOne({ _id: oid, userId });
  return result.deletedCount > 0;
}

export async function addSleepEntry(
  userId: string,
  input: {
    sleepHours: number;
    hrvMs: number | null;
    sleepScore: number | null;
    entryDay: number;
    entryMonth: number;
    entryYear: number;
  }
): Promise<SleepEntry & { _id: string }> {
  sleepCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const doc: Omit<SleepEntryDoc, "_id"> = {
    userId,
    sleepHours: input.sleepHours,
    hrvMs: input.hrvMs,
    sleepScore: input.sleepScore,
    entryDay: input.entryDay,
    entryMonth: input.entryMonth,
    entryYear: input.entryYear,
    createdAt: now,
    updatedAt: now,
  };
  const collection = database.collection<SleepEntryDoc>("user_sleep_entries");
  await collection.createIndex({ userId: 1, entryYear: -1, entryMonth: -1, entryDay: -1 });
  const result = await collection.insertOne(doc);
  return {
    ...doc,
    _id: result.insertedId.toString(),
  };
}

export async function getSleepEntries(
  userId: string,
  options?: { limit?: number }
): Promise<Array<SleepEntry & { _id: string }>> {
  const cached = sleepCache.get<Array<SleepEntry & { _id: string }>>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const safeLimit = Math.max(1, Math.min(200, Math.floor(options?.limit ?? 30)));
  const docs = await database
    .collection<SleepEntryDoc>("user_sleep_entries")
    .find({ userId })
    .sort({ entryYear: -1, entryMonth: -1, entryDay: -1 })
    .limit(safeLimit)
    .toArray();
  const result = docs.map((d) => ({
    ...d,
    _id: d._id.toString(),
  }));
  sleepCache.set(userId, result, TTL_3M);
  return result;
}

export async function updateSleepEntry(
  id: string,
  userId: string,
  updates: { sleepScore?: number | null; hrvMs?: number | null; sleepHours?: number },
): Promise<boolean> {
  sleepCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.sleepScore !== undefined) $set.sleepScore = updates.sleepScore;
  if (updates.hrvMs !== undefined) $set.hrvMs = updates.hrvMs;
  if (updates.sleepHours !== undefined) $set.sleepHours = updates.sleepHours;
  const result = await database
    .collection<SleepEntryDoc>("user_sleep_entries")
    .updateOne({ _id: oid, userId }, { $set });
  return result.modifiedCount > 0;
}

export async function deleteSleepEntry(id: string, userId: string): Promise<boolean> {
  sleepCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await database
    .collection<SleepEntryDoc>("user_sleep_entries")
    .deleteOne({ _id: oid, userId });
  return result.deletedCount > 0;
}

export async function addConceptReview(
  userId: string,
  conceptId: string
): Promise<ConceptReview & { _id: string }> {
  const database = await getDb();
  const now = new Date();
  const doc: Omit<ConceptReviewDoc, "_id"> = {
    userId,
    conceptId,
    reviewedAt: now,
  };
  const collection = database.collection<ConceptReviewDoc>("user_concept_reviews");
  await collection.createIndex({ userId: 1, reviewedAt: -1 });
  const result = await collection.insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() };
}

export async function getConceptReviews(
  userId: string,
  options?: { limit?: number; sinceDaysAgo?: number }
): Promise<Array<ConceptReview & { _id: string }>> {
  const database = await getDb();
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(options?.limit ?? 500)));
  const filter: Record<string, unknown> = { userId };
  if (options?.sinceDaysAgo != null && options.sinceDaysAgo > 0) {
    const since = new Date();
    since.setDate(since.getDate() - options.sinceDaysAgo);
    filter.reviewedAt = { $gte: since };
  }
  const docs = await database
    .collection<ConceptReviewDoc>("user_concept_reviews")
    .find(filter)
    .sort({ reviewedAt: -1 })
    .limit(safeLimit)
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id.toString() }));
}

function parseDayKeyParts(dayKey: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export async function getDailyLifeReport(
  userId: string,
  dayKey: string
): Promise<(DailyLifeReportSnapshot & { _id: string }) | null> {
  const parts = parseDayKeyParts(dayKey);
  if (!parts) return null;
  const database = await getDb();
  const doc = await database
    .collection<DailyLifeReportSnapshotDoc>("user_daily_life_reports")
    .findOne({ userId, dayKey });
  if (!doc?._id) return null;
  return {
    ...doc,
    _id: doc._id.toString(),
  };
}

export async function upsertDailyLifeReport(
  userId: string,
  input: {
    dayKey: string;
    dayLabel: string;
    mentorFigureId?: string;
    mentorFigureName?: string;
    report: DailyLifeReportSnapshot["report"];
    snapshot: DailyLifeReportSnapshot["snapshot"];
    generatedAt?: Date;
  }
): Promise<DailyLifeReportSnapshot & { _id: string }> {
  const parts = parseDayKeyParts(input.dayKey);
  if (!parts) {
    throw new Error("Invalid dayKey");
  }
  const database = await getDb();
  const collection = database.collection<DailyLifeReportSnapshotDoc>("user_daily_life_reports");
  await collection.createIndex({ userId: 1, dayKey: 1 }, { unique: true });
  await collection.createIndex({ userId: 1, entryYear: -1, entryMonth: -1, entryDay: -1, updatedAt: -1 });
  const now = new Date();
  const generatedAt = input.generatedAt ?? now;
  const result = await collection.findOneAndUpdate(
    { userId, dayKey: input.dayKey },
    {
      $set: {
        userId,
        dayKey: input.dayKey,
        entryYear: parts.year,
        entryMonth: parts.month,
        entryDay: parts.day,
        dayLabel: input.dayLabel,
        mentorFigureId: input.mentorFigureId ?? "",
        mentorFigureName: input.mentorFigureName ?? "",
        report: input.report,
        snapshot: input.snapshot,
        generatedAt,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  if (!result?._id) {
    throw new Error("Failed to save daily life report");
  }
  return {
    ...result,
    _id: result._id.toString(),
  };
}

export async function deleteSavedTranscript(id: string, userId: string): Promise<boolean> {
  transcriptsCache.invalidate(userId);
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
  transcriptsCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const enc = encryptTranscriptFields({ extractedConcepts: groups }) as {
    extractedConcepts?: typeof groups;
  };
  const result = await database
    .collection<SavedTranscriptDoc>("transcripts")
    .updateOne(
      { _id: oid, userId },
      { $set: { ...enc, updatedAt: new Date() } }
    );
  return result.modifiedCount > 0;
}

export async function updateJournalMentorReflections(
  id: string,
  userId: string,
  payload: {
    status: JournalMentorReflectionsStatus;
    reflections?: JournalMentorReflectionItem[];
  }
): Promise<boolean> {
  transcriptsCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const now = new Date();
  const $set: Record<string, unknown> = {
    journalMentorReflectionsStatus: payload.status,
    journalMentorReflectionsUpdatedAt: now,
    updatedAt: now,
  };
  if (payload.status === "ready" && payload.reflections !== undefined) {
    $set.journalMentorReflections = payload.reflections;
  }
  if (payload.status === "failed") {
    $set.journalMentorReflections = [];
  }
  const result = await database.collection<SavedTranscriptDoc>("transcripts").updateOne(
    { _id: oid, userId, sourceType: "journal" },
    { $set }
  );
  return result.modifiedCount > 0;
}

export async function updateSavedTranscriptText(
  id: string,
  userId: string,
  transcriptText: string
): Promise<(SavedTranscript & { _id: string }) | null> {
  transcriptsCache.invalidate(userId);
  const database = await getDb();
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const enc = encryptTranscriptFields({ transcriptText }) as { transcriptText?: string };
  const result = await database.collection<SavedTranscriptDoc>("transcripts").findOneAndUpdate(
    { _id: oid, userId },
    { $set: { ...enc, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return decryptTranscriptFields({
    ...result,
    _id: result._id.toString(),
  } as SavedTranscript & { _id: string });
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const cached = settingsCache.get<UserSettings | null>(userId);
  if (cached !== undefined) return cached;
  const database = await getDb();
  const doc = await database
    .collection<UserSettingsDoc>("user_settings")
    .findOne({ userId });
  if (!doc) { settingsCache.set(userId, null, TTL_5M); return null; }
  const nutritionFatLossMethods: NutritionFatLossMethod[] = Array.isArray(doc.nutritionFatLossMethods)
    ? doc.nutritionFatLossMethods
        .filter(
          (m): m is NutritionFatLossMethod =>
            m === "calorie_counting" || m === "intermittent_fasting" || m === "diet_based"
        )
        .slice(0, 3)
    : [];
  const nutritionFatLossMethod: NutritionFatLossMethod = nutritionFatLossMethods[0]
    ? nutritionFatLossMethods[0]
    : doc.nutritionFatLossMethod === "intermittent_fasting" ||
        doc.nutritionFatLossMethod === "diet_based"
      ? doc.nutritionFatLossMethod
      : "calorie_counting";
  const nutritionMethodConfig =
    doc.nutritionMethodConfig && typeof doc.nutritionMethodConfig === "object"
      ? (doc.nutritionMethodConfig as NutritionMethodConfig)
      : undefined;
  const settings = decryptUserSettingsFields<UserSettings>({
    userId: doc.userId,
    theme: doc.theme,
    language: doc.language,
    userType: doc.userType,
    ttsSpeed: doc.ttsSpeed,
    clonedVoiceId: doc.clonedVoiceId,
    clonedVoiceName: doc.clonedVoiceName,
    clonedVoices: doc.clonedVoices,
    background: doc.background,
    goalCaloriesTarget: doc.goalCaloriesTarget,
    goalCarbsGrams: doc.goalCarbsGrams,
    goalProteinGrams: doc.goalProteinGrams,
    goalFatGrams: doc.goalFatGrams,
    nutritionFatLossMethod,
    nutritionFatLossMethods:
      nutritionFatLossMethods.length > 0 ? nutritionFatLossMethods : [nutritionFatLossMethod],
    nutritionMethodConfig,
    nutritionGoalIntent: doc.nutritionGoalIntent,
    followedFigureIds: doc.followedFigureIds,
    leaderboardOptIn: doc.leaderboardOptIn,
    preferredName: doc.preferredName,
    reminderPreferences: doc.reminderPreferences as UserSettings["reminderPreferences"],
    updatedAt: doc.updatedAt,
  });
  settingsCache.set(userId, settings, TTL_5M);
  return settings;
}

export async function upsertUserSettings(
  userId: string,
  updates: Partial<Pick<UserSettings, "theme" | "language" | "userType" | "ttsSpeed" | "clonedVoiceId" | "clonedVoiceName" | "clonedVoices" | "background" | "goalCaloriesTarget" | "goalCarbsGrams" | "goalProteinGrams" | "goalFatGrams" | "nutritionFatLossMethod" | "nutritionFatLossMethods" | "nutritionMethodConfig" | "nutritionGoalIntent" | "followedFigureIds" | "leaderboardOptIn" | "preferredName" | "reminderPreferences">>
): Promise<UserSettings> {
  settingsCache.invalidate(userId);
  const database = await getDb();
  const now = new Date();
  const enc = encryptUserSettingsFields<Record<string, unknown>>(updates as object);
  const result = await database.collection<UserSettingsDoc>("user_settings").findOneAndUpdate(
    { userId },
    { $set: { userId, ...enc, updatedAt: now } },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) {
    return decryptUserSettingsFields({ userId, ...updates, updatedAt: now });
  }
  const nutritionFatLossMethods: NutritionFatLossMethod[] = Array.isArray(result.nutritionFatLossMethods)
    ? result.nutritionFatLossMethods
        .filter(
          (m): m is NutritionFatLossMethod =>
            m === "calorie_counting" || m === "intermittent_fasting" || m === "diet_based"
        )
        .slice(0, 3)
    : [];
  const nutritionFatLossMethod: NutritionFatLossMethod = nutritionFatLossMethods[0]
    ? nutritionFatLossMethods[0]
    : result.nutritionFatLossMethod === "intermittent_fasting" ||
        result.nutritionFatLossMethod === "diet_based"
      ? result.nutritionFatLossMethod
      : "calorie_counting";
  const nutritionMethodConfig =
    result.nutritionMethodConfig && typeof result.nutritionMethodConfig === "object"
      ? (result.nutritionMethodConfig as NutritionMethodConfig)
      : undefined;
  return decryptUserSettingsFields({
    userId: result.userId,
    theme: result.theme,
    language: result.language,
    userType: result.userType,
    ttsSpeed: result.ttsSpeed,
    clonedVoiceId: result.clonedVoiceId,
    clonedVoiceName: result.clonedVoiceName,
    clonedVoices: result.clonedVoices,
    background: result.background,
    goalCaloriesTarget: result.goalCaloriesTarget,
    goalCarbsGrams: result.goalCarbsGrams,
    goalProteinGrams: result.goalProteinGrams,
    goalFatGrams: result.goalFatGrams,
    nutritionFatLossMethod,
    nutritionFatLossMethods:
      nutritionFatLossMethods.length > 0 ? nutritionFatLossMethods : [nutritionFatLossMethod],
    nutritionMethodConfig,
    nutritionGoalIntent: result.nutritionGoalIntent,
    followedFigureIds: result.followedFigureIds,
    leaderboardOptIn: result.leaderboardOptIn,
    preferredName: result.preferredName,
    reminderPreferences: result.reminderPreferences as UserSettings["reminderPreferences"],
    updatedAt: result.updatedAt,
  });
}

export async function listKnownUserIds(): Promise<string[]> {
  const database = await getDb();
  const [settingsIds, transcriptIds] = await Promise.all([
    database.collection<UserSettingsDoc>("user_settings").distinct("userId", {}),
    database.collection<SavedTranscriptDoc>("transcripts").distinct("userId", { sourceType: "journal" }),
  ]);
  const userIds = new Set<string>();
  for (const id of settingsIds) {
    if (typeof id === "string" && id.trim()) userIds.add(id);
  }
  for (const id of transcriptIds) {
    if (typeof id === "string" && id.trim()) userIds.add(id);
  }
  return Array.from(userIds);
}

export async function claimWeeklyReflectionSend(
  userId: string,
  weekKey: string
): Promise<boolean> {
  const database = await getDb();
  await database
    .collection("weekly_reflection_sends")
    .createIndex({ userId: 1, weekKey: 1 }, { unique: true });
  const now = new Date();
  const result = await database.collection("weekly_reflection_sends").updateOne(
    { userId, weekKey },
    {
      $setOnInsert: {
        userId,
        weekKey,
        createdAt: now,
      },
      $set: {
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  return result.upsertedCount > 0;
}

export async function markWeeklyReflectionSendStatus(
  userId: string,
  weekKey: string,
  status: "sent" | "failed",
  details?: { error?: string; emailId?: string }
): Promise<void> {
  const database = await getDb();
  await database.collection("weekly_reflection_sends").updateOne(
    { userId, weekKey },
    {
      $set: {
        status,
        error: details?.error?.slice(0, 500),
        emailId: details?.emailId,
        updatedAt: new Date(),
      },
    }
  );
}

/** Delete all user data stored in app DB collections for this user. */
export async function deleteAllUserData(userId: string): Promise<void> {
  settingsCache.invalidate(userId);
  sessionsCache.invalidate(userId);
  habitsCache.invalidate(userId);
  completionsCache.invalidatePrefix(userId);
  sleepCache.invalidate(userId);
  weightCache.invalidate(userId);
  focusCache.invalidate(userId);
  transcriptsCache.invalidate(userId);
  mentalModelsCache.invalidate(userId);
  savedConceptsCache.invalidate(userId);
  customConceptsCache.invalidate(userId);
  perspectiveCardsCache.invalidate(userId);
  conceptGroupsCache.invalidate(userId);
  memoriesCache.invalidate(userId);
  reusableItemsCache.invalidatePrefix(userId);
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
  await database.collection<UserMentalModelDoc>("user_mental_models").deleteMany({ userId });
  await database.collection<UserSettingsDoc>("user_settings").deleteMany({ userId });
  await database.collection<SavedPerspectiveCardDoc>("saved_perspective_cards").deleteMany({ userId });
  await database.collection<HabitDoc>("habits").deleteMany({ userId });
  await database.collection<SavedNutritionExerciseItemDoc>("user_reusable_journal_items").deleteMany({ userId });
  await database.collection<ReusableJournalTagDoc>("user_reusable_journal_tags").deleteMany({ userId });
  await database.collection<WeightEntryDoc>("user_weight_entries").deleteMany({ userId });
  await database.collection<FocusEntryDoc>("user_focus_entries").deleteMany({ userId });
  await database.collection<SleepEntryDoc>("user_sleep_entries").deleteMany({ userId });
  await database.collection<ConceptReviewDoc>("user_concept_reviews").deleteMany({ userId });
  await database.collection<DailyLifeReportSnapshotDoc>("user_daily_life_reports").deleteMany({ userId });
  await database.collection<ReusableNutritionEntryUsageDoc>("user_reusable_nutrition_entry_usage").deleteMany({ userId });
  await database.collection("user_progress").deleteMany({ userId });
  await database.collection("weekly_reflection_sends").deleteMany({ userId });
  await database.collection<UsageEventDoc>("usage_events").deleteMany({ userId });
}
