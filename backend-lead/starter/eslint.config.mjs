import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  console: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
};

const jestGlobals = {
  afterAll: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
};

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...js.configs.recommended,
    languageOptions: { globals: nodeGlobals, sourceType: 'commonjs' },
  },
  ...tseslint.configs.recommended,
  {
    files: ['test/**/*.ts'],
    languageOptions: { globals: jestGlobals },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // sequelize-cli loads this configuration file through CommonJS.
    files: ['src/db/cli-config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
