import type { BooksQuery } from "./api-schema";
import {
  queryBooksSqlite,
  warmBooksDataSqlite,
} from "./search-books-sqlite";
import type {
  BooksQueryMode,
  BooksQueryResult,
  BooksSearchHit,
  Language,
} from "./search-types";

export type { BooksQueryMode, BooksQueryResult, BooksSearchHit, Language };

export const queryBooks = async (query: BooksQuery): Promise<BooksQueryResult> =>
  queryBooksSqlite(query);

export const warmBooksData = async (
  langs: Language[] = ["eng", "rus"]
): Promise<void> => warmBooksDataSqlite(langs);
