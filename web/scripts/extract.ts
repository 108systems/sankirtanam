import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { once } from "node:events";

type Language = "eng" | "rus";

type RawRow = {
  book?: unknown;
  song?: unknown;
  chapter?: unknown;
  verse?: unknown;
  row_id?: unknown;
  sanskrit?: unknown;
  translit?: unknown;
  translit_search?: unknown;
  synonyms?: unknown;
  translation?: unknown;
  purport?: unknown;
};

type ExtractedRow = {
  id: string;
  t: string;
  p: string;
  sy: string;
  sa: string;
  tr: string;
  ts: string;
};

const SQL_QUERY = `
  SELECT
    b.web_abbrev as book,
    CAST(t.song AS TEXT) as song,
    CAST(t.ch_no AS TEXT) as chapter,
    t.txt_no as verse,
    t._id as row_id,
    t.text_seq_no as text_seq_no,
    tx.sanskrit as sanskrit,
    tx.translit as translit,
    tx.translit_srch as translit_search,
    tx.transl1 as synonyms,
    tx.transl2 as translation,
    tx.comment as purport
  FROM textnums t
  JOIN books b ON t.book_id = b._id
  LEFT JOIN texts tx ON t._id = tx._id
  ORDER BY b._id, t.song, t.ch_no, t.text_seq_no, t._id
`;

const LEGACY_PRIVATE_USE_MAP: Record<string, string> = {
  "\uF101": "а",
  "\uF103": "д",
  "\uF105": "о",
  "\uF107": "л",
  "\uF109": "м",
  "\uF10D": "м",
  "\uF10F": "н",
  "\uF111": "н",
  "\uF113": "н",
  "\uF115": "р",
  "\uF117": "р",
  "\uF119": "т",
  "\uF11B": "х",
  "\uF11D": "ш",
};

const DB_DIR = path.resolve(
  process.cwd(),
  process.env.BOOKS_DB_DIR?.trim() || "data"
);
const SOURCE_DIR = path.resolve(
  process.cwd(),
  process.env.BOOKS_SOURCE_DIR?.trim() || "data"
);

const DB_FILE_BY_LANG: Record<Language, string> = {
  eng: process.env.BOOKS_DB_FILE_ENG?.trim() || "gitabase_texts_eng.db",
  rus: process.env.BOOKS_DB_FILE_RUS?.trim() || "gitabase_texts_rus.db",
};

const JSONL_FILE_BY_LANG: Record<Language, string> = {
  eng: process.env.BOOKS_JSONL_FILE_ENG?.trim() || "nectar_eng.jsonl",
  rus: process.env.BOOKS_JSONL_FILE_RUS?.trim() || "nectar_rus.jsonl",
};

const normalizePart = (value: unknown, fallback: string): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : fallback;
};

const cleanHtml = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }

  const stripped = value
    .replace(/<img[^>]*>/gi, "")
    .replace(/<a[^>]*>(.*?)<\/a>/gi, "$1")
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/?(i|b|em|strong|br|u)>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  const namedEntityMap: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " ",
    ndash: "-",
    mdash: "-",
    rsquo: "'",
    lsquo: "'",
    rdquo: "\"",
    ldquo: "\"",
    hellip: "...",
    laquo: "\"",
    raquo: "\"",
  };

  return stripped.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);?/g,
    (match: string, entity: string) => {
      if (entity[0] === "#") {
        const isHex = entity[1]?.toLowerCase() === "x";
        const num = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (Number.isFinite(num) && num > 0) {
          return String.fromCodePoint(num);
        }
        return match;
      }

      const key = entity.toLowerCase();
      return namedEntityMap[key] ?? match;
    }
  );
};

const normalizeLegacyPrivateUse = (value: string): string =>
  value.replace(/[\uE000-\uF8FF]/g, (char) => LEGACY_PRIVATE_USE_MAP[char] ?? "");

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

