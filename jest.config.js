const { loadEnv } = require("@medusajs/utils");
loadEnv("test", process.cwd());

const syncTestDbEnvWithDatabaseUrl = () => {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const dbUrl = new URL(process.env.DATABASE_URL);

  process.env.DB_HOST = dbUrl.hostname;
  process.env.DB_PORT = dbUrl.port || "5432";
  process.env.DB_USERNAME = decodeURIComponent(dbUrl.username);
  process.env.DB_PASSWORD = decodeURIComponent(dbUrl.password);
};

syncTestDbEnvWithDatabaseUrl();

module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  setupFiles: ["./integration-tests/setup.js"],
};

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"];
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"];
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"];
}
