module.exports = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.m?[tj]sx?$': [
      'babel-jest',
      {
        presets: ['@babel/preset-env', '@babel/preset-typescript']
      }
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!llama-tokenizer-js)',
  ],
};