import eslintPluginAstro from "eslint-plugin-astro";
import eslintPluginPrettier from "eslint-plugin-prettier/recommend";
import eslintPluginVue from "eslint-plugin-vue";
import globals from "globals";

export default [
  ...eslintPluginVue.configs["flat/recommended"],
  ...eslintPluginAstro.configs.recommended,
  ...eslintPluginPrettier,
  {
    rules: {
      // override/add rules settings here
    },
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
  },
];
