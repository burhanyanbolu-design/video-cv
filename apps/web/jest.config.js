/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: { jsx: "react" } }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@video-cv/(.*)$": "<rootDir>/../../packages/$1/src/index.ts",
  },
  setupFilesAfterFramework: ["@testing-library/jest-dom"],
  testPathPattern: "src/.*\\.test\\.(ts|tsx)$",
  passWithNoTests: true,
};
