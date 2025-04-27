export default {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    testMatch: ["**/__tests__/**/*.test.ts"],
    moduleNameMapper: {
      "^@/(.*)$": "<rootDir>/src/$1"
    },
    transform: {
      "^.+\\.(ts|tsx)$": ["ts-jest", { useESM: true }]
    },
    transformIgnorePatterns: ["/node_modules/(?!(p-map|p-retry)/)"]
  };
  