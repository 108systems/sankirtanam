"use client";

import { useEffect, useMemo, useState } from "react";
import { InfoIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import {
  type BooksCatalogEntry,
  type BooksLang,
  type BooksSearchHit,
  type BooksSearchParams,
  type BooksTextMode,
  useBooksCatalog,
  useBooksSearch,
} from "@/books/hooks/use-books-search";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { Separator } from "@/core/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/core/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/core/components/ui/sheet";
import { Skeleton } from "@/core/components/ui/skeleton";
import { Spinner } from "@/core/components/ui/spinner";
import { BooksThemeSelect } from "@/books/components/books-theme-select";

const LIMIT_OPTIONS = [5, 10, 20, 30, 50, 100];
const DEFAULT_SUGGESTED_QUERIES = ["Krishna", "family life", "grihastha"];

const trimToOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const formatCoverage = (coverage: number | null | undefined): string => {
  if (coverage === null || coverage === undefined) {
    return "n/a";
  }
  return coverage.toFixed(2);
};

const TextBlock = ({
  label,
  text,
  collapsedChars,
  variant = "default",
}: {
  label: string;
  text?: string | null;
  collapsedChars: number;
  variant?: "default" | "quote" | "plain" | "sanskrit" | "translit" | "translation" | "purport";
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) {
    return null;
  }

  const isLong = text.length > collapsedChars;
  const shownText =
    isLong && !expanded
      ? `${text.slice(0, collapsedChars).trimEnd()}...`
      : text;

  return (
    <div className="mt-2.5 space-y-1 first:mt-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        {label}
      </p>
      {variant === "default" && (
        <div className="rounded-lg bg-secondary/30 p-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
          {shownText}
        </div>
      )}
      {variant === "quote" && (
        <div className="border-l-2 border-primary/40 py-1 pl-3 text-sm italic leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {shownText}
        </div>
      )}
      {variant === "plain" && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
          {shownText}
        </div>
      )}
      {variant === "sanskrit" && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-center font-medium text-foreground/90">
          {shownText}
        </div>
      )}
      {variant === "translit" && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-center italic text-foreground/90">
          {shownText}
        </div>
      )}
      {variant === "translation" && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap font-bold text-foreground">
          {shownText}
        </div>
      )}
      {variant === "purport" && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 text-justify">
          {shownText}
        </div>
      )}
      {isLong ? (
        <Button
          onClick={() => setExpanded((prev) => !prev)}
          size="sm"
          type="button"
          variant="link"
          className="h-auto px-0 text-xs"
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
};

const HitCard = ({
  hit,
  resolveBookName,
}: {
  hit: BooksSearchHit;
  resolveBookName: (code: string) => string;
}) => {
  const bookName = resolveBookName(hit.book);
  const locationParts = [
    hit.song && `Song ${hit.song}`,
    hit.chapter && `Ch ${hit.chapter}`,
    hit.verse && `Vs ${hit.verse}`,
  ].filter(Boolean);

  return (
    <Card className="overflow-hidden transition-colors hover:border-border/80">
      <CardHeader className="flex flex-row items-center border-b border-border/40 bg-muted/20 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            {bookName}
          </Badge>
          {locationParts.length > 0 && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {locationParts.join(" • ")}
              </span>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-1 h-6 w-6 rounded-full hover:bg-secondary/40">
                <InfoIcon className="size-3.5 text-muted-foreground/50 transition-colors hover:text-foreground/80" />
                <span className="sr-only">Metric info</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-[10px] text-card-foreground shadow-sm">
              <div className="flex items-center justify-between gap-6">
                <span className="text-muted-foreground uppercase tracking-wider">Score</span>
                <span className="font-mono">{hit.score.toFixed(3)}</span>
              </div>
              {hit.purportCoverage !== null && hit.purportCoverage !== undefined && (
                <div className="flex items-center justify-between gap-6">
                  <span className="text-muted-foreground uppercase tracking-wider">Coverage</span>
                  <span className="font-mono">{formatCoverage(hit.purportCoverage)}</span>
                </div>
              )}
              {hit.purportFullChars !== null && hit.purportFullChars !== undefined && (
                <>
                  <div className="mt-1 flex items-center justify-between gap-6 border-t border-border/40 pt-1.5">
                    <span className="text-muted-foreground uppercase tracking-wider">Purport Full</span>
                    <span className="font-mono">{hit.purportFullChars}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-muted-foreground uppercase tracking-wider">Purport Snippet</span>
                    <span className="font-mono">{hit.purportSnippetChars ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-muted-foreground uppercase tracking-wider">Purport Skipped</span>
                    <span className="font-mono">{hit.purportSkippedChars ?? 0}</span>
                  </div>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-4 py-3">

        <TextBlock label="Sanskrit" text={hit.sanskrit} collapsedChars={1200} variant="sanskrit" />
        <TextBlock label="Transliteration" text={hit.translit} collapsedChars={1200} variant="translit" />
        <TextBlock label="Synonyms (Word-for-word)" text={hit.synonyms} collapsedChars={1500} variant="plain" />
        <TextBlock label="Translation / Title" text={hit.translation} collapsedChars={900} variant="translation" />
        <TextBlock label="Purport Snippet" text={hit.purportSnippet} collapsedChars={1400} variant="quote" />
        <TextBlock label="Purport" text={hit.purport} collapsedChars={1800} variant="purport" />
      </CardContent>
    </Card>
  );
};

const PaginationControls = ({
  hasPrevPage,
  hasNextPage,
  onPrev,
  onNext,
}: {
  hasPrevPage: boolean;
  hasNextPage: boolean;
  onPrev: () => void;
  onNext: () => void;
}) => {
  return (
    <div className="flex items-center gap-1.5">
      <Button 
        onClick={onPrev} 
        type="button" 
        variant="outline" 
        size="sm"
        disabled={!hasPrevPage}
        className="h-8 rounded-lg px-3 text-xs font-medium shadow-none hover:bg-secondary/40"
      >
        Prev
      </Button>
      <Button 
        onClick={onNext} 
        type="button" 
        variant="outline"
        size="sm"
        disabled={!hasNextPage}
        className="h-8 rounded-lg px-3 text-xs font-medium shadow-none hover:bg-secondary/40"
      >
        Next
      </Button>
    </div>
  );
};

export function BooksExplorer() {
  const [lang, setLang] = useState<BooksLang>("eng");
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [song, setSong] = useState("");
  const [chapter, setChapter] = useState("");
  const [textMode, setTextMode] = useState<BooksTextMode>("full");
  const [limit, setLimit] = useState<number>(20);
  const [submitted, setSubmitted] = useState<BooksSearchParams | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { catalog } = useBooksCatalog();

  const bookEntries = useMemo<BooksCatalogEntry[]>(
    () => (lang === "eng" ? (catalog?.eng ?? []) : (catalog?.rus ?? [])),
    [catalog, lang]
  );
  const allBooks = useMemo(
    () => bookEntries.map((entry) => entry.code),
    [bookEntries]
  );
  const bookNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of catalog?.eng ?? []) {
      map.set(entry.code, entry.name);
    }
    for (const entry of catalog?.rus ?? []) {
      map.set(entry.code, entry.name);
    }
    return map;
  }, [catalog]);

  const selectedSet = useMemo(() => new Set(selectedBooks), [selectedBooks]);

  const { result, error, isLoading, isValidating } = useBooksSearch(submitted);

  useEffect(() => {
    if (allBooks.length === 0) {
      return;
    }

    setSelectedBooks((prev) => {
      const filtered = prev.filter((code) => allBooks.includes(code));
      return filtered.length > 0 ? filtered : allBooks;
    });
  }, [allBooks]);

  const onLanguageChange = (next: BooksLang) => {
    setLang(next);
    setSelectedBooks([]);
  };

  const toggleBook = (bookCode: string, checked: boolean) => {
    setSelectedBooks((prev) => {
      if (checked) {
        return [...new Set([...prev, bookCode])];
      }
      return prev.filter((code) => code !== bookCode);
    });
  };

  const selectAllBooks = () => {
    setSelectedBooks(allBooks);
  };

  const clearAllBooks = () => {
    setSelectedBooks([]);
  };

  const submitSearch = () => {
    const nextParams: BooksSearchParams = {
      q: trimToOptional(q),
      lang,
      limit,
      offset: 0,
      text: textMode,
      books: selectedBooks.length ? selectedBooks : undefined,
      song: trimToOptional(song),
      chapter: trimToOptional(chapter),
    };

    setSubmitted(nextParams);
  };

  const submitSuggestedQuery = (suggestion: string) => {
    setQ(suggestion);
    setSubmitted({
      q: suggestion,
      lang,
      limit,
      offset: 0,
      text: textMode,
      books: selectedBooks.length ? selectedBooks : undefined,
      song: trimToOptional(song),
      chapter: trimToOptional(chapter),
    });
  };

  const movePage = (direction: "next" | "prev") => {
    if (!submitted) {
      return;
    }

    const nextOffset =
      direction === "next"
        ? submitted.offset + submitted.limit
        : Math.max(0, submitted.offset - submitted.limit);

    setSubmitted({
      ...submitted,
      offset: nextOffset,
    });
  };

  const hasNextPage =
    submitted && result ? submitted.offset + submitted.limit < result.count : false;
  const hasPrevPage = submitted ? submitted.offset > 0 : false;

  const renderFilters = (compact: boolean) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={lang} onValueChange={(value) => onLanguageChange(value as BooksLang)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eng">eng</SelectItem>
              <SelectItem value="rus">rus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Text Mode</Label>
          <Select value={textMode} onValueChange={(value) => setTextMode(value as BooksTextMode)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="snippet">snippet</SelectItem>
              <SelectItem value="full">full</SelectItem>
              <SelectItem value="none">none</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-2">
          <Label>Limit</Label>
          <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor={compact ? "books-song-mobile" : "books-song"}>Song</Label>
          <Input
            id={compact ? "books-song-mobile" : "books-song"}
            placeholder="optional"
            value={song}
            onChange={(event) => setSong(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={compact ? "books-chapter-mobile" : "books-chapter"}>Chapter</Label>
          <Input
            id={compact ? "books-chapter-mobile" : "books-chapter"}
            placeholder="optional"
            value={chapter}
            onChange={(event) => setChapter(event.target.value)}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Books</Label>
          <div className="flex items-center gap-1.5">
            <Button onClick={selectAllBooks} size="sm" type="button" variant="outline" className="h-7 text-xs">
              Select all
            </Button>
            <Button onClick={clearAllBooks} size="sm" type="button" variant="outline" className="h-7 text-xs">
              Clear all
            </Button>
          </div>
        </div>

        <div className="grid gap-1.5 rounded-md border p-2.5 sm:grid-cols-2">
          {bookEntries.map(({ code, name }) => {
            const checked = selectedSet.has(code);
            return (
              <label key={code} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-secondary/30">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => toggleBook(code, value === true)}
                />
                <span>{name}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <main className="w-full px-2 py-2 md:px-3 md:py-3 lg:h-screen lg:overflow-hidden">
      <div className="flex flex-col gap-3 lg:h-full">
        <div className="flex justify-end">
          <BooksThemeSelect />
        </div>
        <Card className="lg:hidden">
          <CardContent className="p-3 md:p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input
                id="books-query"
                placeholder='Search books... (e.g. "family life || grihastha")'
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitSearch();
                  }
                }}
              />

              <div className="flex items-end lg:hidden">
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button type="button" variant="outline" className="w-full">
                      <SlidersHorizontalIcon className="size-4" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[90vw] sm:max-w-md">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                      <SheetDescription>
                        Refine corpus, structure level, and text mode.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="overflow-y-auto px-4 pb-4">{renderFilters(true)}</div>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="flex items-end">
                <Button onClick={submitSearch} type="button" className="w-full">
                  {isLoading || isValidating ? (
                    <Spinner className="size-4" />
                  ) : (
                    <SearchIcon className="size-4" />
                  )}
                  Search
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="hidden flex-col gap-3 lg:flex lg:h-full lg:min-h-0">
            <CardHeader className="px-4 pb-2">
              <CardTitle className="text-xl">Filters</CardTitle>
              <CardDescription>
                All books are selected by default. Use filters to narrow results.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 lg:min-h-0 lg:overflow-y-auto">
              {renderFilters(false)}
            </CardContent>
          </Card>

          <Card className="flex flex-col gap-2 lg:h-full lg:min-h-0">
            <CardHeader className="shrink-0 px-4 pb-0">
              <div className="hidden gap-3 lg:grid lg:grid-cols-[1fr_auto]">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="books-query-desktop"
                    placeholder='Search books... (e.g. "family life || grihastha")'
                    className="h-10 w-full rounded-xl bg-background/50 pl-9 shadow-sm focus-visible:bg-background"
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        submitSearch();
                      }
                    }}
                  />
                </div>
                <Button onClick={submitSearch} type="button" className="h-10 rounded-xl px-6 shadow-sm">
                  {isLoading || isValidating ? (
                    <Spinner className="mr-2 size-4" />
                  ) : null}
                  Search
                </Button>
              </div>

              <div className="flex min-h-[36px] flex-wrap items-center justify-between gap-4 py-0.5">
                {!result && !isLoading ? (
                  <p className="text-sm font-medium text-muted-foreground/60">
                    Ready to explore corpus.
                  </p>
                ) : result ? (
                  <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground/70">
                    <span className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2.5 py-1 text-foreground/80">
                      <strong className="font-semibold text-foreground">{result.count}</strong>
                      hits
                    </span>
                    {result.count > 0 && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span>
                          Showing{" "}
                          <span className="font-semibold text-foreground/80">{result.offset + 1}</span>
                          {" – "}
                          <span className="font-semibold text-foreground/80">{Math.min(result.offset + result.limit, result.count)}</span>
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <div />
                )}

                <div className="flex justify-end empty:hidden">
                  {(hasPrevPage || hasNextPage) && (
                    <PaginationControls
                      hasPrevPage={hasPrevPage}
                      hasNextPage={hasNextPage}
                      onPrev={() => movePage("prev")}
                      onNext={() => movePage("next")}
                    />
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 px-4 pb-4 lg:min-h-0 lg:overflow-y-auto">
              {error ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive text-sm">
                  {(error as Error).message || "Failed to load books search results"}
                </div>
              ) : null}

              {isLoading && !result ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={`books-skeleton-${index}`} className="gap-2 py-3">
                      <CardHeader className="px-3">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 px-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[92%]" />
                        <Skeleton className="h-4 w-[88%]" />
                        <Skeleton className="h-28 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {!submitted && !isLoading ? (
                <div className="flex flex-col items-center gap-3 rounded-md border p-8 text-center">
                  <p className="text-muted-foreground text-sm">
                    Start with a query, then refine with filters.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {DEFAULT_SUGGESTED_QUERIES.map((suggestion) => (
                      <Button
                        key={suggestion}
                        onClick={() => submitSuggestedQuery(suggestion)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {submitted && result && result.hits.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-md border p-6 text-center">
                  <p className="font-medium text-sm">No results for this query/filter set.</p>
                  <p className="text-muted-foreground text-sm">
                    Try a broader query or clear some filters.
                  </p>
                </div>
              ) : null}

              {result?.hits.map((hit) => (
                <HitCard
                  key={hit.id}
                  hit={hit}
                  resolveBookName={(code) => bookNameByCode.get(code) ?? code}
                />
              ))}

              {result && result.hits.length > 0 ? (
                <div className="flex justify-end pt-2">
                  <PaginationControls
                    hasPrevPage={hasPrevPage}
                    hasNextPage={hasNextPage}
                    onPrev={() => movePage("prev")}
                    onNext={() => movePage("next")}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
