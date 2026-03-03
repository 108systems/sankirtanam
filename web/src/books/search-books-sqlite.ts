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

type HitWithId = {
  id: string;
  score: number;
};

type ClauseSearchResult<THit extends HitWithId> = {
  hits: THit[];
};

type ClauseSearchFn<THit extends HitWithId> = (params: {
  clause: string;
  limit: number;
  offset: number;
}) => Promise<ClauseSearchResult<THit>>;

type ExploreConfig = {
  batchSize: number;
  maxRounds: number;
  targetUnique: number;
  minGainRatio: number;
  lowGainRoundsBeforeStop: number;
  rrfK: number;
  secondaryClauseWeight: number;
};

type ParsedClause = {
  query: string;
  weight: number;
};

type ClauseState = ParsedClause & {
  offset: number;
  exhausted: boolean;
  lowGainStreak: number;
};

type CandidateState<THit extends HitWithId> = {
  hit: THit;
  ranksByClause: Map<string, number>;
};

const DEFAULT_EXPLORE_CONFIG: ExploreConfig = {
  batchSize: 30,
  maxRounds: 8,
  targetUnique: 360,
  minGainRatio: 0.1,
  lowGainRoundsBeforeStop: 2,
  rrfK: 60,
  secondaryClauseWeight: 0.85,
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

const dedupePreserveOrder = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
};

