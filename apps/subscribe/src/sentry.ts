import * as Sentry from "@sentry/node";
import { C } from "./config.js";

Sentry.init({
  dsn: C.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
});
