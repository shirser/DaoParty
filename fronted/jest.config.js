const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jsdom",
  moduleDirectories: ["node_modules", "<rootDir>/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1", // Добавляем поддержку `@/` алиасов
  },
  testMatch: ["<rootDir>/src/**/*.test.{js,jsx,ts,tsx}"],
};

module.exports = createJestConfig(customJestConfig);
