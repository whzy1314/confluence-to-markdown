# Confluence to Markdown Converter

Convert Confluence pages to clean Markdown format. Supports both Confluence Cloud and Data Center/Server with a CLI, web UI, and programmatic API.

## Features

- Convert Confluence pages to Markdown via page ID
- Support for both Confluence Cloud and Data Center/Server
- Handles Confluence-specific macros (code blocks, panels, expand, Jira links, etc.)
- YAML front matter with page metadata
- Recursive page tree export
- Clean web UI for browser-based conversion
- CLI for scripting and automation
- Configurable default credentials via environment variables

## Quick Start

```bash
npm install
cp .env.example .env   # edit with your Confluence credentials
npm run build
```

## Usage

### Web UI

```bash
npm start
# Open http://localhost:3000
```

### CLI

Convert a single page:

```bash
npx confluence-to-markdown convert -p PAGE_ID -u https://yoursite.atlassian.net --username you@example.com --token YOUR_TOKEN
```

Export a page tree:

```bash
npx confluence-to-markdown tree -p PAGE_ID -o ./output
```

Test your connection:

```bash
npx confluence-to-markdown test-connection -u https://yoursite.atlassian.net --username you@example.com --token YOUR_TOKEN
```

Options are also read from environment variables (`CONFLUENCE_BASE_URL`, `CONFLUENCE_USERNAME`, `CONFLUENCE_API_TOKEN`, `CONFLUENCE_TYPE`).

### Programmatic API

```typescript
import { ConfluenceClient, ConfluenceConverter } from "confluence-to-markdown";

const client = ConfluenceClient.fromCredentials(
  { baseUrl: "https://yoursite.atlassian.net", username: "you@example.com", apiToken: "token" },
  "cloud"
);

const converter = new ConfluenceConverter({ frontMatter: true });
const page = await client.getPage("12345");
const result = converter.convert(page);
console.log(result.markdown);
```

## Confluence Type

- **Cloud**: `https://yoursite.atlassian.net` - uses API tokens
- **Data Center / Server**: `https://confluence.internal.com` - uses username/password

Set with `--type datacenter` or `CONFLUENCE_TYPE=datacenter`.

## Macro Support

The converter handles these Confluence macros:

| Macro | Markdown Output |
|-------|----------------|
| Code block | Fenced code block with language |
| Noformat | Fenced code block |
| Info/Note/Warning/Tip panels | Blockquote with label |
| Expand | `<details>/<summary>` |
| Jira issue | Inline code with issue key |
| Anchor | HTML anchor tag |
| User mentions | `@username` |
| Status macros | Inline code badge |

Unsupported macros are removed with a warning.

## Development

```bash
npm run dev       # Start dev server with ts-node
npm run cli       # Run CLI with ts-node
npm test          # Run tests
npm run build     # Compile TypeScript
npm run lint      # Type-check without emitting
```

## License

MIT
