module.exports = {
  extends: '../.eslintrc.cjs',
  // Allow describe and it
  env: { mocha: true },
  rules: {
    // Allow assert style expressions. i.e. expect(true).to.be.true
    'no-unused-expressions': 'off',
    '@typescript-eslint/ban-ts-ignore': 'off',
    'no-shadow': 'off',
    'no-underscore-dangle': 'off',
    camelcase: 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-shadow': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',

    // It is common for tests to stub out method.
    // Return types are defined by the source code. Allows for quick overwrites.
    '@typescript-eslint/explicit-function-return-type': 'off',
    // Mocked out the methods that shouldn't do anything in the tests.
    '@typescript-eslint/no-empty-function': 'off',
  },
};
