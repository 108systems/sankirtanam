import { ENG_BOOK_ENTRIES, RUS_BOOK_ENTRIES } from "@/books/book-codes";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    data: {
      eng: ENG_BOOK_ENTRIES.map(([code, name]) => ({ code, name })),
      rus: RUS_BOOK_ENTRIES.map(([code, name]) => ({ code, name })),
    },
  });
}
