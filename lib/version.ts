/**
 * App version (Major.Minor.Daily).
 * Daily is computed from git rev-list --count HEAD at build time.
 */
let _version = "0.1.0";
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("./version.generated");
  _version = m.APP_VERSION ?? _version;
} catch {
  // Generated file not present (e.g. before first build)
}
export const APP_VERSION = _version;
