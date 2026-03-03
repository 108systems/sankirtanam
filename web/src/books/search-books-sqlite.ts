import Database from "better-sqlite3";
import path from "node:path";
import type { BooksQuery } from "./api-schema";
import { logger } from "./logger";
import type { BooksQueryResult, BooksSearchHit, Language } from "./search-types";

const log = logger.child({ module: "books-next/search-books-sqlite" });

const DEFAULT_BOOKS_DATA_DIR = path.resolve(process.cwd(), "data");
const SQLITE_FILE_BY_LANG: Record<Language, string> = {
  eng: "books_search_eng.db",
  rus: "books_search_rus.db",
};

type SqlVerseRow = {
  id: string;
  book: string;
  song: string;
  chapter: string;
  verse: string;
  t: string;
  p: string;
  sy: string;
  sa: string;
  tr: string;
  rank?: number;
};

const resolveBooksDataDir = (): string =>
  process.env.BOOKS_DATA_DIR?.trim() || DEFAULT_BOOKS_DATA_DIR;

const resolveSqlitePath = (lang: Language): string =>
  path.resolve(resolveBooksDataDir(), SQLITE_FILE_BY_LANG[lang]);

const dbCache: Partial<Record<Language, Database.Database>> = {};

const getDb = (lang: Language): Database.Database => {
  if (!dbCache[lang]) {
    const dbPath = resolveSqlitePath(lang);
    dbCache[lang] = new Database(dbPath);
  }
  return dbCache[lang]!;
};

const runQuery = <T>(lang: Language, sql: string): T[] => {
  try {
    return getDb(lang).prepare(sql).all() as T[];
  } catch (error) {
    log.error({ error, lang, sql }, "sqlite query failed");
    throw new Error("BOOKS_SQLITE_QUERY_FAILED");
  }
};

const sqlQuote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const normalizeFilterToken = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLocaleUpperCase("ru-RU") : null;
};

const normalizeVerses = (verses?: string[]): string[] => {
  if (!verses?.length) return [];
  return [...new Set(verses.map((v) => v.trim()).filter(Boolean))];
};

const toAppliedFilters = (query: BooksQuery): BooksQueryResult["appliedFilters"] => {
  const filters: BooksQueryResult["appliedFilters"] = {};
  if (query.books?.length) filters.books = [...query.books];
  if (query.song) filters.song = query.song;
  if (query.chapter) filters.chapter = query.chapter;
  const verses = normalizeVerses(query.verses);
  if (verses.length) filters.verses = verses;
  if (query.text) filters.text = query.text;
  return filters;
};

const toWhereClause = (query: BooksQuery, options?: { withQ?: boolean }): string => {
  const conditions: string[] = [];

  const books = (query.books ?? [])
    .map((v) => normalizeFilterToken(v))
    .filter((v): v is string => Boolean(v));
  if (books.length > 0) conditions.push(`v.book IN (${books.map(sqlQuote).join(", ")})`);

  const song = normalizeFilterToken(query.song);
  if (song) conditions.push(`UPPER(v.song) = ${sqlQuote(song)}`);

  const chapter = normalizeFilterToken(query.chapter);
  if (chapter) conditions.push(`UPPER(v.chapter) = ${sqlQuote(chapter)}`);

  const verses = normalizeVerses(query.verses);
  if (verses.length > 0) conditions.push(`v.id IN (${verses.map(sqlQuote).join(", ")})`);

  if (options?.withQ && query.q) conditions.unshift(`verses_fts MATCH ${sqlQuote(query.q)}`);

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
};

const normalizeForSnippet = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ru-RU");

const toSnippetTokens = (query: string): string[] =>
  [...new Set(normalizeForSnippet(query).split(/[^a-z0-9а-яё]+/i).filter((v) => v.length >= 2))];

const buildPurportSnippet = (purport: string, query: string) => {
  const fullChars = purport.length;
  const tokens = toSnippetTokens(query);
  const normalizedPurport = normalizeForSnippet(purport);

  let start = 0;
  for (const token of tokens) {
    const idx = normalizedPurport.indexOf(token);
    if (idx >= 0) { start = idx; break; }
  }

  const windowStart = Math.max(0, start - 220);
  const windowEnd = Math.min(purport.length, start + 460);
  const raw = purport.slice(windowStart, windowEnd).trim();
  const snippetChars = raw.length;
  const skippedChars = Math.max(0, fullChars - snippetChars);

  return {
    text: skippedChars > 0 ? `${raw}\n(${skippedChars} chars skipped)` : raw,
    fullChars,
    snippetChars,
    skippedChars,
    coverage: fullChars > 0 ? Number((snippetChars / fullChars).toFixed(2)) : 0,
  };
};

