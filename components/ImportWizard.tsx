"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  parseImportMarkdown,
  IMPORT_SECTION_META,
  type ImportPayload,
  type ImportSectionKey,
} from "@/lib/import-parser";

const IMPORT_PROMPT = `I need to convert my health and wellness data into a specific markdown format for import into an app. Please transform my data into the exact format below. Only include sections where I have data. Use metric units (kg for weight). Use 24-hour time format (HH:MM). Use ISO dates (YYYY-MM-DD). If a value is unknown, write \`unknown\`. Do not add extra columns or sections.

\`\`\`markdown
# FML Labs Data Import

## Nutrition
| Date | Time | Description | Calories (kcal) | Protein (g) | Carbs (g) | Fat (g) | Fiber (g) | Sugar (g) | Sodium (mg) | Caffeine (mg) | Tag | Notes |
|------|------|-------------|-----------------|-------------|-----------|---------|-----------|-----------|-------------|---------------|-----|-------|
| 2024-03-15 | 08:30 | Oatmeal with blueberries and honey | 350 | 12 | 58 | 8 | 4 | 12 | 150 | 0 | Breakfast | |

## Exercise
| Date | Time | Description | Duration (min) | Calories Burned (kcal) | Tag | Notes |
|------|------|-------------|----------------|----------------------|-----|-------|
| 2024-03-15 | 07:00 | 5K run at 6:00/km pace | 30 | 320 | Running | Easy run |

## Weight
| Date | Weight (kg) |
|------|-------------|
| 2024-03-15 | 78.2 |

## Sleep
| Date | Hours | HRV (ms) |
|------|-------|-----------|
| 2024-03-15 | 7.5 | 45 |

## Focus
| Date | Start Time | End Time | Duration (min) | Tag |
|------|------------|----------|----------------|-----|
| 2024-03-15 | 09:00 | 10:30 | 90 | Deep work |

## Habits
| Name | Description | Bucket |
|------|-------------|--------|
| Morning meditation | 10 minutes of mindfulness meditation each morning | wellbeing |

## Habit Completions
| Habit Name | Date |
|------------|------|
| Morning meditation | 2024-03-15 |

## Reflections
| Date | Time | Text |
|------|------|------|
| 2024-03-15 | 21:00 | Grateful for a productive day and good weather on my run |

## Goals
| Setting | Value |
|---------|-------|
| Daily Calories Target | 2000 |
| Daily Protein Target (g) | 150 |
| Daily Carbs Target (g) | 200 |
| Daily Fat Target (g) | 65 |
| Target Weight (kg) | 75.0 |

## Concepts
| Title | Summary |
|-------|---------|
| Zone 2 Training | Aerobic base-building at 60-70% max HR improves mitochondrial density and fat oxidation |
\`\`\`

Rules:
- Group meals/snacks as individual rows (one row per meal/snack, not one row per food item)
- If multiple food items were eaten together, combine them into a single description with totaled macros
- For exercise, each activity is its own row
- For weight, one row per day (use the first reading if multiple exist)
- For sleep, one row per night (the date is the morning you woke up)
- Habit Bucket must be one of: \`creative\`, \`intellectual\`, \`wellbeing\`, \`connection\`
- Habit Completions reference habits by exact name
- Omit any section entirely if there is no data for it`;

type WizardStep = 1 | 2 | 3 | 4;

