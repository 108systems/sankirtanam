import type { Language } from "./books/search-books";

const parseWarmLangs = (): Language[] => {
  const configured = (process.env.BOOKS_WARM_LANGS || "eng,rus")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configured.filter((value): value is Language => value === "eng" || value === "rus");
};

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { warmBooksData } = await import("./books/search-books");
  const { logger } = await import("./books/logger");
  const log = logger.child({ module: "books-next/instrumentation" });

  const langs = parseWarmLangs();
  if (langs.length === 0) {
    log.info("BOOKS_WARM_LANGS empty; skipping books warmup");
    return;
  }

  try {
    await warmBooksData(langs);
    log.info({ langs }, "books-next warmup completed");
  } catch (error) {
    // Do not crash startup during experiment mode; route handlers will still report explicit errors.
    log.error({ error, langs }, "books-next warmup failed");
  }
}
