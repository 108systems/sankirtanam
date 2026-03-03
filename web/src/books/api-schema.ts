import { z } from "zod";
import { BOOKS_FILTER_DESCRIPTION } from "./book-codes";

const languageSchema = z
  .enum(["en", "ru", "eng", "rus"])
  .optional()
  .default("eng")
  .transform((value) => (value === "ru" || value === "rus" ? "rus" : "eng"));

const textModeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["full", "snippet", "none"]).optional().default("snippet")
);

const listFromQuerySchema = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined
  );

const optionalCleanStringSchema = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      if (typeof value !== "string") {
        return value;
      }

      const cleaned = value.trim();
      return cleaned.length > 0 ? cleaned : undefined;
    },
    z.string().min(1).max(max).optional()
  );

const optionalCleanStringArraySchema = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      if (!Array.isArray(value)) {
        return value;
      }

      const cleaned = value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);

      return cleaned.length > 0 ? cleaned : undefined;
    },
    z.array(z.string().min(1).max(max)).optional()
  );

const toolLanguageSchema = z
  .enum(["en", "ru", "eng", "rus"])
  .nullable()
  .optional()
  .transform((value) => (value === "ru" || value === "rus" ? "rus" : "eng"));

const toolNullableNumberSchema = (min: number, max: number) =>
  z
    .number()
    .int()
    .min(min)
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === null || value === undefined ? undefined : value));

const toolNullableTextModeSchema = z
  .union([z.enum(["full", "snippet", "none"]), z.null()])
  .optional()
  .transform((value) => (value === null || value === undefined ? undefined : value));

const toolNullableCleanStringSchema = (max: number) =>
  z
    .union([optionalCleanStringSchema(max), z.null()])
    .transform((value) => (value === null ? undefined : value));

const toolNullableCleanStringArraySchema = (max: number) =>
  z
    .union([optionalCleanStringArraySchema(max), z.null()])
    .transform((value) => (value === null ? undefined : value));

const booksInputBaseSchema = z.object({
  q: optionalCleanStringSchema(200),
  lang: languageSchema,
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  offset: z.coerce.number().int().min(0).max(5000).optional().default(0),
  text: textModeSchema,
  books: listFromQuerySchema,
  song: optionalCleanStringSchema(50),
  chapter: optionalCleanStringSchema(50),
  verses: listFromQuerySchema,
});

const applyBooksSelectorRules = <
  T extends {
    q?: string;
    books?: string[];
    song?: string;
    chapter?: string;
    verses?: string[];
  },
>(
  value: T,
  ctx: z.RefinementCtx
) => {
  const hasBooksFilter = Boolean(value.books?.length || value.song || value.chapter);
  const hasVerses = Boolean(value.verses?.length);
  const hasQuery = Boolean(value.q);

  if (!(hasVerses || hasQuery || hasBooksFilter)) {
    ctx.addIssue({
      code: "custom",
      message:
        "Provide at least one selector: q, books, song, chapter, or verses.",
      path: ["q"],
    });
  }
};

export const booksQuerySchema = booksInputBaseSchema.strict().superRefine(
  applyBooksSelectorRules
);

export type BooksQueryInput = z.input<typeof booksQuerySchema>;
export type BooksQuery = z.infer<typeof booksQuerySchema>;

export const booksToolInputSchema = z
  .object({
    lang: toolLanguageSchema,
    q: toolNullableCleanStringSchema(200).describe(
      "Search query text. If provided, runs BM25 search mode."
    ),
    limit: toolNullableNumberSchema(1, 50),
    offset: toolNullableNumberSchema(0, 5000),
    text: toolNullableTextModeSchema.describe(
      "Text payload mode: full | snippet | none. full includes translation + purport + synonyms + translit + sanskrit; snippet includes translation + purportSnippet metrics."
    ),
    books: toolNullableCleanStringArraySchema(50).describe(
      `${BOOKS_FILTER_DESCRIPTION} Use for multi-book search.`
    ),
    song: toolNullableCleanStringSchema(50).describe(
      "Song/canto/year level filter. Omit if unknown."
    ),
    chapter: toolNullableCleanStringSchema(50).describe(
      "Chapter/month level filter. Omit if unknown."
    ),
    verses: toolNullableCleanStringArraySchema(150).describe(
      "Exact verse ids for direct read mode, e.g. [\"SB-1-1-1\", \"BG-2-47\"]."
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    applyBooksSelectorRules(value, ctx);
  });

export type BooksToolInput = z.infer<typeof booksToolInputSchema>;