const queryRows = (dbPath: string): RawRow[] => {
  try {
    // Dynamic require keeps compatibility when node:sqlite is unavailable.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = eval("require") as (id: string) => unknown;
    const sqliteModule = req("node:sqlite") as {
      DatabaseSync: new (
        path: string,
        options?: { open?: boolean }
      ) => {
        prepare: (query: string) => { all: () => unknown[] };
      };
    };

    const db = new sqliteModule.DatabaseSync(dbPath, { open: true });
    const query = db.prepare(SQL_QUERY);
    return query.all() as RawRow[];
  } catch {
    const stdout = execFileSync("sqlite3", ["-json", dbPath, SQL_QUERY], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 1024,
    });
    return JSON.parse(stdout) as RawRow[];
  }
};

const buildRows = (rows: RawRow[]): ExtractedRow[] => {
  const statsByBook = new Map<
    string,
    {
      rows: number;
      chapterZero: number;
      chapterNonNumeric: number;
      verseZero: number;
      verseGenerated: number;
    }
  >();

  const processed = rows.map((row) => {
    const book = normalizePart(row.book, "UNK");
    const song = normalizePart(row.song, "0");
    const chapter = normalizePart(row.chapter, "0");
    const verse = normalizePart(row.verse, `ROW${normalizePart(row.row_id, "X")}`);

    const stat = statsByBook.get(book) ?? {
      rows: 0,
      chapterZero: 0,
      chapterNonNumeric: 0,
      verseZero: 0,
      verseGenerated: 0,
    };

    stat.rows += 1;
    if (chapter === "0") stat.chapterZero += 1;
    if (!/^-?\d+$/.test(chapter)) stat.chapterNonNumeric += 1;
    if (verse === "0") stat.verseZero += 1;
    if (verse.startsWith("ROW")) stat.verseGenerated += 1;
    statsByBook.set(book, stat);

    return {
      id: `${book}-${song}-${chapter}-${verse}`,
      t: cleanHtml(row.translation),
      p: cleanHtml(row.purport),
      sy: normalizeLegacyPrivateUse(cleanHtml(row.synonyms)),
      sa: cleanHtml(row.sanskrit),
      tr: normalizeLegacyPrivateUse(cleanHtml(row.translit)),
      ts: normalizeLegacyPrivateUse(cleanHtml(row.translit_search)),
    };
  });

  console.log("Parsing audit by book:");
  for (const [book, stat] of [...statsByBook.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(
      `  ${book}: rows=${stat.rows}, chapterZero=${stat.chapterZero}, chapterNonNumeric=${stat.chapterNonNumeric}, verseZero=${stat.verseZero}, verseGenerated=${stat.verseGenerated}`
    );
  }

  return processed;
};

const writeJsonl = async (outPath: string, rows: ExtractedRow[]): Promise<void> => {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const file = fs.createWriteStream(outPath);
  for (const row of rows) {
    file.write(`${JSON.stringify(row)}\n`);
  }
  file.end();
  await once(file, "finish");
};

const extractLanguage = async (lang: Language): Promise<void> => {
  const dbPath = path.resolve(DB_DIR, DB_FILE_BY_LANG[lang]);
  const outPath = path.resolve(SOURCE_DIR, JSONL_FILE_BY_LANG[lang]);

  console.log(`Extracting ${lang.toUpperCase()} from ${dbPath}...`);
  const rows = queryRows(dbPath);
  console.log(`Fetched ${rows.length} rows from DB.`);

  const processed = buildRows(rows);
  console.log(`Writing ${processed.length} rows to ${outPath}...`);
  await writeJsonl(outPath, processed);
  console.log(`Done: ${outPath}`);
};

const main = async () => {
  console.log(`Books DB dir: ${DB_DIR}`);
  console.log(`Books JSONL dir: ${SOURCE_DIR}`);

  const langs = parseLanguages();
  for (const lang of langs) {
    await extractLanguage(lang);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
