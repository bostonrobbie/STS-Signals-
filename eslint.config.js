import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        AbortController: 'readonly',
        requestAnimationFrame: 'readonly',
        // DOM types
        HTMLDivElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLElement: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        Event: 'readonly',
        ErrorEvent: 'readonly',
        PromiseRejectionEvent: 'readonly',
        EventSource: 'readonly',
        // Browser APIs
        btoa: 'readonly',
        atob: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        // Fetch types
        RequestInit: 'readonly',
        RequestInfo: 'readonly',
        HeadersInit: 'readonly',
        // Performance API
        performance: 'readonly',
        // Node.js types
        NodeJS: 'readonly',
        // React
        React: 'readonly',
        JSX: 'readonly',
        // Google Maps
        google: 'readonly',
        // Node globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        global: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      
      // React rules - detect missing imports
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      
      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // Prevent undefined variables (catches missing imports like memo, useState)
      'no-undef': 'error',
      
      // Disable base rule in favor of TypeScript version
      'no-unused-vars': 'off',
      
      // Allow lexical declarations in case blocks (common pattern)
      'no-case-declarations': 'off',
      
      // Allow empty catch blocks (common for error suppression)
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Ignore patterns
    ignores: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      '*.config.js',
      '*.config.ts',
      'drizzle/**/*.sql',
    ],
  },
];
