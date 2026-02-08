import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    ignores: ["eslint.config.mjs","node_modules/**", "dist/**"],
    plugins: { js }, extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
    rules: {
      "no-case-declarations": "off",
      "no-unused-vars": ["warn"],
      "sort-imports": ["warn", {
        "ignoreCase": false,
        "ignoreDeclarationSort": false,
        "ignoreMemberSort": false,
        "memberSyntaxSortOrder": ["none", "all", "multiple", "single"],
        "allowSeparatedGroups": false
      }],
    },
  }
]);
