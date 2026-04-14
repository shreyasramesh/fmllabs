import type { FamousFigure } from "@/lib/famous-figures";
import { getFigureById } from "@/lib/famous-figures";
import { getCustomMentorById, getCustomMentorsByIds, type CustomMentorRecord } from "@/lib/db";

function customRecordToFamousFigure(r: CustomMentorRecord): FamousFigure {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
  };
}

/**
 * Resolves a mentor id to a FamousFigure: built-in YAML first, then the user's custom mentors.
 */
export async function resolveMentorFigure(
  userId: string | null | undefined,
  figureId: string
): Promise<FamousFigure | null> {
  const id = figureId?.trim();
  if (!id) return null;
  const yaml = getFigureById(id);
  if (yaml) return yaml;
  if (!userId) return null;
  const custom = await getCustomMentorById(userId, id);
  return custom ? customRecordToFamousFigure(custom) : null;
}

/**
 * Resolves figure ids in order (deduped first occurrence). Skips ids that cannot be resolved.
 */
export async function resolveMentorFiguresPreservingOrder(
  userId: string | null | undefined,
  figureIds: string[]
): Promise<FamousFigure[]> {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const raw of figureIds) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  if (order.length === 0) return [];
  const byId = new Map<string, FamousFigure>();
  const needCustom: string[] = [];
  for (const id of order) {
    const y = getFigureById(id);
    if (y) byId.set(id, y);
    else needCustom.push(id);
  }
  if (userId && needCustom.length > 0) {
    const customs = await getCustomMentorsByIds(userId, needCustom);
    for (const c of customs) {
      byId.set(c.id, customRecordToFamousFigure(c));
    }
  }
  return order.map((id) => byId.get(id)).filter((f): f is FamousFigure => f != null);
}
