import { getDb } from "./db";
import { xpToRank, type UserScore } from "./score-types";

export { RANK_TIERS, type UserScore } from "./score-types";

const USER_PROGRESS_COLLECTION = "user_progress";

async function computeXpFromCounts(userId: string): Promise<number> {
  const database = await getDb();

  const [
    sessionsCount,
    customConceptsCount,
    savedConceptsCount,
    habitsCount,
    conceptGroupsCount,
    perspectiveCardSessionsCount,
    savedPerspectiveCardsCount,
    userMentalModelsCount,
    sessionsWithTags,
    userSettings,
  ] = await Promise.all([
    database.collection("sessions").countDocuments({ userId }),
    database.collection("custom_concepts").countDocuments({ userId }),
    database.collection("user_saved_concepts").countDocuments({ userId }),
    database.collection("habits").countDocuments({ userId }),
    database.collection("concept_groups").countDocuments({ userId }),
    database
      .collection("sessions")
      .countDocuments({ userId, perspectiveCardPrompt: { $exists: true, $ne: "" } }),
    database.collection("saved_perspective_cards").countDocuments({ userId }),
    database.collection("user_mental_models").countDocuments({ userId }),
    database
      .collection("sessions")
      .find({ userId, mentalModelTags: { $exists: true, $ne: [] } })
      .project({ mentalModelTags: 1 })
      .toArray(),
    database.collection("user_settings").findOne({ userId }),
  ]);

  const personasCount = (userSettings?.followedFigureIds as string[] | undefined)?.length ?? 0;
  const mentalModelTagsXp = sessionsWithTags.reduce(
    (sum, s) => sum + ((s.mentalModelTags as string[])?.length ?? 0) * 5,
    0
  );

  return (
    sessionsCount * 10 +
    customConceptsCount * 20 +
    savedConceptsCount * 20 +
    personasCount * 5 +
    habitsCount * 10 +
    conceptGroupsCount * 5 +
    perspectiveCardSessionsCount * 25 +
    mentalModelTagsXp +
    userMentalModelsCount * 25 +
    savedPerspectiveCardsCount * 10
  );
}

const MONTH_KEY = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export interface UserProgressDisplay {
  displayName?: string;
  imageUrl?: string;
}

/** Returns user score. XP is accumulated and never decreases when user deletes content. */
export async function getUserScore(
  userId: string,
  displayInfo?: UserProgressDisplay
): Promise<UserScore> {
  const database = await getDb();
  const computedXp = await computeXpFromCounts(userId);
  const now = new Date();
  const currentMonth = MONTH_KEY(now);

  const progress = await database
    .collection(USER_PROGRESS_COLLECTION)
    .findOne({ userId });
  const storedXp = (progress?.totalXp as number) ?? 0;
  const totalXp = Math.max(computedXp, storedXp);
  const storedMonth = progress?.currentMonth as string | undefined;
  const xpAtStartOfMonth = (progress?.xpAtStartOfMonth as number) ?? 0;

  const monthlyXp = storedMonth === currentMonth ? totalXp - xpAtStartOfMonth : totalXp;

  if (computedXp > storedXp || storedMonth !== currentMonth) {
    const isNewMonth = storedMonth !== currentMonth;
    const newXpAtStart = isNewMonth ? totalXp : xpAtStartOfMonth;
    const newMonthlyXp = totalXp - newXpAtStart;
    const update: Record<string, unknown> = {
      totalXp,
      updatedAt: now,
      currentMonth,
      xpAtStartOfMonth: newXpAtStart,
      monthlyXp: newMonthlyXp,
    };
    if (displayInfo?.displayName !== undefined) update.displayName = displayInfo.displayName;
    if (displayInfo?.imageUrl !== undefined) update.imageUrl = displayInfo.imageUrl;

    await database.collection(USER_PROGRESS_COLLECTION).updateOne(
      { userId },
      { $set: update },
      { upsert: true }
    );
  }

  const { rank, rankIndex, xpInCurrentTier, xpToNextTier } = xpToRank(totalXp);

  return {
    totalXp,
    rank,
    rankIndex,
    xpInCurrentTier,
    xpToNextTier,
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  imageUrl?: string;
  xp: number;
}

/** Fetch leaderboard: monthly (current month XP) and all-time (total XP). Only users with leaderboardOptIn. */
export async function getLeaderboard(): Promise<{
  monthly: LeaderboardEntry[];
  allTime: LeaderboardEntry[];
  currentMonth: string;
}> {
  const database = await getDb();
  const now = new Date();
  const currentMonth = MONTH_KEY(now);
  const monthName = now.toLocaleString("default", { month: "long" });

  const optedInDocs = await database
    .collection("user_settings")
    .find({ leaderboardOptIn: true })
    .project({ userId: 1 })
    .toArray();
  const userIds = optedInDocs
    .map((d) => (d as unknown as { userId?: string }).userId)
    .filter((id): id is string => typeof id === "string");
  if (userIds.length === 0) {
    return { monthly: [], allTime: [], currentMonth: monthName };
  }

  const progressDocs = await database
    .collection(USER_PROGRESS_COLLECTION)
    .find({ userId: { $in: userIds } })
    .toArray();

  type ProgressDoc = {
    userId: string;
    totalXp: number;
    monthlyXp?: number;
    xpAtStartOfMonth?: number;
    currentMonth?: string;
    displayName?: string;
    imageUrl?: string;
  };
  const byUserId = new Map<string, ProgressDoc>(
    progressDocs.map((d) => {
      const doc = d as unknown as ProgressDoc;
      return [doc.userId, doc];
    })
  );

  const allTime = userIds
    .map((userId) => {
      const p = byUserId.get(userId);
      const totalXp = p?.totalXp ?? 0;
      const displayName = p?.displayName ?? "Anonymous";
      const imageUrl = p?.imageUrl;
      return { userId, totalXp, displayName, imageUrl };
    })
    .filter((e) => e.totalXp > 0)
    .sort((a, b) => b.totalXp - a.totalXp)
    .slice(0, 25)
    .map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      displayName: e.displayName,
      imageUrl: e.imageUrl,
      xp: e.totalXp,
    }));

  const monthly = userIds
    .map((userId) => {
      const p = byUserId.get(userId);
      const monthlyXp =
        p?.currentMonth === currentMonth
          ? (p?.totalXp ?? 0) - (p?.xpAtStartOfMonth ?? 0)
          : 0;
      const displayName = p?.displayName ?? "Anonymous";
      const imageUrl = p?.imageUrl;
      return { userId, monthlyXp, displayName, imageUrl };
    })
    .filter((e) => e.monthlyXp > 0)
    .sort((a, b) => b.monthlyXp - a.monthlyXp)
    .slice(0, 25)
    .map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      displayName: e.displayName,
      imageUrl: e.imageUrl,
      xp: e.monthlyXp,
    }));

  return { monthly, allTime, currentMonth: monthName };
}
