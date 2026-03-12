import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/chat(.*)",
  "/about",
  "/mission",
  "/terms-of-service",
  "/privacy-policy",
  "/api/chat",
  "/api/contact",
  "/api/tts",
  "/api/tts-with-timestamps",
  "/api/mental-models(.*)",
  "/api/generate-relevant-prompt",
  "/api/sessions(.*)",
  "/api/me/concepts(.*)",
  "/api/me/long-term-memory(.*)",
  "/api/extension(.*)",
  "/manifest.json",
  "/icons(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth().protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
