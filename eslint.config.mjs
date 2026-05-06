// eslint.config.mjs
// ESLint 9 flat config — replaces `next lint` (removed in Next 16).
// Composes Next.js's core-web-vitals + typescript ruleset, plus project ignores.
//
// Rule posture (v6.3.0): the lint gate is intentionally lenient on the first
// ratchet so existing tech debt (146 `any` types, 8 set-state-in-effect uses,
// 4 unescaped JSX entities) doesn't block CI rollout. Future cleanup PRs can
// ratchet `any` and `set-state-in-effect` from `warn` back to `error` once
// the existing offenders have been addressed.

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const nextCWV = require("eslint-config-next/core-web-vitals");
const nextTS = require("eslint-config-next/typescript");

export default [
  ...nextCWV,
  ...nextTS,
  {
    rules: {
      // Pre-existing tech debt — downgrade error→warn so they remain visible
      // in CI logs but don't block merges. Re-tighten in a future cleanup PR.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",

      // React 19 / React Compiler preview rules — codebase isn't ready for
      // these and they fire on patterns we use intentionally. Disable for now.
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
    },
  },
  {
    // Files outside the Next.js source tree that don't need linting.
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "scratch/**",
      "filmglance-brand.js",
      "scripts/**",
      "next-env.d.ts",
    ],
  },
];
