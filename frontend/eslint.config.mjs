import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This experimental rule flags the standard "fetch on mount, setState
      // in the .then()" pattern used throughout this app's data loading
      // (GroupProvider, every page's `load()` effect). That pattern is safe
      // here -- each effect fetches once (or on a real dependency change)
      // and sets loading/data/error state from the response, not a render
      // loop. Disabling rather than restructuring every fetch into a
      // different pattern just to satisfy an experimental lint rule.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
