/**
 * Build-time config. Replace with your values or use env.
 * For production: use https://fmllabs.ai
 */
export const API_BASE =
  typeof __API_BASE__ !== "undefined"
    ? __API_BASE__
    : "https://fmllabs.ai";

export const CLERK_PUBLISHABLE_KEY =
  typeof __CLERK_PUBLISHABLE_KEY__ !== "undefined"
    ? __CLERK_PUBLISHABLE_KEY__
    : "";
