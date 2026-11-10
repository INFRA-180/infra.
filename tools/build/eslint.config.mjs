// Vérification du JavaScript du site (chantier JavaScript d'INFRA, 10/11/2026) : npm run lint.
// Erreurs = vrais défauts (variable inconnue, code inatteignable, doublons…) ; le style est laissé à Prettier.
import js from "@eslint/js";
import globals from "globals";

const rules = {
  ...js.configs.recommended.rules,
  // convention du code : un nom qui commence par _ est volontairement inutilisé
  "no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
  ],
  "no-empty": ["error", { allowEmptyCatch: true }],
  // style défensif du code : « let x = null; » avant un try — sans danger, non signalé
  "no-useless-assignment": "off"
};

export default [
  { ignores: ["public/assets/js/app.js", "public/assets/vendor/**"] },
  {
    files: ["public/assets/js/scripts.js", "public/assets/js/runtime/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.browser } },
    rules
  },
  {
    files: ["public/assets/js/*.js"],
    ignores: ["public/assets/js/scripts.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser } },
    rules
  }
];
