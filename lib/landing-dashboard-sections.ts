/** Dashboard section anchors (must match `id` on wrappers in LandingShell). */
export const LANDING_DASHBOARD_SECTIONS = [
  { id: "sec-focus", label: "Focus" },
  { id: "sec-timeline", label: "Timeline" },
  { id: "sec-summary", label: "Summary" },
  { id: "sec-activity", label: "Activity" },
  { id: "sec-caffeine", label: "Caffeine" },
  { id: "sec-sleep", label: "Sleep" },
  { id: "sec-mentor", label: "Mentor Hub" },
] as const;

export function scrollToLandingDashboardSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
