import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig([
  {
    input: "https://raw.githubusercontent.com/OrkWard/wormface/refs/heads/master/internal/server/docs/swagger.yaml",
    output: {
      path: "src/codegen/wormface",
      importFileExtension: ".js",
      postProcess: ["prettier"],
    },
    plugins: [
      "@hey-api/typescript",
      "@hey-api/sdk",
      {
        name: "@hey-api/client-ky",
        throwOnError: true,
      },
    ],
  },
  {
    input: "https://raw.githubusercontent.com/OrkWard/arona-ml/refs/heads/master/openapi.json",
    output: {
      path: "src/codegen/ml",
      importFileExtension: ".js",
      postProcess: ["prettier"],
    },
    plugins: [
      "@hey-api/typescript",
      "@hey-api/sdk",
      {
        name: "@hey-api/client-ky",
        throwOnError: true,
      },
    ],
  },
]);
