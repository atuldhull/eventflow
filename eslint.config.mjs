import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Temporary relaxation. There are ~330 pre-existing `any` usages, mostly in
      // the site-builder config/content plumbing. Retyping them without the domain
      // context risks changing runtime behaviour, so they stay visible as warnings
      // and get paid down incrementally rather than blocking CI.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Plain Node scripts (browser tests, ops helpers) are CommonJS on purpose: they run with
    // `node file.cjs`, outside the Next.js build.
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
