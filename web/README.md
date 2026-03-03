# books-next

Next.js books service with:
- REST API (`/api/v1/books/search`, `/api/v1/books`)
- MCP endpoint (`/api/mcp`)
- shadcn UI on `/` and `/books`
- built-in themes via `next-themes`: `light`, `dark`, `mayapur`, `sanyasa`, `bhakti`

Search backend is SQLite only.

## Runtime data

Set one env var:

```bash
BOOKS_DATA_DIR=./data
```

Optional MCP auth token:

```bash
BOOKS_MCP_TOKEN=change-me
```

Expected files in `BOOKS_DATA_DIR`:
- `books_search_eng.db`
- `books_search_rus.db`

## Local run

```bash
cd /Users/tim/Projects/astrology-new/books-next
pnpm install
pnpm dev
```

Open:
- `http://localhost:3108/`

## Build scripts

```bash
pnpm extract:db
pnpm build:sqlite
```

Defaults read/write under `./data`.

## Production (standalone)

```bash
pnpm build
node .next/standalone/server.js
```

## Docker

Build:

```bash
docker build -t books-next:local .
```

Run with mounted DB directory:

```bash
docker run --rm -p 3108:3108 \
  -e BOOKS_DATA_DIR=/data/books \
  -v /Users/tim/Projects/astrology-new/books-next/data:/data/books:ro \
  books-next:local
```
