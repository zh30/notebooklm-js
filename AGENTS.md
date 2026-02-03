# Agent Guidelines for notebooklm-js

This repository contains a TypeScript/Bun client for Google NotebookLM, ported from `notebooklm-py`.
It provides both a library (`src/client.ts`) and a CLI (`src/cli/index.ts`).

## 1. Environment & Commands

This project uses **Bun** as the runtime and package manager.

- **Install Dependencies**:
  ```bash
  bun install
  ```
- **Run Tests**:
  ```bash
  bun test                    # Run all tests
  bun test tests/rpc.test.ts  # Run specific file
  bun test -t "encode"        # Run tests matching pattern
  ```
- **Type Check**:
  ```bash
  bun run check               # Runs tsc --noEmit
  ```
- **Lint & Format**:
  ```bash
  bun run lint                # Runs biome check
  bun run format              # Runs biome format --write
  ```
- **Run CLI**:
  ```bash
  bun run cli <command>       # e.g., bun run cli list
  bun run cli login           # Launch browser for auth
  ```

## 2. Code Style & Standards

### Formatting and Linting
- **Biome** is the single source of truth.
- **Strict Rule**: Always run `bun run format` and `bun run lint` before committing.
- Do not use Prettier or ESLint.

### TypeScript Configuration
- **Strict Mode**: Enabled (`strict: true`). No implicit `any`.
- **Target**: `ESNext`. Use modern features (e.g., top-level await, native `fetch`).
- **Imports**:
  - Use `import type` for type definitions (`verbatimModuleSyntax` is enabled).
  - Prefer named exports over default exports.

### Naming Conventions
- **Files**: `kebab-case` (e.g., `url-utils.ts`) or `camelCase` matching exports.
- **Classes**: `PascalCase` (e.g., `NotebookLMClient`).
- **Interfaces/Types**: `PascalCase` (e.g., `Notebook`, `Source`).
- **Variables/Functions**: `camelCase` (e.g., `getHomeDir`, `rpcCall`).
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `BATCHEXECUTE_URL`).

## 3. Architecture & Patterns

### Directory Structure
- `src/client.ts`: Main entry point. Exposes `NotebooksAPI`, `SourcesAPI`, `ChatAPI`.
- `src/core/`: Infrastructure.
  - `auth.ts`: Cookie/token management.
  - `client.ts`: `ClientCore` handles HTTP requests and retries.
  - `exceptions.ts`: Custom error hierarchy.
- `src/rpc/`: Protocol layer.
  - `types.ts`: `RPCMethod` enum and data types.
  - `encoder.ts`: Encodes requests into `batchexecute` format.
  - `decoder.ts`: Decodes chunked JSON responses.
- `src/cli/`: Command-line interface.

### RPC Protocol
The client communicates via Google's `batchexecute` protocol.
- **Adding a new method**:
  1. Add the method ID to `RPCMethod` enum in `src/rpc/types.ts`.
  2. Implement the wrapper method in the appropriate API class (e.g., `NotebooksAPI`).
  3. Use `this.core.rpcCall(RPCMethod.NEW_METHOD, params)` to execute.
  4. Create a static `fromApiResponse` method in the return type class to parse the result.

### Authentication
- **Mechanism**: Cookie-based authentication (`SID`, `HSID`, etc.) + CSRF token (`SNlM0e`).
- **Login Flow**:
  - CLI uses `playwright` to launch a persistent browser context.
  - User logs in manually via Google.
  - Session cookies are saved to `~/.notebooklm/storage_state.json`.
  - Library loads this state via `AuthTokens.fromStorage()`.

### Error Handling
- All errors extend `NotebookLMError`.
- **Hierarchy**:
  - `NotebookLMError`
    - `NetworkError` (fetch failures)
    - `RPCError` (API errors)
      - `AuthError` (401/403)
      - `RateLimitError` (429)
    - `NotebookNotFoundError`
    - `SourceError`
- **Pattern**: Catch raw errors in `ClientCore`, wrap them in typed exceptions, and rethrow.

## 4. Porting Guidelines
When porting code from the `py/` directory:
1. **Maintain Logic**: Keep the reverse-engineered logic (RPC IDs, parameter structures) intact.
2. **Adapt Idioms**: Use TypeScript idioms (e.g., `map/filter` instead of list comprehensions).
3. **Dependencies**: Use `bun` native APIs (`Bun.file`, `fetch`) instead of Node.js `fs` or `axios` where appropriate.
4. **Ignore Python Errors**: The `py/` directory is for reference only; ignore LSP errors in `.py` files.

## 5. Development Workflow
1. **Analyze**: Read relevant `py/` files to understand the original implementation.
2. **Implement**: Write TypeScript code in `src/`.
3. **Test**:
   - Write unit tests for logic (e.g., parsers).
   - Use `bun run cli` to manually verify integration with the real API.
4. **Verify**: Run `bun run check` and `bun run lint`.

## 6. Common Issues
- **XSSI Prefix**: Google responses start with `)]}'`. Use `stripAntiXssi` from `src/rpc/decoder.ts`.
- **Chunked Responses**: Responses are line-delimited JSON chunks. Use `parseChunkedResponse`.
- **Undefined Properties**: The API returns nested arrays with many nulls. Always check array length and existence before accessing indices (e.g., `data[0]?.[1]`).
