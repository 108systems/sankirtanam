import { booksQuerySchema } from "@/books/api-schema";
import { queryBooks } from "@/books/search-books";
import { logger } from "@/books/logger";

export const runtime = "nodejs";

const log = logger.child({ module: "books-next/api/v1/books/search" });

export async function GET(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsedQuery = booksQuerySchema.safeParse(query);

  if (!parsedQuery.success) {
    return Response.json(
      {
        ok: false,
        error: "VALIDATION_ERROR",
        issues: parsedQuery.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const data = await queryBooks(parsedQuery.data);
    return Response.json({ ok: true, data });
  } catch (error) {
    log.error({ error, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, "books-next search failed");
    return Response.json(
      {
        ok: false,
        error: "BOOKS_SEARCH_FAILED",
      },
      { status: 500 }
    );
  }
}
