const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  moduleDirectories: ['node_modules', '<rootDir>'],
  moduleNameMapper: {
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@context/(.*)$': '<rootDir>/src/context/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^pdfjs-dist$': '<rootDir>/node_modules/pdfjs-dist/legacy/build/pdf.js',
    '^@ui/(.*)$': '<rootDir>/components/ui/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        presets: ['next/babel'],
        plugins: [['@babel/plugin-transform-modules-commonjs', { loose: true }]],
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!pdfjs-dist)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    },
  },
};

module.exports = createJestConfig(customJestConfig);
