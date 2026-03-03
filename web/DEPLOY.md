# Deployment

Server: `root@82.21.150.93`
App dir: `/home/sankirtanam/sankirtanam/web`
Data dir: `/home/sankirtanam/sankirtanam/web/data` (SQLite DBs, not in git)

## First-time server setup

```bash
# Install Docker, Caddy (already done on this server)

# Create user
useradd -m -s /bin/bash sankirtanam

# Clone repo
su - sankirtanam
git clone https://github.com/108systems/sankirtanam /home/sankirtanam/sankirtanam

# Place SQLite data files
mkdir -p /home/sankirtanam/sankirtanam/web/data
# Copy books_search_eng.db and books_search_rus.db into data/

# Copy .env.local with secrets (BOOKS_MCP_TOKEN etc.)
# /home/sankirtanam/sankirtanam/web/.env.local

# Configure Caddy (global reverse proxy, already set up)
# sankirtan.am → localhost:3108
```

## Deploy (every update)

```bash
ssh root@82.21.150.93
cd /home/sankirtanam/sankirtanam
git pull
cd web
docker compose build
docker compose up -d
```

## Verify

```bash
curl https://sankirtan.am/api/v1/books/search?q=love&lang=eng&limit=1
```

## docker-compose.yml

Located at `web/docker-compose.yml`. Mounts `./data` as `/data/books` (read-write, required for SQLite WAL mode).

## Notes

- SQLite data files are NOT in git — copy manually to `web/data/` on the server
- WAL mode requires the volume to be read-write (not `:ro`)
- `better-sqlite3` native binary is downloaded via `prebuild-install` during Docker build (no build tools needed)
- `serverExternalPackages: ["better-sqlite3"]` in `next.config.ts` ensures the `.node` binary is included in the standalone output
