import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,

  // Node.js environment
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Jest test environment
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },

  // Custom rules
  {
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-undef": "error",
    },
  },
];
