import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  calculateNutritionGoalsFromProfile,
  recalculateNutritionGoalsFromPercentages,
} from "@/lib/gemini";
import { recordMongoUsageRequest } from "@/lib/usage";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const GOAL_CALORIES_MIN = 800;
const GOAL_CALORIES_MAX = 6000;
const GOAL_PERCENT_MIN = 5;
const GOAL_PERCENT_MAX = 85;
const GOAL_MACRO_MIN = 10;
const GOAL_MACRO_MAX = 1000;

type GoalDirection = "lose_weight" | "maintain_weight" | "gain_weight";
type GoalPace = "extreme" | "moderate" | "mild";
type GoalGender = "male" | "female";
type NutritionFatLossMethod = "calorie_counting" | "intermittent_fasting" | "diet_based";
type NutritionDietTemplate = "balanced" | "low_carb" | "high_protein" | "low_fat";
type NutritionMethodConfig = {
  intermittentFastingEatingWindowHours?: number;
  dietBasedTemplate?: NutritionDietTemplate;
};

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

function normalizeFatLossMethods(
  singleValue: unknown,
  multiValue: unknown
): { selectedMethods: NutritionFatLossMethod[]; primaryMethod: NutritionFatLossMethod } {
  const fromMulti = Array.isArray(multiValue)
    ? multiValue
        .filter(
          (m): m is NutritionFatLossMethod =>
            m === "calorie_counting" || m === "intermittent_fasting" || m === "diet_based"
        )
        .slice(0, 3)
    : [];
  if (fromMulti.length > 0) {
    return { selectedMethods: fromMulti, primaryMethod: fromMulti[0] };
  }
  const primaryMethod: NutritionFatLossMethod =
    singleValue === "intermittent_fasting" || singleValue === "diet_based"
      ? singleValue
      : "calorie_counting";
  return { selectedMethods: [primaryMethod], primaryMethod };
}

function normalizeMethodConfig(
  methods: NutritionFatLossMethod[],
  value: unknown
): NutritionMethodConfig {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const config: NutritionMethodConfig = {};
  if (methods.includes("intermittent_fasting")) {
    const parsedHours = parseNumberish(raw.intermittentFastingEatingWindowHours);
    config.intermittentFastingEatingWindowHours =
      parsedHours === null
        ? 8
        : Math.max(4, Math.min(16, Math.round(parsedHours)));
  }
  if (methods.includes("diet_based")) {
    const template = raw.dietBasedTemplate;
    if (
      template === "balanced" ||
      template === "low_carb" ||
      template === "high_protein" ||
      template === "low_fat"
    ) {
      config.dietBasedTemplate = template;
    } else {
      config.dietBasedTemplate = "balanced";
    }
  }
  return config;
}

function getDietTemplatePercents(template: NutritionDietTemplate): { carbs: number; protein: number; fat: number } {
  if (template === "low_carb") return { carbs: 25, protein: 35, fat: 40 };
  if (template === "high_protein") return { carbs: 30, protein: 40, fat: 30 };
  if (template === "low_fat") return { carbs: 50, protein: 30, fat: 20 };
  return { carbs: 40, protein: 30, fat: 30 };
}

function blendPercents(
  base: { carbs: number; protein: number; fat: number },
  target: { carbs: number; protein: number; fat: number },
  targetWeight: number
): { carbs: number; protein: number; fat: number } {
  const w = Math.max(0, Math.min(1, targetWeight));
  return normalizeMacroPercents({
    carbs: Math.round(base.carbs * (1 - w) + target.carbs * w),
    protein: Math.round(base.protein * (1 - w) + target.protein * w),
    fat: Math.round(base.fat * (1 - w) + target.fat * w),
  });
}

