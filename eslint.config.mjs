// Next.js and TypeScript configurations
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

const eslintConfig = defineConfig([...nextVitals, ...nextTs, {
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.property.name='toNumber']",
        message: "❗ Nunca usar .toNumber() directamente. Usa normalizePrice()."
      },
      {
        selector: "JSXOpeningElement[name.name='button']",
        message: "Use <Button /> del Design System"
      },
      {
        selector: "JSXOpeningElement[name.name='input']",
        message: "Use <Input /> del Design System"
      },
      {
        selector: "JSXOpeningElement[name.name='select']",
        message: "Use componente del DS"
      }
    ],
    "no-restricted-globals": [
      "error",
      {
        name: "alert",
        message: "Prohibido. Use Toast o Modal"
      },
      {
        name: "prompt",
        message: "Use a controlled UI component instead of prompt()"
      },
      {
        name: "confirm",
        message: "Use <Modal /> del Design System"
      }
    ],
    "no-restricted-imports": [
      "error",
      {
        patterns: ["*.css"],
        paths: [
          {
            name: "react-hot-toast",
            message: "Use internal useToast system"
          },
          {
            name: "sonner",
            message: "Use internal useToast system"
          },
          {
            name: "react-toastify",
            message: "Use internal useToast system"
          }
        ]
      }
    ],
    "no-restricted-properties": [
      "error",
      {
        object: "className",
        message: "No usar Tailwind directo (bg-*, text-*). Usa tokens hp-* o componentes UI"
      }
    ],
    // Block new `any` in all files not explicitly overridden below.
    "@typescript-eslint/no-explicit-any": "warn",
  }
}, // Legacy files: downgrade to warn so they stay visible but don't block CI.
{
  files: LEGACY_ANY_FILES,
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
  }
}, // Override default ignores of eslint-config-next.
globalIgnores([
  // Default ignores of eslint-config-next:
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  // Prisma auto-generated — never lint:
  "src/generated/**",
]),
// AST Regex Rule for className (anti-Tailwind directo)
{
  files: ["**/*.tsx"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "JSXAttribute[name.name='className'][value.value=/bg-|text-|border-/]",
        message: "Uso de Tailwind directo prohibido. Usa tokens hp-* o primitives"
      }
    ]
  }
}
]);

export default eslintConfig;
