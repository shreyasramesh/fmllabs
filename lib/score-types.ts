/** Client-safe types and constants for gamification. No db imports. */

export const RANK_TIERS = [
  { name: "Iron", minXp: 0 },
  { name: "Bronze", minXp: 100 },
  { name: "Silver", minXp: 250 },
  { name: "Gold", minXp: 500 },
  { name: "Platinum", minXp: 1000 },
  { name: "Diamond", minXp: 2000 },
  { name: "Master", minXp: 4000 },
] as const;

export type RankName = (typeof RANK_TIERS)[number]["name"];

export interface UserScore {
  totalXp: number;
  rank: RankName;
  rankIndex: number;
  xpInCurrentTier: number;
  xpToNextTier: number;
}

export function xpToRank(totalXp: number): {
  rank: RankName;
  rankIndex: number;
  xpInCurrentTier: number;
  xpToNextTier: number;
} {
  let rankIndex = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (totalXp >= RANK_TIERS[i].minXp) {
      rankIndex = i;
      break;
    }
  }
  const tier = RANK_TIERS[rankIndex];
  const xpInCurrentTier = totalXp - tier.minXp;
  const nextTier = RANK_TIERS[rankIndex + 1];
  const xpToNextTier = nextTier ? nextTier.minXp - totalXp : 0;
  return {
    rank: tier.name,
    rankIndex,
    xpInCurrentTier,
    xpToNextTier,
  };
}
