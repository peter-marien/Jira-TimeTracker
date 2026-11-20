import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import angular from 'angular-eslint'
import globals from 'globals'

export default defineConfig(
  { ignores: ['.angular/**', 'dist/**', 'dist-electron/**', 'release/**', 'out/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    files: ['src/app/**/*.ts'],
    extends: angular.configs.tsRecommended,
    processor: angular.processInlineTemplates,
  },
  {
    files: ['src/app/**/*.html'],
    extends: angular.configs.templateRecommended,
  },
)
