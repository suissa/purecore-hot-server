module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/dist'],
  testMatch: ['**/?(*.)+(spec|test).js'],
  transform: {}, // sem ts-jest
  moduleFileExtensions: ['js', 'json']
};