const toHitWithText = (
  row: SqlVerseRow,
  textMode: NonNullable<BooksQuery["text"]>,
  snippetQuery?: string
): BooksSearchHit => {
  const base: BooksSearchHit = {
    id: row.id,
    score: row.rank === undefined ? 0 : Number((-row.rank).toFixed(8)),
    book: row.book,
    song: row.song,
    chapter: row.chapter,
    verse: row.verse,
  };

  if (textMode === "none") return base;

  const translation = row.t || null;
  const purport = row.p || null;
  const includeOriginal = textMode === "full";

  if (textMode === "snippet" && snippetQuery && purport) {
    const snippet = buildPurportSnippet(purport, snippetQuery);
    return {
      ...base,
      translation,
      purport: null,
      purportSnippet: snippet.text,
      synonyms: includeOriginal ? row.sy || null : null,
      sanskrit: includeOriginal ? row.sa || null : null,
      translit: includeOriginal ? row.tr || null : null,
      purportFullChars: snippet.fullChars,
      purportSnippetChars: snippet.snippetChars,
      purportSkippedChars: snippet.skippedChars,
      purportCoverage: snippet.coverage,
    };
  }

  const purportFullChars = purport?.length ?? 0;
  return {
    ...base,
    translation,
    purport,
    purportSnippet: null,
    synonyms: includeOriginal ? row.sy || null : null,
    sanskrit: includeOriginal ? row.sa || null : null,
    translit: includeOriginal ? row.tr || null : null,
    purportFullChars: purport ? purportFullChars : null,
    purportSnippetChars: purport ? purportFullChars : null,
    purportSkippedChars: purport ? 0 : null,
    purportCoverage: purport ? 1 : null,
  };
};

const searchByQuery = async (query: BooksQuery & { q: string }): Promise<BooksQueryResult> => {
  const where = toWhereClause(query, { withQ: true });
  const countSql = `
    SELECT COUNT(*) AS count
    FROM verses_fts
    JOIN verses v ON v.id = verses_fts.id
    ${where};
  `;
  const count = Number((runQuery<{ count: number }>(query.lang, countSql))[0]?.count ?? 0);
  const textMode = query.text ?? "snippet";

  if (count === 0) {
    return { mode: "search", q: query.q, lang: query.lang, count: 0, limit: query.limit, offset: query.offset, hits: [], appliedFilters: toAppliedFilters(query) };
  }

  const dataSql = `
    SELECT
      v.id AS id, v.book AS book, v.song AS song, v.chapter AS chapter,
      v.verse AS verse, v.t AS t, v.p AS p, v.sy AS sy, v.sa AS sa, v.tr AS tr,
      bm25(verses_fts, 1.0, 0.8, 0.3, 0.2, 0.2, 0.2) AS rank
    FROM verses_fts
    JOIN verses v ON v.id = verses_fts.id
    ${where}
    ORDER BY rank ASC, v.id ASC
    LIMIT ${query.limit} OFFSET ${query.offset};
  `;
  const hits = runQuery<SqlVerseRow>(query.lang, dataSql).map((row) => toHitWithText(row, textMode, query.q));

  return { mode: "search", q: query.q, lang: query.lang, count, limit: query.limit, offset: query.offset, hits, appliedFilters: toAppliedFilters(query) };
};

const readByVersesOrFilters = async (query: BooksQuery, mode: "read" | "filter"): Promise<BooksQueryResult> => {
  const where = toWhereClause(query);
  const textMode = query.text ?? "snippet";

  const count = Number((runQuery<{ count: number }>(query.lang, `SELECT COUNT(*) AS count FROM verses v ${where};`))[0]?.count ?? 0);

  const dataSql = `
    SELECT v.id AS id, v.book AS book, v.song AS song, v.chapter AS chapter,
      v.verse AS verse, v.t AS t, v.p AS p, v.sy AS sy, v.sa AS sa, v.tr AS tr
    FROM verses v ${where}
    ORDER BY v.id ASC
    LIMIT ${query.limit} OFFSET ${query.offset};
  `;
  const hits = runQuery<SqlVerseRow>(query.lang, dataSql).map((row) => toHitWithText(row, textMode));

  return { mode, q: query.q ?? null, lang: query.lang, count, limit: query.limit, offset: query.offset, hits, appliedFilters: toAppliedFilters(query) };
};

export const queryBooksSqlite = async (query: BooksQuery): Promise<BooksQueryResult> => {
  if (query.q) return searchByQuery({ ...query, q: query.q });
  const verses = normalizeVerses(query.verses);
  if (verses.length > 0) return readByVersesOrFilters({ ...query, q: undefined, verses }, "read");
  return readByVersesOrFilters(query, "filter");
};

export const warmBooksDataSqlite = async (langs: Language[] = ["eng", "rus"]): Promise<void> => {
  for (const lang of langs) getDb(lang);
};
