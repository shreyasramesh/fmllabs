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
    <div className="rounded-2xl border border-[#e8e6dc] bg-gradient-to-b from-[#faf9f5] to-[#f5f4ed] p-4 space-y-3.5 shadow-sm animate-fade-in-up dark:border-[#4d4c48] dark:from-[#1e1d1b] dark:to-[#1a1918]">
      <p className="text-sm font-semibold text-[#30302e] dark:text-[#e8e6dc]">Today&apos;s plan</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#c96442]/30 bg-[#c96442]/10 px-3 py-1.5 text-xs font-semibold text-[#b05530] transition-colors hover:bg-[#c96442]/18 dark:border-[#d97757]/25 dark:bg-[#d97757]/12 dark:text-[#d97757] dark:hover:bg-[#d97757]/20"
          onClick={() => {
            const next = prompt("Calorie target for today:", String(calories));
            if (next) {
              const parsed = parseInt(next, 10);
              if (Number.isFinite(parsed) && parsed >= 800 && parsed <= 6000) setCalories(parsed);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0L4.45 7.89a1 1 0 0 1-.683.748l-2.122.636a1 1 0 0 0 0 1.898l2.122.636a1 1 0 0 1 .683.748l.601 2.205a1 1 0 0 0 1.898 0l.601-2.205a1 1 0 0 1 .683-.748l2.122-.636a1 1 0 0 0 0-1.898l-2.122-.636a1 1 0 0 1-.683-.748L6.95 5.684Z" />
          </svg>
          {calories} kcal
        </button>

        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            exercisePlan
              ? "border-[#c96442]/25 bg-[#c96442]/8 text-[#b05530] hover:bg-[#c96442]/15 dark:border-[#d97757]/20 dark:bg-[#d97757]/8 dark:text-[#d97757] dark:hover:bg-[#d97757]/15"
              : "border-[#d1cfc5] text-[#87867f] hover:bg-[#e8e6dc]/60 dark:border-[#4d4c48] dark:text-[#87867f] dark:hover:bg-[#30302e]/60"
          }`}
          onClick={() => {
            if (exercisePlan) {
              setExercisePlan("");
            } else {
              setExercisePlan(`${defaultExerciseMinutes || 30} min exercise`);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
          </svg>
          {exercisePlan || "No exercise"}
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-[#87867f] dark:text-[#b0aea5] font-medium uppercase tracking-wide">Focus areas</p>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleFocus(opt.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] border transition-all duration-150 ${
                selectedFocus.includes(opt.id)
                  ? "border-[#c96442]/50 bg-[#c96442]/12 text-[#b05530] font-semibold dark:border-[#d97757]/35 dark:bg-[#d97757]/15 dark:text-[#d97757]"
                  : "border-[#d1cfc5] text-[#87867f] hover:border-[#c96442]/30 hover:text-[#b05530] dark:border-[#4d4c48] dark:text-[#87867f] dark:hover:border-[#d97757]/25 dark:hover:text-[#d97757]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-[#e8e6dc]/80 dark:border-[#30302e]">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[#b0aea5] hover:text-[#5e5d59] dark:text-[#5e5d59] dark:hover:text-[#b0aea5] transition-colors"
        >
          Skip for today
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-xl bg-[#c96442] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#b05530] active:scale-[0.97] transition-all duration-150 dark:bg-[#d97757] dark:hover:bg-[#c96442]"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
});
