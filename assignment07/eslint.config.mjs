import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.angular/**', 'client/public/**'] },
  ...tseslint.configs.recommended,
);
