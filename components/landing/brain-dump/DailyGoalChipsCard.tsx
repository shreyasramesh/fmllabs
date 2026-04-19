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
    <div className="rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] p-4 space-y-3.5 shadow-sm animate-fade-in-up dark:border-[#4d4c48] dark:bg-[#1e1d1b]">
      <div>
        <p className="text-[15px] font-semibold text-[#30302e] dark:text-[#f5f4ed]">Today&apos;s plan</p>
        <p className="text-[11px] text-[#87867f] dark:text-[#b0aea5] mt-0.5">Set your intention for the day</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#c96442]/30 bg-[#c96442]/8 px-3 py-1.5 text-xs font-medium text-[#b05530] transition-colors hover:bg-[#c96442]/15 dark:border-[#d97757]/25 dark:bg-[#d97757]/10 dark:text-[#d97757] dark:hover:bg-[#d97757]/20"
          onClick={() => {
            const next = prompt("Calorie target for today:", String(calories));
            if (next) {
              const parsed = parseInt(next, 10);
              if (Number.isFinite(parsed) && parsed >= 800 && parsed <= 6000) setCalories(parsed);
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z" />
          </svg>
          {calories} kcal
        </button>

        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            exercisePlan
              ? "border-[#c96442]/30 bg-[#c96442]/8 text-[#b05530] hover:bg-[#c96442]/15 dark:border-[#d97757]/25 dark:bg-[#d97757]/10 dark:text-[#d97757] dark:hover:bg-[#d97757]/20"
              : "border-[#d1cfc5] text-[#87867f] hover:bg-[#f5f4ed] dark:border-[#4d4c48] dark:text-[#b0aea5] dark:hover:bg-[#30302e]"
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
            <path fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.277-.23.59-.42.926-.564a.93.93 0 0 1 1.168.286c.33.478.898.766 1.512.766s1.182-.288 1.512-.766a.93.93 0 0 1 1.168-.286c.335.144.65.334.926.564ZM10 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
          </svg>
          {exercisePlan || "No exercise"}
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-[#87867f] dark:text-[#b0aea5] font-medium">Focus areas</p>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleFocus(opt.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] border transition-colors ${
                selectedFocus.includes(opt.id)
                  ? "border-[#c96442]/40 bg-[#c96442]/10 text-[#b05530] font-medium dark:border-[#d97757]/30 dark:bg-[#d97757]/12 dark:text-[#d97757]"
                  : "border-[#d1cfc5] text-[#87867f] dark:border-[#4d4c48] dark:text-[#b0aea5]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[#b0aea5] hover:text-[#5e5d59] dark:text-[#87867f] dark:hover:text-[#d1cfc5] transition-colors"
        >
          Skip for today
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-xl bg-[#c96442] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#b05530] transition-colors shadow-sm"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
});
