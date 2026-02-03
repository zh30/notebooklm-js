# Agent Guidelines for notebooklm-js

TypeScript/Bun client for Google NotebookLM, ported from `notebooklm-py`.
Provides a library (`src/client.ts`) and CLI (`src/cli/index.ts`).

## 1. Environment & Commands

This project uses **Bun** as runtime and package manager.

```bash
bun install                  # Install dependencies
bun test                     # Run all tests
bun test tests/rpc.test.ts   # Run specific file
bun test -t "encode"         # Run tests matching pattern
bun run check                # Type check (tsc --noEmit)
bun run lint                 # Biome check
bun run format               # Biome format --write
bun run cli <command>        # e.g., bun run cli list
bun run cli login            # Launch browser for auth
```

## 2. Code Style & Standards

### Formatting and Linting
- **Biome** is the single source of truth (no Prettier/ESLint)
- Run `bun run format && bun run lint` before committing

### TypeScript Configuration
- **Strict mode**: `strict: true`, `noUncheckedIndexedAccess: true`
- **Target**: `ESNext` - use modern features (top-level await, native `fetch`)
- **Module**: `verbatimModuleSyntax` enabled - use `import type` for type-only imports

### Imports
```typescript
// Type-only imports (REQUIRED due to verbatimModuleSyntax)
import type { Notebook, Source } from "./types";

// Value imports
import { ClientCore } from "./core/client";
import { RPCMethod, BATCHEXECUTE_URL } from "./rpc/types";
```

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Files | `kebab-case` or `camelCase` | `url-utils.ts`, `encoder.ts` |
| Classes | `PascalCase` | `NotebookLMClient`, `ClientCore` |
| Interfaces/Types | `PascalCase` | `Notebook`, `AuthTokens` |
| Enums | `PascalCase` | `RPCMethod`, `ArtifactStatus` |
| Variables/Functions | `camelCase` | `getHomeDir`, `rpcCall` |
| Constants | `UPPER_SNAKE_CASE` | `BATCHEXECUTE_URL`, `DEFAULT_TIMEOUT` |

### Exports
- Prefer named exports over default exports
- One class per file for API classes (`NotebooksAPI`, `SourcesAPI`, etc.)

## 3. Architecture & Patterns

### Directory Structure
```
src/
├── client.ts          # Main entry: NotebookLMClient
├── notebooks.ts       # NotebooksAPI
├── sources.ts         # SourcesAPI
├── chat.ts            # ChatAPI
├── types.ts           # Domain types (Notebook, Source, etc.)
├── core/
│   ├── auth.ts        # Cookie/token management
│   ├── client.ts      # ClientCore (HTTP + retries)
│   ├── exceptions.ts  # Error hierarchy
│   └── paths.ts, url_utils.ts
├── rpc/
│   ├── types.ts       # RPCMethod enum, constants
│   ├── encoder.ts     # Request encoding
│   └── decoder.ts     # Response decoding
└── cli/
    └── index.ts, helpers.ts
```

### RPC Protocol (batchexecute)
Adding a new RPC method:
1. Add method ID to `RPCMethod` enum in `src/rpc/types.ts`
2. Implement wrapper in appropriate API class
3. Use `this.core.rpcCall(RPCMethod.NEW_METHOD, params)`
4. Add static `fromApiResponse` method to parse results

### Error Handling
All errors extend `NotebookLMError`:
```
NotebookLMError
├── ValidationError, ConfigurationError
├── NetworkError → RPCTimeoutError
├── RPCError → AuthError, RateLimitError, ServerError, ClientError, DecodingError
├── NotebookError → NotebookNotFoundError
├── SourceError → SourceAddError, SourceNotFoundError, SourceProcessingError
└── ArtifactError → ArtifactNotFoundError, ArtifactNotReadyError
```
Pattern: Catch raw errors in `ClientCore`, wrap in typed exceptions, rethrow.

### API Response Parsing
The API returns nested arrays with many nulls. Always use optional chaining:
```typescript
// CORRECT: Safe access with optional chaining
const title = data[0]?.[1] ?? "Untitled";
const items = result?.[0] ?? [];

// WRONG: Direct access (crashes on null/undefined)
const title = data[0][1];
```

### Static Factory Pattern
Domain types use static `fromApiResponse` for parsing:
```typescript
class Notebook {
  static fromApiResponse(data: any): Notebook {
    return new Notebook(
      data[0] ?? "",           // id
      data[1]?.[0]?.[3] ?? "", // title
    );
  }
}
```

## 4. Testing

Tests use Bun's built-in test runner:
```typescript
import { test, expect } from "bun:test";

test("description", () => {
  expect(actual).toEqual(expected);
});
```
- Unit tests in `tests/` directory, naming: `*.test.ts`
- Focus on logic tests (parsers, encoders)
- Manual CLI testing for API integration

## 5. Porting from Python

When porting from `py/` directory:
1. **Maintain logic**: Keep reverse-engineered RPC IDs and parameter structures
2. **Adapt idioms**: Use `map/filter` instead of list comprehensions
3. **Use Bun APIs**: Prefer `Bun.file`, native `fetch` over Node.js equivalents
4. **Ignore Python errors**: `py/` is reference only; ignore LSP errors

## 6. Common Gotchas

### XSSI Prefix
Google responses start with `)]}'\n`. Use `stripAntiXssi` from `src/rpc/decoder.ts`.

### Chunked Responses
Responses are line-delimited JSON chunks (length + data). Use `parseChunkedResponse`.

### Authentication
- Cookie-based: `SID`, `HSID`, etc. + CSRF token (`SNlM0e`)
- Session saved to `~/.notebooklm/storage_state.json`
- Use `AuthTokens.fromStorage()` to load

### Type Safety
- Never use `as any` or `@ts-ignore`
- `noUncheckedIndexedAccess` means array access returns `T | undefined`
- Validate API responses before accessing nested properties
