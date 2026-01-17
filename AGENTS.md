# AGENTS.md - Arona Codebase Guidelines

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

Arona is a QQ bot application built with TypeScript and the Effect library. It uses the OneBot protocol for QQ messaging and integrates with external services (Twitter, YouTube) via the Wormface API.

### Repository Structure

```
Arona/
├── apps/
│   ├── arona/          # Main bot application
│   ├── essence/        # Essence extraction utility
│   └── zju-ba-page/    # Next.js web application
├── packages/
│   ├── onebot/         # OneBot protocol client library
│   └── wormface-openapi/  # Generated OpenAPI client
└── pnpm-workspace.yaml # Workspace configuration
```

## Build/Lint/Test Commands

### Package Manager
- **Use pnpm** - This is a pnpm workspace monorepo

### Build Commands

```bash
# Build all packages (from root)
pnpm -r build

# Build specific app
pnpm --filter arona build
pnpm --filter onebot build
pnpm --filter essence build

# Development mode with watch
pnpm --filter arona dev          # Runs concurrent build + start with watch
pnpm --filter onebot dev         # TypeScript watch mode

# TypeScript type checking only
pnpm --filter arona exec tsc --noEmit
pnpm --filter onebot exec tsc --noEmit
```

### Running the Application

```bash
# Development (with watch)
pnpm --filter arona dev

# Production
pnpm --filter arona start

# Configure environment (requires 1Password CLI)
pnpm --filter arona config
```

### Linting

```bash
# For zju-ba-page (Next.js app with ESLint)
pnpm --filter zju-ba-page lint
```

### Testing

No test framework is currently configured in this repository.

## Code Style Guidelines

### Formatting (Prettier)

Prettier is configured with the following settings (`.prettierrc`):
- **Semi**: `true` - Always use semicolons
- **Single quotes**: `false` - Use double quotes for strings
- **Tab width**: `2` spaces
- **Tabs**: `false` - Use spaces, not tabs
- **Trailing comma**: `"es5"` - Trailing commas where valid in ES5
- **Print width**: `120` characters

### TypeScript Configuration

- **Target**: ESNext
- **Module**: NodeNext (ES modules with `.js` extensions in imports)
- **Strict mode**: Enabled (`strict: true`, `alwaysStrict: true`)
- **No implicit any**: Enabled
- **Force consistent casing**: Enabled

### Import Conventions

1. **Order imports** by category:
   - Node.js built-in modules first (`node:path`, `node:crypto`)
   - External dependencies second
   - Internal/workspace packages third
   - Relative imports last

2. **Always use `.js` extension** for relative imports (required for NodeNext module resolution):
   ```typescript
   import { logger } from "./util/logger.js";
   import { OneBot } from "onebot";
   ```

3. **Use `type` keyword** for type-only imports:
   ```typescript
   import type { OneBotEvent } from "./event.js";
   ```

### Naming Conventions

- **Classes**: PascalCase (`OneBotService`, `TwitterPlugin`)
- **Functions/methods**: camelCase (`subscribeTwitter`, `getUserPosts`)
- **Constants**: SCREAMING_SNAKE_CASE for module-level constants (`MAX_TWEETS_TO_PROCESS`, `REDIS_TWITTER_SENT`)
- **Variables**: camelCase (`proxyAgent`, `videoInfo`)
- **Type aliases**: PascalCase (`MessageSegment`, `OneBotEvent`)
- **Files**: kebab-case or lowercase (`logger.ts`, `index.ts`)

### Effect Library Patterns

This codebase heavily uses the Effect library. Follow these patterns:

1. **Services as Context.Tag**:
   ```typescript
   export class RedisService extends Context.Tag("redis")<
     RedisService,
     { readonly client: ReturnType<typeof createClient> }
   >() {
     static Live = Layer.scoped(RedisService, Effect.gen(function* () {
       // Service initialization
     }));
   }
   ```

2. **Use `Effect.gen` with generators**:
   ```typescript
   return Effect.gen(function* () {
     const redis = yield* RedisService;
     const result = yield* Effect.promise(() => someAsyncOperation());
     return result;
   });
   ```

3. **Error handling with `Effect.catchAll`**:
   ```typescript
   yield* effect.pipe(
     Effect.catchAll((e) =>
       Effect.sync(() => {
         logger.error(`Failed: ${e}`);
         captureException(e);
       })
     )
   );
   ```

### Error Handling

1. **Create custom error classes** extending `Error`:
   ```typescript
   export class OneBotError extends Error {
     constructor(message?: string, options?: ErrorOptions) {
       super(message, options);
       this.name = "OneBotError";
     }
   }
   ```

2. **Use Sentry for error tracking**: Import `captureException` from `@sentry/node`

3. **Use pino for logging**: Create child loggers with module context:
   ```typescript
   const logger = parentLogger.child({ module: "twitter" });
   ```

### Type Definitions

1. **Use discriminated unions** for event types:
   ```typescript
   export type OneBotEvent = OneBotMetaEvent | OneBotMessageEvent | OneBotNoticeEvent;
   ```

2. **Use mapped types** for message segments:
   ```typescript
   export type MessageSegment = {
     [K in keyof MessageType]: { type: K; data: MessageType[K] };
   }[keyof MessageType];
   ```

3. **Declare environment variables** in `global.d.ts`:
   ```typescript
   namespace NodeJS {
     interface ProcessEnv {
       REDIS: string;
       // ...
     }
   }
   ```

### Plugin Architecture

Plugins are classes with methods that return `Effect` computations:

```typescript
export class TwitterPlugin {
  subscribeTwitter() {
    return Effect.gen(function* () {
      const service = yield* SomeService;
      // Plugin logic
    });
  }
}
```

### File Organization

- `src/core/` - Core application logic and services
- `src/core/services/` - Effect service definitions
- `src/plugin/` - Bot plugins (Twitter, YouTube, Poke, etc.)
- `src/util/` - Utility modules (logger, request helpers, sentry)

### Comments

- Use JSDoc-style comments for public APIs
- Chinese comments are acceptable (this is a Chinese-language project)
- TODO comments follow the format: `// TODO: Description`