function buildMethodRationale(
  method: NutritionFatLossMethod,
  config: NutritionMethodConfig
): string {
  if (method === "intermittent_fasting") {
    const hours = config.intermittentFastingEatingWindowHours ?? 8;
    return `Method: Intermittent fasting. Keep the calorie budget unchanged and aim for an eating window of about ${hours} hours.`;
  }
  if (method === "diet_based") {
    const template = config.dietBasedTemplate ?? "balanced";
    const label =
      template === "low_carb"
        ? "low carb"
        : template === "high_protein"
          ? "high protein"
          : template === "low_fat"
            ? "low fat"
            : "balanced";
    return `Method: Diet-based (${label}). Macro split is biased toward this template while keeping calories coherent.`;
  }
  return "Method: Calorie counting. Prioritize calorie budget consistency with practical macro distribution.";
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
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
      nutritionFatLossMethod?: unknown;
      nutritionFatLossMethods?: unknown;
      nutritionMethodConfig?: unknown;
    };
    const { selectedMethods: nutritionFatLossMethods, primaryMethod: nutritionFatLossMethod } =
      normalizeFatLossMethods(body.nutritionFatLossMethod, body.nutritionFatLossMethods);
    const nutritionMethodConfig = normalizeMethodConfig(
      nutritionFatLossMethods,
      body.nutritionMethodConfig
    );

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
      const methodAdjustedPercents =
        nutritionFatLossMethods.includes("diet_based")
          ? blendPercents(
              percents,
              getDietTemplatePercents(nutritionMethodConfig.dietBasedTemplate ?? "balanced"),
              0.45
            )
          : percents;
      const grams = {
        carbsGrams: clamp(
          gramsFromPercents(caloriesTarget, methodAdjustedPercents).carbsGrams ??
            llm.carbsGrams ??
            fallbackGrams.carbsGrams,
          GOAL_MACRO_MIN,
          GOAL_MACRO_MAX
        ),
        proteinGrams: clamp(
          gramsFromPercents(caloriesTarget, methodAdjustedPercents).proteinGrams ??
            llm.proteinGrams ??
            fallbackGrams.proteinGrams,
          GOAL_MACRO_MIN,
          GOAL_MACRO_MAX
        ),
        fatGrams: clamp(
          gramsFromPercents(caloriesTarget, methodAdjustedPercents).fatGrams ??
            llm.fatGrams ??
            fallbackGrams.fatGrams,
          GOAL_MACRO_MIN,
          GOAL_MACRO_MAX
        ),
      };
      const methodRationaleLines = nutritionFatLossMethods.map((m) =>
        buildMethodRationale(m, nutritionMethodConfig)
      );
      const methodRationale = methodRationaleLines.join(" ");

      return NextResponse.json({
        caloriesTarget,
        carbsPercent: methodAdjustedPercents.carbs,
        proteinPercent: methodAdjustedPercents.protein,
        fatPercent: methodAdjustedPercents.fat,
        carbsGrams: grams.carbsGrams,
        proteinGrams: grams.proteinGrams,
        fatGrams: grams.fatGrams,
        rationale: [llm.rationale, methodRationale].filter(Boolean).join(" "),
        nutritionFatLossMethods,
        nutritionFatLossMethod,
        nutritionMethodConfig,
        methodRationale,
        methodRationaleLines,
        primaryMethod: nutritionFatLossMethod,
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
      const methodAdjustedPercents =
        nutritionFatLossMethods.includes("diet_based")
          ? blendPercents(
              returnedPercents,
              getDietTemplatePercents(nutritionMethodConfig.dietBasedTemplate ?? "balanced"),
              0.4
            )
          : returnedPercents;
      const adjustedGrams = gramsFromPercents(normalizedCalories, methodAdjustedPercents);
      const methodRationaleLines = nutritionFatLossMethods.map((m) =>
        buildMethodRationale(m, nutritionMethodConfig)
      );
      const methodRationale = methodRationaleLines.join(" ");

      return NextResponse.json({
        caloriesTarget: normalizedCalories,
        carbsPercent: methodAdjustedPercents.carbs,
        proteinPercent: methodAdjustedPercents.protein,
        fatPercent: methodAdjustedPercents.fat,
        carbsGrams: clamp(adjustedGrams.carbsGrams ?? llm.carbsGrams ?? fallbackGrams.carbsGrams, GOAL_MACRO_MIN, GOAL_MACRO_MAX),
        proteinGrams: clamp(
          adjustedGrams.proteinGrams ?? llm.proteinGrams ?? fallbackGrams.proteinGrams,
          GOAL_MACRO_MIN,
          GOAL_MACRO_MAX
        ),
        fatGrams: clamp(adjustedGrams.fatGrams ?? llm.fatGrams ?? fallbackGrams.fatGrams, GOAL_MACRO_MIN, GOAL_MACRO_MAX),
        rationale: [llm.rationale, methodRationale].filter(Boolean).join(" "),
        nutritionFatLossMethods,
        nutritionFatLossMethod,
        nutritionMethodConfig,
        methodRationale,
        methodRationaleLines,
        primaryMethod: nutritionFatLossMethod,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Nutrition goals calculate error:", err);
    return NextResponse.json({ error: "Failed to calculate nutrition goals." }, { status: 500 });
  }
}
