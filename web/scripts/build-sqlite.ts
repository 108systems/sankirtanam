import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { once } from "node:events";

type Language = "eng" | "rus";

type SourceRow = {
  id?: unknown;
  t?: unknown;
  p?: unknown;
  sy?: unknown;
  sa?: unknown;
  tr?: unknown;
  ts?: unknown;
};

type ParsedId = {
  id: string;
  book: string;
  song: string;
  chapter: string;
  verse: string;
};

type BuildStats = {
  inserted: number;
  skipped: number;
  deduped: number;
};

const SOURCE_DIR = path.resolve(
  process.cwd(),
  process.env.BOOKS_SOURCE_DIR?.trim() || "data"
);
const DATA_DIR = path.resolve(
  process.cwd(),
  process.env.BOOKS_DATA_DIR?.trim() || "data"
);

const JSONL_FILE_BY_LANG: Record<Language, string> = {
  eng: process.env.BOOKS_JSONL_FILE_ENG?.trim() || "nectar_eng.jsonl",
  rus: process.env.BOOKS_JSONL_FILE_RUS?.trim() || "nectar_rus.jsonl",
};

const SQLITE_FILE_BY_LANG: Record<Language, string> = {
  eng: "books_search_eng.db",
  rus: "books_search_rus.db",
};

const parseLanguages = (): Language[] => {
  const args = process.argv.slice(2);
  const requested = (args.length > 0 ? args : [process.env.BOOKS_LANGS ?? "eng,rus"])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const langs: Language[] = [];

  for (const lang of requested) {
    if (lang === "eng" || lang === "rus") {
      if (!langs.includes(lang)) {
        langs.push(lang);
      }
      continue;
    }

    throw new Error(`Unsupported language: ${lang}`);
  }

  return langs.length > 0 ? langs : ["eng", "rus"];
};

const toText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
};

const sqlQuote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const parseSourceId = (rawId: string, fallbackCounter: number): ParsedId => {
  const cleaned = rawId.trim();
  const parts = cleaned.split("-");
  const book = (parts[0] || "UNK").trim().toLocaleUpperCase("ru-RU");
  const song = (parts[1] || "0").trim() || "0";
  const chapter = (parts[2] || "0").trim() || "0";
  const verse = parts.slice(3).join("-").trim() || `ROW-${fallbackCounter}`;
  const id = `${book}-${song}-${chapter}-${verse}`;

  return {
    id,
    book,
    song,
    chapter,
    verse,
  };
};

const openSqliteWriter = async (dbPath: string) => {
  const proc = spawn("sqlite3", [dbPath], {
    stdio: ["pipe", "inherit", "inherit"],
  });

  const write = async (sql: string) => {
    if (!proc.stdin.write(sql)) {
      await once(proc.stdin, "drain");
    }
  };

  await write("PRAGMA journal_mode=WAL;\n");
  await write("PRAGMA synchronous=NORMAL;\n");
  await write("PRAGMA temp_store=MEMORY;\n");
  await write("PRAGMA cache_size=-200000;\n");
  await write("DROP TABLE IF EXISTS verses;\n");
  await write("DROP TABLE IF EXISTS verses_fts;\n");
  await write(
    "CREATE TABLE verses (id TEXT PRIMARY KEY, book TEXT NOT NULL, song TEXT NOT NULL, chapter TEXT NOT NULL, verse TEXT NOT NULL, t TEXT NOT NULL, p TEXT NOT NULL, sy TEXT NOT NULL, sa TEXT NOT NULL, tr TEXT NOT NULL, ts TEXT NOT NULL);\n"
  );
  await write("CREATE INDEX idx_verses_book_song_chapter ON verses(book, song, chapter);\n");
  await write("CREATE INDEX idx_verses_song_chapter ON verses(song, chapter);\n");
  await write(
    "CREATE VIRTUAL TABLE verses_fts USING fts5(id UNINDEXED, book UNINDEXED, song UNINDEXED, chapter UNINDEXED, verse UNINDEXED, t, p, sy, sa, tr, ts, tokenize='unicode61 remove_diacritics 2');\n"
  );
  await write("BEGIN TRANSACTION;\n");

  const close = async () => {
    await write("COMMIT;\n");
    await write("PRAGMA optimize;\n");
    proc.stdin.end();
    const [exitCode] = (await once(proc, "close")) as [number];
    if (exitCode !== 0) {
      throw new Error(`sqlite3 exited with code ${exitCode}`);
    }
  };

  return {
    write,
    close,
  };
};

