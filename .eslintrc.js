module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 6,
  },
  plugins: ['prettier', 'node'],
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:node/recommended',
  ],
  env: {
    browser: false,
    node: true,
    es6: true,
  },
  rules: {},
};
