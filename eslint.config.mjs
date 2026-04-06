import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Plugins
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';
import unicornPlugin from 'eslint-plugin-unicorn';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import storybookPlugin from 'eslint-plugin-storybook';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    ignores: ['src/stories/**'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      'import': importPlugin,
      'promise': promisePlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
    },
    rules: {
      // Import Rules
      'import/no-unresolved': 'error',
      'import/order': [
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

  // Stories files - use default project (no tsconfig coverage needed)
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    files: ['src/stories/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        project: null,
      },
    },
    plugins: {
      'import': importPlugin,
      'promise': promisePlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
    },
    rules: {
      'import/no-unresolved': 'error',
      'no-console': 'off',
      'no-underscore-dangle': 'off',
      'no-nested-ternary': 'off',
      'no-plusplus': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Relax strict rules for demo/story code
      '@typescript-eslint/no-explicit-any': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-spread': 'off',
      'sonarjs/pseudo-random': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
    },
  },

  // Config and other JS/MJS files (not covered by tsconfig)
  {
    extends: [
      js.configs.recommended,
    ],
    files: ['*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },

  // React Specifics
  {
    files: ['**/*.{jsx,tsx}'],
    extends: [
      reactPlugin.configs.flat.recommended,
      reactPlugin.configs.flat['jsx-runtime'], // React 17+
      reactHooksPlugin.configs.flat['recommended-latest'],
      jsxA11yPlugin.flatConfigs.recommended,
    ],
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      
      // React Rules Overrides
      'react/prop-types': 'off', // Not needed with TypeScript
      'react/require-default-props': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
      'react/function-component-definition': [
        'warn',
        {
          namedComponents: 'arrow-function',
          unnamedComponents: 'arrow-function',
        },
      ],
      'react/jsx-filename-extension': ['warn', { extensions: ['.tsx', '.jsx'] }],
    },
  },

  // SonarJS & Unicorn (Code Quality)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      sonarjsPlugin.configs.recommended,
      unicornPlugin.configs['flat/recommended'],
    ],
    rules: {
      // Relax some Unicorn rules that can be annoying
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/no-useless-undefined': 'off',
    },
  },

  // Relaxed rules for demo/story files (overrides stricter rules from block 4)
  {
    files: ['src/stories/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-spread': 'off',
      'sonarjs/pseudo-random': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'no-console': 'off',
      'react/jsx-key': 'off',
    },
  },

  // Storybook Specifics
  ...storybookPlugin.configs['flat/recommended'],

  // Prettier (Must be last)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierConfig.rules, // Turns off conflicting ESLint rules
      'prettier/prettier': 'error',
    },
  },
);