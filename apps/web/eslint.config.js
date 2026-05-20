import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      i18next,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'i18next/no-literal-string': ['warn', {
        mode: 'jsx-text-only',
        'should-validate-template': true,
        ignoreCallee: ['console.*', 'Error'],
        ignoreAttribute: [
          'aria-label', 'aria-labelledby', 'aria-describedby',
          'data-*', 'className', 'style', 'key', 'role', 'type',
          'name', 'htmlFor', 'id', 'src', 'href', 'alt', 'title',
          'tabIndex', 'placeholder', 'accept', 'sandbox',
        ],
      }],
    },
  },
  {
    files: ['**/*.test.*', '**/*.config.*', 'vite.config.*'],
    rules: {
      'i18next/no-literal-string': 'off',
    },
  },
])
