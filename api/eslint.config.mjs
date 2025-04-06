// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/*',
      '**/build/*',
      '**/coverage/*',
      '**/.idea/*',
      '**/.vscode/*',
      '**/.docker/*',
      '**/.github/*',
      '**/public/**/*',
      '**/node_modules/**/*',
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    rules: {
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': ['error'],
      'import/extensions': 'off',
      '@typescript-eslint/no-unused-vars': ['error'],
      'no-console': ['error', { allow: ['warn', 'error', 'info', 'table'] }],
      'import/prefer-default-export': 'off',
      'import/no-unresolved': 'off',
      'no-plusplus': 'off',
      'class-methods-use-this': 'off',
      'no-await-in-loop': 'off',
      'consistent-return': 'off',
      'import/no-extraneous-dependencies': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      camelcase: 'off',
      'indent': ['error', 2],
      'semi': ['error', 'always'],
    },
  }
);
