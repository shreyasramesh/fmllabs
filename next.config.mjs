import withPWA from "next-pwa";

/** Include mental model YAML files in Vercel serverless bundle (not traced by default) */
const mentalModelsInclude = [
  "./mental-models-index.yaml",
  "./mental-models-index-*.yaml",
  "./mental-models/**/*.yaml",
  "./mental-models-*/**/*.yaml",
];

const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/mental-models": mentalModelsInclude,
      "/api/mental-models/preview": mentalModelsInclude,
      "/api/mental-models/[id]": mentalModelsInclude,
      "/api/mental-models/with-when-to-use": mentalModelsInclude,
      "/api/mental-models/random": mentalModelsInclude,
    },
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
})(nextConfig);
