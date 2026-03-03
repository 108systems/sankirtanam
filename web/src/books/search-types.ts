export type Language = "eng" | "rus";

export type BooksQueryMode = "read" | "search" | "filter";

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

export type BooksQueryResult = {
  mode: BooksQueryMode;
  q: string | null;
  lang: Language;
  count: number;
  limit: number;
  offset: number;
  hits: BooksSearchHit[];
  appliedFilters: {
    books?: string[];
    song?: string;
    chapter?: string;
    verses?: string[];
    text?: "full" | "snippet" | "none";
  };
};
