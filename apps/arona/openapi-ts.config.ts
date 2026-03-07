import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig([
  {
    input: "https://raw.githubusercontent.com/OrkWard/wormface/master/internal/server/docs/swagger.yaml",
    output: {
      path: "src/codegen/wormface",
      importFileExtension: ".js",
      postProcess: ["prettier"],
    },
  },
  {
    input: "../arona-ml/openapi.json",
    output: {
      path: "src/codegen/ml",
      importFileExtension: ".js",
      postProcess: ["prettier"],
    },
  },
]);