const buildSqliteForLang = async (lang: Language) => {
  const sourcePath = path.resolve(SOURCE_DIR, JSONL_FILE_BY_LANG[lang]);
  const dbPath = path.resolve(DATA_DIR, SQLITE_FILE_BY_LANG[lang]);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source JSONL not found: ${sourcePath}`);
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath);
  }

  console.log(`Building SQLite for ${lang.toUpperCase()}`);
  console.log(`  source: ${sourcePath}`);
  console.log(`  target: ${dbPath}`);

  const writer = await openSqliteWriter(dbPath);
  const readStream = fs.createReadStream(sourcePath);
  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity,
  });

  const seenIds = new Set<string>();
  const stats: BuildStats = {
    inserted: 0,
    skipped: 0,
    deduped: 0,
  };

  try {
    for await (const line of rl) {
      if (!line.trim()) {
        continue;
      }

      const row = JSON.parse(line) as SourceRow;
      const rawId = toText(row.id);
      const parsed = parseSourceId(rawId, stats.inserted + stats.skipped + 1);

      if (parsed.book === "BG72") {
        stats.skipped += 1;
        continue;
      }

      let finalId = parsed.id;
      let dedupeCounter = 1;
      while (seenIds.has(finalId)) {
        finalId = `${parsed.id}-${dedupeCounter}`;
        dedupeCounter += 1;
      }
      if (finalId !== parsed.id) {
        stats.deduped += 1;
      }
      seenIds.add(finalId);

      const values = {
        id: finalId,
        book: parsed.book,
        song: parsed.song,
        chapter: parsed.chapter,
        verse: parsed.verse,
        t: toText(row.t),
        p: toText(row.p),
        sy: toText(row.sy),
        sa: toText(row.sa),
        tr: toText(row.tr),
        ts: toText(row.ts),
      };

      await writer.write(
        `INSERT INTO verses (id, book, song, chapter, verse, t, p, sy, sa, tr, ts) VALUES (${sqlQuote(
          values.id
        )}, ${sqlQuote(values.book)}, ${sqlQuote(values.song)}, ${sqlQuote(
          values.chapter
        )}, ${sqlQuote(values.verse)}, ${sqlQuote(values.t)}, ${sqlQuote(
          values.p
        )}, ${sqlQuote(values.sy)}, ${sqlQuote(values.sa)}, ${sqlQuote(
          values.tr
        )}, ${sqlQuote(values.ts)});\n`
      );

      await writer.write(
        `INSERT INTO verses_fts (id, book, song, chapter, verse, t, p, sy, sa, tr, ts) VALUES (${sqlQuote(
          values.id
        )}, ${sqlQuote(values.book)}, ${sqlQuote(values.song)}, ${sqlQuote(
          values.chapter
        )}, ${sqlQuote(values.verse)}, ${sqlQuote(values.t)}, ${sqlQuote(
          values.p
        )}, ${sqlQuote(values.sy)}, ${sqlQuote(values.sa)}, ${sqlQuote(
          values.tr
        )}, ${sqlQuote(values.ts)});\n`
      );

      stats.inserted += 1;
      if (stats.inserted % 20000 === 0) {
        console.log(`  inserted: ${stats.inserted}`);
      }
    }
  } finally {
    rl.close();
  }

  await writer.close();

  const sizeBytes = fs.statSync(dbPath).size;
  const sizeMiB = (sizeBytes / 1024 / 1024).toFixed(2);
  console.log(
    `Done ${lang.toUpperCase()}: inserted=${stats.inserted}, skipped=${stats.skipped}, deduped=${stats.deduped}, size=${sizeMiB} MiB`
  );
};

const main = async () => {
  const langs = parseLanguages();
  console.log(`Books source dir: ${SOURCE_DIR}`);
  console.log(`Books sqlite output dir: ${DATA_DIR}`);

  for (const lang of langs) {
    await buildSqliteForLang(lang);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