interface SectionSelection {
  allSelected: boolean;
  rowSelected: boolean[];
}

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [markdownInput, setMarkdownInput] = useState("");
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [selections, setSelections] = useState<
    Record<ImportSectionKey, SectionSelection>
  >({} as Record<ImportSectionKey, SectionSelection>);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: Record<string, number>;
    errors: string[];
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(IMPORT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, []);

  const handleParse = useCallback(() => {
    setParseError(null);
    if (!markdownInput.trim()) {
      setParseError("Please paste the markdown output first.");
      return;
    }
    const result = parseImportMarkdown(markdownInput);
    setPayload(result);

    const sels: Record<string, SectionSelection> = {};
    for (const key of Object.keys(IMPORT_SECTION_META) as ImportSectionKey[]) {
      const rows = result[key] as { _valid: boolean }[];
      if (rows.length > 0) {
        const rowSelected = rows.map((r) => r._valid);
        sels[key] = {
          allSelected: rowSelected.every(Boolean),
          rowSelected,
        };
      }
    }
    setSelections(sels as Record<ImportSectionKey, SectionSelection>);
    setStep(3);
  }, [markdownInput]);

  const toggleSection = useCallback(
    (key: ImportSectionKey) => {
      setSelections((prev) => {
        const sec = prev[key];
        if (!sec) return prev;
        const newAll = !sec.allSelected;
        const rows = payload?.[key] as { _valid: boolean }[] | undefined;
        return {
          ...prev,
          [key]: {
            allSelected: newAll,
            rowSelected: sec.rowSelected.map((_, i) =>
              rows?.[i]?._valid ? newAll : false
            ),
          },
        };
      });
    },
    [payload]
  );

  const toggleRow = useCallback(
    (key: ImportSectionKey, idx: number) => {
      setSelections((prev) => {
        const sec = prev[key];
        if (!sec) return prev;
        const newRowSelected = [...sec.rowSelected];
        newRowSelected[idx] = !newRowSelected[idx];
        return {
          ...prev,
          [key]: {
            allSelected: newRowSelected.every(Boolean),
            rowSelected: newRowSelected,
          },
        };
      });
    },
    []
  );

  const totalSelected = useMemo(() => {
    let count = 0;
    for (const sec of Object.values(selections)) {
      count += sec.rowSelected.filter(Boolean).length;
    }
    return count;
  }, [selections]);

  const categoriesSelected = useMemo(() => {
    let count = 0;
    for (const sec of Object.values(selections)) {
      if (sec.rowSelected.some(Boolean)) count++;
    }
    return count;
  }, [selections]);

  const handleImport = useCallback(async () => {
    if (!payload) return;
    setImportLoading(true);
    setImportResult(null);

    const sections: Record<string, unknown[]> = {};
    for (const key of Object.keys(selections) as ImportSectionKey[]) {
      const sec = selections[key];
      if (!sec) continue;
      const rows = payload[key] as { _valid: boolean }[];
      const selected = rows.filter((_, i) => sec.rowSelected[i]);
      if (selected.length > 0) {
        sections[key] = selected;
      }
    }

    try {
      const res = await fetch("/api/me/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Import failed");
      setImportResult(data);
      setStep(4);
    } catch (err) {
      setImportResult({
        inserted: {},
        errors: [err instanceof Error ? err.message : "Import failed"],
      });
      setStep(4);
    } finally {
      setImportLoading(false);
    }
  }, [payload, selections]);

  const activeSections = useMemo(() => {
    if (!payload) return [];
    return (Object.keys(IMPORT_SECTION_META) as ImportSectionKey[]).filter(
      (key) => (payload[key] as unknown[]).length > 0
    );
  }, [payload]);

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        {[1, 2, 3, 4].map((s) => (
          <React.Fragment key={s}>
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold ${
                s === step
                  ? "bg-foreground text-background"
                  : s < step
                  ? "bg-green-500 text-white"
                  : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {s < step ? "✓" : s}
            </span>
            {s < 4 && (
              <div
                className={`flex-1 h-px ${
                  s < step
                    ? "bg-green-400"
                    : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Prepare */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Import data from another app
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Use ChatGPT, Claude, or any AI assistant to convert your exported
              data into a format we can read.
            </p>
          </div>

          <div className="relative">
            <pre className="text-[10px] leading-relaxed bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700/60">
              {IMPORT_PROMPT}
            </pre>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="absolute top-2 right-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              {copied ? "Copied ✓" : "Copy prompt"}
            </button>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground">How it works:</p>
            <ol className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 list-decimal list-inside">
              <li>
                Export your data from your current app (Apple Health,
                MyFitnessPal, Cronometer, Garmin, etc.)
              </li>
              <li>Open ChatGPT or Claude</li>
              <li>Paste this prompt along with your exported data</li>
              <li>Copy the markdown output it gives you</li>
            </ol>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Paste */}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Paste your markdown
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Paste the markdown output from your AI assistant below.
            </p>
          </div>

          <textarea
            value={markdownInput}
            onChange={(e) => setMarkdownInput(e.target.value)}
            placeholder="Paste the markdown output here..."
            rows={12}
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-foreground placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y"
          />

          {parseError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {parseError}
            </p>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleParse}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              Parse
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Select */}
      {step === 3 && payload && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Review & select
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              We found data in {activeSections.length} categor
              {activeSections.length === 1 ? "y" : "ies"}. Deselect anything
              you don&apos;t want to import.
            </p>
          </div>

          {payload.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 p-2.5">
              {payload.warnings.map((w, i) => (
                <p
                  key={i}
                  className="text-xs text-amber-700 dark:text-amber-400"
                >
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {activeSections.map((key) => {
              const meta = IMPORT_SECTION_META[key];
              const rows = payload[key] as {
                _valid: boolean;
                _error?: string;
              }[];
              const sel = selections[key];
              if (!sel) return null;
              const selectedCount = sel.rowSelected.filter(Boolean).length;

              return (
                <SectionCard
                  key={key}
                  sectionKey={key}
                  icon={meta.icon}
                  label={meta.label}
                  rows={rows}
                  selectedCount={selectedCount}
                  allSelected={sel.allSelected}
                  rowSelected={sel.rowSelected}
                  onToggleAll={() => toggleSection(key)}
                  onToggleRow={(idx) => toggleRow(key, idx)}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60 dark:border-neutral-700/40">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {totalSelected} item{totalSelected !== 1 ? "s" : ""} selected
              across {categoriesSelected} categor
              {categoriesSelected !== 1 ? "ies" : "y"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={totalSelected === 0 || importLoading}
                onClick={handleImport}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {importLoading
                  ? "Importing..."
                  : `Import ${totalSelected} item${totalSelected !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && importResult && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {importResult.errors.length === 0
                ? "Import complete"
                : "Import finished with some issues"}
            </h4>
          </div>

          <div className="rounded-lg border border-neutral-200/60 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800/50 p-3 space-y-2">
            {Object.entries(importResult.inserted).map(([key, count]) => {
              const meta =
                IMPORT_SECTION_META[key as ImportSectionKey] ?? { label: key, icon: "📦" };
              return (
                <div
                  key={key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {meta.icon} {meta.label}
                  </span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    +{count}
                  </span>
                </div>
              );
            })}
            {Object.keys(importResult.inserted).length === 0 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                No records were imported.
              </p>
            )}
          </div>

          {importResult.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/50 p-3 space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                {importResult.errors.length} error
                {importResult.errors.length !== 1 ? "s" : ""}:
              </p>
              {importResult.errors.map((err, i) => (
                <p
                  key={i}
                  className="text-[11px] text-red-600 dark:text-red-400"
                >
                  {err}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section card sub-component
// ---------------------------------------------------------------------------

function SectionCard({
  sectionKey,
  icon,
  label,
  rows,
  selectedCount,
  allSelected,
  rowSelected,
  onToggleAll,
  onToggleRow,
}: {
  sectionKey: ImportSectionKey;
  icon: string;
  label: string;
  rows: { _valid: boolean; _error?: string }[];
  selectedCount: number;
  allSelected: boolean;
  rowSelected: boolean[];
  onToggleAll: () => void;
  onToggleRow: (idx: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const previewColumns = useMemo(() => {
    return getPreviewColumns(sectionKey);
  }, [sectionKey]);

  return (
    <div className="rounded-lg border border-neutral-200/60 dark:border-neutral-700/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 dark:bg-neutral-800/50">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span className="text-sm">{icon}</span>
          <span className="text-sm font-medium text-foreground truncate">
            {label}
          </span>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-200 dark:bg-neutral-700 rounded-full px-1.5 py-0.5 font-medium">
            {rows.length}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
          {selectedCount}/{rows.length}
        </span>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          className="rounded border-neutral-300 dark:border-neutral-600 text-foreground focus:ring-foreground/30"
        />
      </div>

      {expanded && (
        <div className="border-t border-neutral-200/60 dark:border-neutral-700/40 max-h-60 overflow-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th className="w-8 px-2 py-1" />
                {previewColumns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-2 py-1 font-medium text-neutral-500 dark:text-neutral-400"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="w-8 px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const rowObj = row as Record<string, unknown>;
                return (
                  <tr
                    key={idx}
                    className={`border-t border-neutral-100 dark:border-neutral-800 ${
                      !row._valid
                        ? "bg-red-50/50 dark:bg-red-950/20"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                    }`}
                  >
                    <td className="px-2 py-1 text-center">
                      {!row._valid && (
                        <span title={row._error ?? "Invalid row"}>⚠️</span>
                      )}
                    </td>
                    {previewColumns.map((col) => (
                      <td
                        key={col.key}
                        className="px-2 py-1 text-neutral-700 dark:text-neutral-300 max-w-[160px] truncate"
                      >
                        {String(rowObj[col.key] ?? "")}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={rowSelected[idx] ?? false}
                        disabled={!row._valid}
                        onChange={() => onToggleRow(idx)}
                        className="rounded border-neutral-300 dark:border-neutral-600 text-foreground focus:ring-foreground/30 disabled:opacity-30"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getPreviewColumns(
  key: ImportSectionKey
): { key: string; label: string }[] {
  switch (key) {
    case "nutrition":
      return [
        { key: "date", label: "Date" },
        { key: "description", label: "Description" },
        { key: "calories", label: "Cal" },
        { key: "protein", label: "Protein" },
      ];
    case "exercise":
      return [
        { key: "date", label: "Date" },
        { key: "description", label: "Description" },
        { key: "duration", label: "Min" },
        { key: "caloriesBurned", label: "Cal" },
      ];
    case "weight":
      return [
        { key: "date", label: "Date" },
        { key: "weightKg", label: "Weight (kg)" },
      ];
    case "sleep":
      return [
        { key: "date", label: "Date" },
        { key: "hours", label: "Hours" },
        { key: "hrvMs", label: "HRV" },
      ];
    case "focus":
      return [
        { key: "date", label: "Date" },
        { key: "startTime", label: "Start" },
        { key: "endTime", label: "End" },
        { key: "tag", label: "Tag" },
      ];
    case "habits":
      return [
        { key: "name", label: "Name" },
        { key: "description", label: "Description" },
        { key: "bucket", label: "Bucket" },
      ];
    case "habitCompletions":
      return [
        { key: "habitName", label: "Habit" },
        { key: "date", label: "Date" },
      ];
    case "reflections":
      return [
        { key: "date", label: "Date" },
        { key: "text", label: "Text" },
      ];
    case "goals":
      return [
        { key: "setting", label: "Setting" },
        { key: "value", label: "Value" },
      ];
    case "concepts":
      return [
        { key: "title", label: "Title" },
        { key: "summary", label: "Summary" },
      ];
  }
}