const parseQueryClauses = (query: string): ParsedClause[] => {
  const raw = query.trim();
  if (!raw) return [];

  const parts = raw.includes("||")
    ? raw
        .split("||")
        .map((part) => part.trim())
        .filter(Boolean)
    : [raw];
  const clauses = dedupePreserveOrder(parts);

  return clauses.map((part, index) => ({
    query: part,
    weight: index === 0 ? 1 : DEFAULT_EXPLORE_CONFIG.secondaryClauseWeight,
  }));
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

const toWhereClause = (
  query: BooksQuery,
  options?: { withQ?: boolean; qOverride?: string }
): string => {
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

  const effectiveQ = options?.qOverride ?? query.q;
  if (options?.withQ && effectiveQ) {
    conditions.unshift(`verses_fts MATCH ${sqlQuote(effectiveQ)}`);
  }

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

const runAdaptiveFusionSearch = async <THit extends HitWithId>(options: {
  query: string;
  limit: number;
  offset: number;
  searchClause: ClauseSearchFn<THit>;
  baselineCount?: number;
  config?: Partial<ExploreConfig>;
}): Promise<{ count: number; hits: THit[] }> => {
  const config: ExploreConfig = {
    ...DEFAULT_EXPLORE_CONFIG,
    ...(options.config ?? {}),
  };
  config.targetUnique = Math.max(config.targetUnique, options.limit + options.offset);

  const parsedClauses = parseQueryClauses(options.query);
  if (parsedClauses.length === 0) return { count: 0, hits: [] };

  const clauseStates: ClauseState[] = parsedClauses.map((clause) => ({
    ...clause,
    offset: 0,
    exhausted: false,
    lowGainStreak: 0,
  }));

  const candidates = new Map<string, CandidateState<THit>>();
  let round = 0;

  while (round < config.maxRounds) {
    const active = clauseStates.filter((state) => !state.exhausted);
    if (active.length === 0 || candidates.size >= config.targetUnique) break;

    const results = await Promise.all(
      active.map((state) =>
        options.searchClause({
          clause: state.query,
          limit: config.batchSize,
          offset: state.offset,
        })
      )
    );

    for (let clauseIndex = 0; clauseIndex < active.length; clauseIndex += 1) {
      const state = active[clauseIndex];
      const hits = results[clauseIndex].hits;
      const baseRank = state.offset;
      let newIds = 0;

      for (let i = 0; i < hits.length; i += 1) {
        const hit = hits[i];
        const rank = baseRank + i + 1;
        const existing = candidates.get(hit.id);

        if (!existing) {
          newIds += 1;
          const ranksByClause = new Map<string, number>();
          ranksByClause.set(state.query, rank);
          candidates.set(hit.id, { hit, ranksByClause });
          continue;
        }

        const currentRank = existing.ranksByClause.get(state.query);
        if (!currentRank || rank < currentRank) {
          existing.ranksByClause.set(state.query, rank);
        }
        if (hit.score > existing.hit.score) {
          existing.hit = hit;
        }
      }

      const gainRatio = hits.length > 0 ? newIds / hits.length : 0;
      state.offset += hits.length;

      if (hits.length < config.batchSize) {
        state.exhausted = true;
        continue;
      }

      if (gainRatio < config.minGainRatio) {
        state.lowGainStreak += 1;
      } else {
        state.lowGainStreak = 0;
      }
      if (state.lowGainStreak >= config.lowGainRoundsBeforeStop) {
        state.exhausted = true;
      }
    }

    round += 1;
  }

  const weightByClause = new Map<string, number>(
    parsedClauses.map((clause) => [clause.query, clause.weight])
  );

  const fused = [...candidates.values()]
    .map((candidate) => {
      let fusedScore = 0;
      for (const [clause, rank] of candidate.ranksByClause.entries()) {
        const weight = weightByClause.get(clause) ?? 1;
        fusedScore += weight / (config.rrfK + rank);
      }
      return {
        ...candidate.hit,
        score: fusedScore,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.id).localeCompare(String(b.id));
    });

  return {
    count: Math.max(options.baselineCount ?? 0, fused.length),
    hits: fused.slice(options.offset, options.offset + options.limit),
  };
};

const countClauseMatches = (query: BooksQuery, clause: string): number => {
  const where = toWhereClause(query, { withQ: true, qOverride: clause });
  const countSql = `
    SELECT COUNT(*) AS count
    FROM verses_fts
    JOIN verses v ON v.id = verses_fts.id
    ${where};
  `;
  return Number((runQuery<{ count: number }>(query.lang, countSql))[0]?.count ?? 0);
};

const searchClausePage = (
  query: BooksQuery,
  clause: string,
  limit: number,
  offset: number
): BooksSearchHit[] => {
  const where = toWhereClause(query, { withQ: true, qOverride: clause });
  const dataSql = `
    SELECT
      v.id AS id, v.book AS book, v.song AS song, v.chapter AS chapter,
      v.verse AS verse, v.t AS t, v.p AS p, v.sy AS sy, v.sa AS sa, v.tr AS tr,
      bm25(verses_fts, 1.0, 0.8, 0.3, 0.2, 0.2, 0.2) AS rank
    FROM verses_fts
    JOIN verses v ON v.id = verses_fts.id
    ${where}
    ORDER BY rank ASC, v.id ASC
    LIMIT ${limit} OFFSET ${offset};
  `;
  return runQuery<SqlVerseRow>(query.lang, dataSql).map((row) =>
    toHitWithText(row, "none")
  );
};

const loadRowsByIds = (lang: Language, ids: string[]): SqlVerseRow[] => {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const sql = `
    SELECT
      v.id AS id, v.book AS book, v.song AS song, v.chapter AS chapter,
      v.verse AS verse, v.t AS t, v.p AS p, v.sy AS sy, v.sa AS sa, v.tr AS tr
    FROM verses v
    WHERE v.id IN (${uniqueIds.map(sqlQuote).join(", ")});
  `;
  return runQuery<SqlVerseRow>(lang, sql);
};

const mergeHydratedHits = (
  baseHits: BooksSearchHit[],
  hydratedHits: BooksSearchHit[]
): BooksSearchHit[] => {
  const hydratedById = new Map<string, BooksSearchHit>(
    hydratedHits.map((hit) => [hit.id, hit])
  );

  return baseHits.map((hit) => {
    const hydrated = hydratedById.get(hit.id);
    if (!hydrated) return hit;

    return {
      ...hit,
      translation: hydrated.translation,
      purport: hydrated.purport,
      purportSnippet: hydrated.purportSnippet,
      synonyms: hydrated.synonyms,
      sanskrit: hydrated.sanskrit,
      translit: hydrated.translit,
      purportFullChars: hydrated.purportFullChars,
      purportSnippetChars: hydrated.purportSnippetChars,
      purportSkippedChars: hydrated.purportSkippedChars,
      purportCoverage: hydrated.purportCoverage,
    };
  });
};

const searchByQuery = async (query: BooksQuery & { q: string }): Promise<BooksQueryResult> => {
  const clauses = parseQueryClauses(query.q);
  if (clauses.length === 0) {
    return {
      mode: "search",
      q: query.q,
      lang: query.lang,
      count: 0,
      limit: query.limit,
      offset: query.offset,
      hits: [],
      appliedFilters: toAppliedFilters(query),
    };
  }

  const clauseCounts = clauses.map((clause) => countClauseMatches(query, clause.query));
  const baselineCount = clauseCounts.length > 0 ? Math.max(...clauseCounts) : 0;
  const textMode = query.text ?? "snippet";

  if (baselineCount === 0) {
    return {
      mode: "search",
      q: query.q,
      lang: query.lang,
      count: 0,
      limit: query.limit,
      offset: query.offset,
      hits: [],
      appliedFilters: toAppliedFilters(query),
    };
  }

  const fused = await runAdaptiveFusionSearch<BooksSearchHit>({
    query: query.q,
    limit: query.limit,
    offset: query.offset,
    baselineCount,
    searchClause: async ({ clause, limit, offset }) => ({
      hits: searchClausePage(query, clause, limit, offset),
    }),
  });

  if (textMode === "none" || fused.hits.length === 0) {
    return {
      mode: "search",
      q: query.q,
      lang: query.lang,
      count: fused.count,
      limit: query.limit,
      offset: query.offset,
      hits: fused.hits,
      appliedFilters: toAppliedFilters(query),
    };
  }

  const rows = loadRowsByIds(query.lang, fused.hits.map((hit) => hit.id));
  const hydrated = rows.map((row) =>
    toHitWithText(row, textMode, textMode === "snippet" ? query.q : undefined)
  );
  const hits = mergeHydratedHits(fused.hits, hydrated);

  return {
    mode: "search",
    q: query.q,
    lang: query.lang,
    count: fused.count,
    limit: query.limit,
    offset: query.offset,
    hits,
    appliedFilters: toAppliedFilters(query),
  };
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
