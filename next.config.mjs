import withPWA from "next-pwa";

/** Include mental model YAML files in Vercel serverless bundle (not traced by default) */
const mentalModelsInclude = ["./mental-models/*.yaml"];

/** Include perspective deck YAML files in Vercel serverless bundle */
const perspectiveDecksInclude = ["./perspective-decks/**/*.yaml"];

const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com", pathname: "/**" }],
  },
  experimental: {
    outputFileTracingIncludes: {
      "/api/mental-models": mentalModelsInclude,
      "/api/mental-models/preview": mentalModelsInclude,
      "/api/mental-models/[id]": mentalModelsInclude,
      "/api/mental-models/with-when-to-use": mentalModelsInclude,
      "/api/mental-models/random": mentalModelsInclude,
      "/api/perspective-decks": perspectiveDecksInclude,
      "/api/perspective-decks/[deckId]": perspectiveDecksInclude,
      "/api/perspective-decks/[deckId]/random": perspectiveDecksInclude,
    },
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
})(nextConfig);
