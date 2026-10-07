import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next/link", message: "Use Link from '@/i18n/navigation' so locale prefixes are kept." },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "node_modules/**", "supabase/functions/**", "next-env.d.ts", "src/lib/supabase/database.types.ts"]),
]);
