# NotebookLM TypeScript Client

A TypeScript client for Google NotebookLM, ported from `notebooklm-py`.

## Installation

```bash
bun install
```

## Usage

### CLI

The CLI provides commands to manage notebooks, sources, and chat.

```bash
# Login (opens browser)
bun run cli login

# List notebooks
bun run cli list

# Select a notebook
bun run cli use <notebook_id>

# Chat
bun run cli chat "What is this notebook about?"

# Add source
bun run cli source add "https://example.com"
```

### Library

```typescript
import { NotebookLMClient } from "./src/client";

async function main() {
  const client = await NotebookLMClient.fromStorage(); // Loads from ~/.notebooklm/storage_state.json
  
  const notebooks = await client.notebooks.list();
  console.log(notebooks);
  
  const result = await client.chat.ask(notebooks[0].id, "Summarize this");
  console.log(result.answer);
}
```

## Authentication

Authentication is handled via browser automation (Playwright).
Run `bun run cli login` to open a browser window, log in to Google, and save your session.
The session is saved to `~/.notebooklm/storage_state.json`.

## Development

```bash
# Run tests
bun test

# Type check
bun run check
```
