import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
  // Vue i18n globals
  $t: 'readonly',
  // Vue globals
  $route: 'readonly',
  $router: 'readonly',
  // Pinia store globals
  useGlobalStore: 'readonly',
  // Google Analytics
  gtag: 'readonly',
}

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx,vue,ts,tsx}'],
  },

  {
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  // TypeScript files configuration
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: sharedGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // JavaScript and Vue files configuration
  {
    files: ['**/*.{js,mjs,jsx,vue}'],
    languageOptions: {
      globals: sharedGlobals,
    },
  },

  // Test files override: enable Node/Vitest-like globals to avoid false positives
  {
    name: 'tests/env-overrides',
    files: ['**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*.test.{js,jsx,ts,tsx}', 'src/test/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
        // Jest/Vitest style globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      // Allow helper variables in tests without triggering noise
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  // Final overrides must come after recommended configs.
  {
    name: 'app/final-vue-ts-parser',
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: sharedGlobals,
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    name: 'app/final-ts-rules',
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    name: 'app/final-test-overrides',
    files: ['**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*.test.{js,jsx,ts,tsx}', 'src/test/**/*.{js,ts}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
