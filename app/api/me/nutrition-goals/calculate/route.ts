import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  calculateNutritionGoalsFromProfile,
  recalculateNutritionGoalsFromPercentages,
} from "@/lib/gemini";
import { recordMongoUsageRequest } from "@/lib/usage";

const GOAL_CALORIES_MIN = 800;
const GOAL_CALORIES_MAX = 6000;
const GOAL_PERCENT_MIN = 5;
const GOAL_PERCENT_MAX = 85;
const GOAL_MACRO_MIN = 10;
const GOAL_MACRO_MAX = 1000;

type GoalDirection = "lose_weight" | "maintain_weight" | "gain_weight";
type GoalPace = "extreme" | "moderate" | "mild";
type GoalGender = "male" | "female";

function parseNumberish(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

function normalizeMacroPercents(input: { carbs: number; protein: number; fat: number }): {
  carbs: number;
  protein: number;
  fat: number;
} {
  const sum = input.carbs + input.protein + input.fat;
  if (!Number.isFinite(sum) || sum <= 0) return { carbs: 40, protein: 30, fat: 30 };
  const carbs = Math.round((input.carbs / sum) * 100);
  const protein = Math.round((input.protein / sum) * 100);
  const fat = Math.max(0, 100 - carbs - protein);
  return { carbs, protein, fat };
}

function gramsFromPercents(caloriesTarget: number, percents: { carbs: number; protein: number; fat: number }) {
  const carbsGrams = clamp((caloriesTarget * (percents.carbs / 100)) / 4, GOAL_MACRO_MIN, GOAL_MACRO_MAX);
  const proteinGrams = clamp(
    (caloriesTarget * (percents.protein / 100)) / 4,
    GOAL_MACRO_MIN,
    GOAL_MACRO_MAX
  );
  const fatGrams = clamp((caloriesTarget * (percents.fat / 100)) / 9, GOAL_MACRO_MIN, GOAL_MACRO_MAX);
  return { carbsGrams, proteinGrams, fatGrams };
}

function estimateFallbackCalories(input: {
  age: number;
  gender: GoalGender;
  heightCm: number;
  currentWeightKg: number;
  goal: GoalDirection;
  pace: GoalPace;
}): number {
  const bmr =
    input.gender === "male"
      ? 10 * input.currentWeightKg + 6.25 * input.heightCm - 5 * input.age + 5
      : 10 * input.currentWeightKg + 6.25 * input.heightCm - 5 * input.age - 161;
  const maintenance = bmr * 1.35;
  const adjustment =
    input.goal === "maintain_weight"
      ? 0
      : input.goal === "lose_weight"
        ? input.pace === "extreme"
          ? -800
          : input.pace === "moderate"
            ? -500
            : -250
        : input.pace === "extreme"
          ? 600
          : input.pace === "moderate"
            ? 350
            : 200;
  return clamp(maintenance + adjustment, GOAL_CALORIES_MIN, GOAL_CALORIES_MAX);
}

function isGoalDirection(v: unknown): v is GoalDirection {
  return v === "lose_weight" || v === "maintain_weight" || v === "gain_weight";
}

function isGoalPace(v: unknown): v is GoalPace {
  return v === "extreme" || v === "moderate" || v === "mild";
}

function isGoalGender(v: unknown): v is GoalGender {
  return v === "male" || v === "female";
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  recordMongoUsageRequest(userId).catch(() => {});

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      age?: unknown;
      gender?: unknown;
      heightCm?: unknown;
      currentWeightKg?: unknown;
      targetWeightKg?: unknown;
      goal?: unknown;
      pace?: unknown;
      caloriesTarget?: unknown;
      carbsPercent?: unknown;
      proteinPercent?: unknown;
      fatPercent?: unknown;
    };

    if (body.action === "finish") {
      const age = parseNumberish(body.age);
      const heightCm = parseNumberish(body.heightCm);
      const currentWeightKg = parseNumberish(body.currentWeightKg);
      const targetWeightKg = parseNumberish(body.targetWeightKg);
      if (
        age === null ||
        heightCm === null ||
        currentWeightKg === null ||
        targetWeightKg === null ||
        !isGoalGender(body.gender) ||
        !isGoalDirection(body.goal) ||
        !isGoalPace(body.pace)
      ) {
        return NextResponse.json({ error: "Invalid profile values." }, { status: 400 });
      }
      const normalizedInput = {
        age: clamp(age, 12, 100),
        gender: body.gender,
        heightCm: clamp(heightCm, 120, 230),
        currentWeightKg: Math.max(35, Math.min(280, Math.round(currentWeightKg * 10) / 10)),
        targetWeightKg: Math.max(35, Math.min(280, Math.round(targetWeightKg * 10) / 10)),
        goal: body.goal,
        pace: body.pace,
      } as const;

      const fallbackCalories = estimateFallbackCalories(normalizedInput);
      const fallbackPercents = normalizeMacroPercents({ carbs: 40, protein: 30, fat: 30 });
      const fallbackGrams = gramsFromPercents(fallbackCalories, fallbackPercents);

      const llm = await calculateNutritionGoalsFromProfile(normalizedInput, {
        userId,
        eventType: "nutrition_goals_finish",
      });
      const caloriesTarget = clamp(
        llm.caloriesTarget ?? fallbackCalories,
        GOAL_CALORIES_MIN,
        GOAL_CALORIES_MAX
      );
      const percents = normalizeMacroPercents({
        carbs: clamp(llm.carbsPercent ?? fallbackPercents.carbs, GOAL_PERCENT_MIN, GOAL_PERCENT_MAX),
        protein: clamp(
          llm.proteinPercent ?? fallbackPercents.protein,
          GOAL_PERCENT_MIN,
          GOAL_PERCENT_MAX
        ),
        fat: clamp(llm.fatPercent ?? fallbackPercents.fat, GOAL_PERCENT_MIN, GOAL_PERCENT_MAX),
      });
      const grams = {
        carbsGrams: clamp(llm.carbsGrams ?? fallbackGrams.carbsGrams, GOAL_MACRO_MIN, GOAL_MACRO_MAX),
        proteinGrams: clamp(
          llm.proteinGrams ?? fallbackGrams.proteinGrams,
          GOAL_MACRO_MIN,
          GOAL_MACRO_MAX
        ),
        fatGrams: clamp(llm.fatGrams ?? fallbackGrams.fatGrams, GOAL_MACRO_MIN, GOAL_MACRO_MAX),
      };

      return NextResponse.json({
        caloriesTarget,
        carbsPercent: percents.carbs,
        proteinPercent: percents.protein,
        fatPercent: percents.fat,
        carbsGrams: grams.carbsGrams,
        proteinGrams: grams.proteinGrams,
        fatGrams: grams.fatGrams,
        rationale: llm.rationale ?? "",
      });
    }

    if (body.action === "recalculate") {
      const caloriesTarget = parseNumberish(body.caloriesTarget);
      const carbsPercent = parseNumberish(body.carbsPercent);
      const proteinPercent = parseNumberish(body.proteinPercent);
      const fatPercent = parseNumberish(body.fatPercent);
      if (
        caloriesTarget === null ||
        carbsPercent === null ||
        proteinPercent === null ||
        fatPercent === null
      ) {
        return NextResponse.json({ error: "Invalid macro percentage values." }, { status: 400 });
      }

      const normalizedCalories = clamp(caloriesTarget, GOAL_CALORIES_MIN, GOAL_CALORIES_MAX);
      const normalizedPercents = normalizeMacroPercents({
        carbs: clamp(carbsPercent, GOAL_PERCENT_MIN, GOAL_PERCENT_MAX),
        protein: clamp(proteinPercent, GOAL_PERCENT_MIN, GOAL_PERCENT_MAX),
        fat: clamp(fatPercent, GOAL_PERCENT_MIN, GOAL_PERCENT_MAX),
      });
      const fallbackGrams = gramsFromPercents(normalizedCalories, normalizedPercents);

      const llm = await recalculateNutritionGoalsFromPercentages(
        {
          caloriesTarget: normalizedCalories,
          carbsPercent: normalizedPercents.carbs,
          proteinPercent: normalizedPercents.protein,
          fatPercent: normalizedPercents.fat,
        },
        { userId, eventType: "nutrition_goals_recalculate" }
      );
      const returnedPercents = normalizeMacroPercents({
        carbs: clamp(llm.carbsPercent ?? normalizedPercents.carbs, GOAL_PERCENT_MIN, GOAL_PERCENT_MAX),
        protein: clamp(
          llm.proteinPercent ?? normalizedPercents.protein,
          GOAL_PERCENT_MIN,
          GOAL_PERCENT_MAX
        ),
        fat: clamp(llm.fatPercent ?? normalizedPercents.fat, GOAL_PERCENT_MIN, GOAL_PERCENT_MAX),
      });

      return NextResponse.json({
        caloriesTarget: normalizedCalories,
        carbsPercent: returnedPercents.carbs,
        proteinPercent: returnedPercents.protein,
        fatPercent: returnedPercents.fat,
        carbsGrams: clamp(llm.carbsGrams ?? fallbackGrams.carbsGrams, GOAL_MACRO_MIN, GOAL_MACRO_MAX),
        proteinGrams: clamp(
          llm.proteinGrams ?? fallbackGrams.proteinGrams,
          GOAL_MACRO_MIN,
          GOAL_MACRO_MAX
        ),
        fatGrams: clamp(llm.fatGrams ?? fallbackGrams.fatGrams, GOAL_MACRO_MIN, GOAL_MACRO_MAX),
        rationale: llm.rationale ?? "",
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Nutrition goals calculate error:", err);
    return NextResponse.json({ error: "Failed to calculate nutrition goals." }, { status: 500 });
  }
}
