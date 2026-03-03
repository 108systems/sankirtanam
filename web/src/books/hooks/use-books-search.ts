"use client";

import useSWR from "swr";
import { fetcher } from "@/core/lib/fetcher";

export type BooksTextMode = "full" | "snippet" | "none";
export type BooksLang = "eng" | "rus";

export type BooksSearchHit = {
  id: string;
  score: number;
  book: string;
  song: string;
  chapter: string;
  verse: string;
  translation?: string | null;
  purport?: string | null;
  purportSnippet?: string | null;
  synonyms?: string | null;
  sanskrit?: string | null;
  translit?: string | null;
  purportFullChars?: number | null;
  purportSnippetChars?: number | null;
  purportSkippedChars?: number | null;
  purportCoverage?: number | null;
};

export type BooksSearchResult = {
  mode: "read" | "search" | "filter";
  q: string | null;
  lang: BooksLang;
  count: number;
  limit: number;
  offset: number;
  hits: BooksSearchHit[];
  appliedFilters?: {
    books?: string[];
    song?: string;
    chapter?: string;
    verses?: string[];
    text?: BooksTextMode;
  };
};

type BooksSearchResponse = {
  ok?: boolean;
  error?: string;
  data?: BooksSearchResult;
};

export type BooksCatalogEntry = {
  code: string;
  name: string;
};

export type BooksCatalog = {
  eng: BooksCatalogEntry[];
  rus: BooksCatalogEntry[];
};

type BooksCatalogResponse = {
  ok?: boolean;
  error?: string;
  data?: BooksCatalog;
};

export type BooksSearchParams = {
  q?: string;
  lang: BooksLang;
  limit: number;
  offset: number;
  text: BooksTextMode;
  books?: string[];
  song?: string;
  chapter?: string;
  verses?: string[];
};

const toBooksServiceUrl = (
  path: string,
  searchParams?: URLSearchParams
): string => {
  const url = new URL(path, "http://localhost");
  if (searchParams) {
    url.search = searchParams.toString();
  }
  return `${url.pathname}${url.search}`;
};

const buildBooksSearchUrl = (params: BooksSearchParams): string => {
  const search = new URLSearchParams();

  if (params.q) {
    search.set("q", params.q);
  }

  search.set("lang", params.lang);
  search.set("limit", String(params.limit));
  search.set("offset", String(params.offset));
  search.set("text", params.text);

  if (params.books?.length) {
    search.set("books", params.books.join(","));
  }
  if (params.song) {
    search.set("song", params.song);
  }
  if (params.chapter) {
    search.set("chapter", params.chapter);
  }
  if (params.verses?.length) {
    search.set("verses", params.verses.join(","));
  }

  return toBooksServiceUrl("/api/v1/books/search", search);
};

export function useBooksSearch(params: BooksSearchParams | null) {
  const key = params ? buildBooksSearchUrl(params) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<BooksSearchResponse>(
    key,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );

  return {
    result: data?.data ?? null,
    error,
    isLoading,
    isValidating,
    refresh: mutate,
    key,
  };
}

export function useBooksCatalog() {
  const key = toBooksServiceUrl("/api/v1/books");

  const { data, error, isLoading, isValidating, mutate } = useSWR<BooksCatalogResponse>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    catalog: data?.data ?? null,
    error,
    isLoading,
    isValidating,
    refresh: mutate,
    key,
  };
}
