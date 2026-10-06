import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**', '**/.next/**', 'spec/**', '.pnpm-store/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
