import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Legacy files with pre-existing `any` usage (DEBT-02).
// These are set to "warn" to keep them visible without blocking CI.
// Rule: Boy Scout — clean `any` when you touch the file, don't add new ones.
const LEGACY_ANY_FILES = [
  // src — specific legacy files
  "src/app/actividades/_components/MapInner.tsx",
  "src/app/admin/source-health/client.tsx",
  "src/app/admin/sources/components/SourceStatsTable.tsx",
  "src/app/api/activities/map/route.ts",
  "src/app/api/admin/claims/**/route.ts",
  "src/app/api/admin/quality/route.ts",
  "src/app/api/admin/send-notifications/route.ts",
  "src/app/api/admin/source-health/route.ts",
  "src/app/api/admin/sources/url-stats/route.ts",
  "src/app/api/admin/sponsors/**/route.ts",
  "src/app/api/auth/send-welcome/route.ts",
  "src/components/ActivityDetailMapInner.tsx",
  "src/components/ActivityMap.tsx",
  "src/components/PushButton.tsx",
  "src/lib/decimal.ts",
  "src/lib/email/resend.tsx",
  "src/lib/push.ts",
  "src/lib/source-pause-manager.ts",
  "src/modules/activities/activities.service.ts",
  "src/modules/analytics/metrics.ts",
  "src/modules/scraping/cache.ts",
  "src/modules/scraping/extractors/cheerio.extractor.ts",
  "src/modules/scraping/extractors/playwright.extractor.ts",
  "src/modules/scraping/logger.ts",
  "src/modules/scraping/nlp/claude.analyzer.ts",
  "src/modules/scraping/nlp/gemini.analyzer.ts",
  "src/modules/scraping/pipeline.ts",
  "src/modules/scraping/resilience.ts",
  "src/modules/scraping/storage.ts",
  // scripts — operational CLI scripts (all legacy)
  "scripts/**/*.ts",
  // tests — any in test mocks is acceptable
  "src/**/__tests__/**/*.ts",
  "src/**/__tests__/**/*.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toNumber']",
          message: "❗ Nunca usar .toNumber() directamente. Usa normalizePrice()."
        }
      ],
      // Block new `any` in all files not explicitly overridden below.
      "@typescript-eslint/no-explicit-any": "error",
    }
  },
  // Legacy files: downgrade to warn so they stay visible but don't block CI.
  {
    files: LEGACY_ANY_FILES,
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma auto-generated — never lint:
    "src/generated/**",
  ]),
]);

export default eslintConfig;
