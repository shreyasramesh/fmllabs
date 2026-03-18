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

/** Returns user score. XP is accumulated and never decreases when user deletes content. */
export async function getUserScore(userId: string): Promise<UserScore> {
  const database = await getDb();
  const computedXp = await computeXpFromCounts(userId);

  const progress = await database
    .collection(USER_PROGRESS_COLLECTION)
    .findOne({ userId });
  const storedXp = (progress?.totalXp as number) ?? 0;
  const totalXp = Math.max(computedXp, storedXp);

  if (computedXp > storedXp) {
    await database.collection(USER_PROGRESS_COLLECTION).updateOne(
      { userId },
      { $set: { totalXp: computedXp, updatedAt: new Date() } },
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
