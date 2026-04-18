// ESLint flat config — required by eslint v9 + eslint-config-next v16.
// Legacy .eslintrc.json hits a "Converting circular structure to JSON"
// bug in `next lint` on Next 15.5 + eslint-config-next 16, which is why
// we use the flat format here instead. `next lint` auto-detects this
// file and skips the interactive prompt.
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "releases/**",
      "extension/**",
      "scripts/fixtures/**",
    ],
  },
];
