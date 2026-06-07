import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: false
      }
    },
    rules: {
      "no-console": "off"
    }
  },
  {
    ignores: ["dist/**", "node_modules/**"]
  }
);
