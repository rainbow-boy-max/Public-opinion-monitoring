module.exports = {
  root: true,
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  plugins: ['vue', '@typescript-eslint'],
  extends: ['plugin:vue/vue3-recommended', 'plugin:@typescript-eslint/recommended', 'eslint-config-prettier'],
  env: {
    browser: true,
    es2021: true,
  },
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'vue/multi-word-component-names': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/ban-types': 'off',
    'vue/no-unused-vars': 'warn',
    'vue/no-deprecated-filter': 'warn',
  },
};
