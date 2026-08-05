import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'
import promisePlugin from 'eslint-plugin-promise'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import sonarjsPlugin from 'eslint-plugin-sonarjs'
import storybookPlugin from 'eslint-plugin-storybook'
import unicornPlugin from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(
  // Global Ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
      '**/build/**',
      '**/coverage/**',
      '**/storybook-static/**',
      '**/*.d.ts',
    ],
  },

  // Base Configuration (JS & TS) - source files only (covered by tsconfig.json)
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      // ...tseslint.configs.recommendedTypeChecked, // Uncomment if you want strict type-aware rules
    ],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2025,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      'import-x': importX,
      promise: promisePlugin,
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: './tsconfig.json',
        }),
      ],
    },
    rules: {
      // Import Rules — oxlint has no equivalent for these two.
      'import-x/no-unresolved': 'error',
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
          ],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // Common Overrides
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-underscore-dangle': 'off',
      'no-nested-ternary': 'off',
      'no-plusplus': 'off',

      // Allow _-prefixed variables as intentionally unused markers
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Config and other JS/MJS files (not covered by tsconfig)
  {
    extends: [js.configs.recommended],
    files: ['*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2025,
      },
    },
  },

  // React hooks — kept in ESLint because it is the React team's own plugin and
  // is the canonical source for these rules.
  {
    files: ['**/*.{jsx,tsx}'],
    extends: [reactHooksPlugin.configs.flat['recommended-latest']],
  },

  // SonarJS & Unicorn (Code Quality)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      sonarjsPlugin.configs.recommended,
      unicornPlugin.configs.recommended,
    ],
    rules: {
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/name-replacements': 'off',
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/no-non-function-verb-prefix': 'off',
      'unicorn/prefer-simple-condition-first': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/single-line-block-comment-style': 'off',
    },
  },

  // Demo/story files.
  {
    files: ['src/stories/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'sonarjs/pseudo-random': 'off',
    },
  },

  // Test files.
  {
    files: ['src/**/*.test.{ts,tsx}', 'vitest.setup.ts'],
    rules: {
      // Test-local components are deliberate: hoisting them would share one
      // component identity across tests, which is exactly what several of
      // these tests are measuring.
      'unicorn/consistent-function-scoping': 'off',
      // Harnesses for different scenarios legitimately look alike.
      'sonarjs/no-identical-functions': 'off',
      'no-console': 'off',
    },
  },

  // Storybook Specifics
  ...storybookPlugin.configs['flat/recommended'],

  // Prettier (Must be last)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      ...prettierConfig.rules,
    },
  }
)
