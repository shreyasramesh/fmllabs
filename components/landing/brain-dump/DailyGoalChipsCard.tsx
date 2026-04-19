"use client";

import { memo, useCallback, useState } from "react";

interface DailyGoalChipsCardProps {
  defaultCalories: number;
  defaultExerciseMinutes: number;
  nutritionChallenges: string[];
  onConfirm: (data: { caloriesTarget: number; exercisePlan: string; focusAreas: string[] }) => void;
  onSkip: () => void;
}

const FOCUS_OPTIONS: { id: string; label: string }[] = [
  { id: "hit_protein", label: "Hit protein goal" },
  { id: "stay_under_budget", label: "Stay under budget" },
  { id: "eat_clean", label: "Eat whole foods" },
  { id: "drink_water", label: "Drink enough water" },
  { id: "no_snacking", label: "Avoid snacking" },
  { id: "eat_vegetables", label: "Eat veggies" },
];

export const DailyGoalChipsCard = memo(function DailyGoalChipsCard({
  defaultCalories,
  defaultExerciseMinutes,
  nutritionChallenges,
  onConfirm,
  onSkip,
}: DailyGoalChipsCardProps) {
  const [calories, setCalories] = useState(defaultCalories);
  const [exercisePlan, setExercisePlan] = useState(
    defaultExerciseMinutes > 0 ? `${defaultExerciseMinutes} min exercise` : "",
  );
  const [selectedFocus, setSelectedFocus] = useState<string[]>(() => {
    const initial: string[] = [];
    if (nutritionChallenges.includes("low_protein")) initial.push("hit_protein");
    if (nutritionChallenges.includes("overeating")) initial.push("stay_under_budget");
    if (nutritionChallenges.includes("low_vegetables")) initial.push("eat_vegetables");
    return initial.slice(0, 2);
  });

  const toggleFocus = useCallback((id: string) => {
    setSelectedFocus((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id].slice(0, 3),
    );
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm({ caloriesTarget: calories, exercisePlan, focusAreas: selectedFocus });
  }, [calories, exercisePlan, onConfirm, selectedFocus]);

  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 p-4 space-y-3 shadow-sm animate-fade-in-up">
      <p className="text-sm font-semibold text-foreground">Today&apos;s plan</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/70 px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40"
          onClick={() => {
            const next = prompt("Calorie target for today:", String(calories));
            if (next) {
              const parsed = parseInt(next, 10);
              if (Number.isFinite(parsed) && parsed >= 800 && parsed <= 6000) setCalories(parsed);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.75 7.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM5 10.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zm5.75-2.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM10 10.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zM8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" /><path fillRule="evenodd" d="M4.5 1A2.5 2.5 0 0 0 2 3.5v9A2.5 2.5 0 0 0 4.5 15h7a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 11.5 1h-7zM3.5 3.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-9z" clipRule="evenodd" /></svg>
          {calories} kcal
        </button>

        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            exercisePlan
              ? "border-emerald-200/80 bg-emerald-50/70 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
              : "border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
          onClick={() => {
            if (exercisePlan) {
              setExercisePlan("");
            } else {
              setExercisePlan(`${defaultExerciseMinutes || 30} min exercise`);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.75 2.5a.75.75 0 0 0-1.5 0v1.956a4.002 4.002 0 0 0-1.291 6.454l.584.584A.75.75 0 0 0 5.6 10.44l-.584-.584a2.5 2.5 0 0 1 .807-4.04A.75.75 0 0 0 6.75 5V2.5zm2.5 0a.75.75 0 0 1 1.5 0v1.956a4.002 4.002 0 0 1 1.291 6.454l-.584.584a.75.75 0 0 1-1.06-1.06l.584-.585a2.5 2.5 0 0 0-.807-4.04A.75.75 0 0 1 9.25 5V2.5z" /></svg>
          {exercisePlan || "No exercise"}
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">Focus areas</p>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleFocus(opt.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] border transition-colors ${
                selectedFocus.includes(opt.id)
                  ? "border-[#295a8a]/60 bg-[#295a8a]/10 text-[#295a8a] font-medium dark:border-blue-400/40 dark:bg-blue-900/25 dark:text-blue-300"
                  : "border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          Skip for today
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-xl bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
});
