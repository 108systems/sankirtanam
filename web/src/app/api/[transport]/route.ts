import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { BOOKS_TOOL_DESCRIPTION } from "@/books/book-codes";
import { booksToolInputSchema, type BooksToolInput } from "@/books/api-schema";
import { logger } from "@/books/logger";
import { queryBooks } from "@/books/search-books";

export const runtime = "nodejs";

const log = logger.child({ module: "books-next/mcp-route" });

// Keep MCP-exposed schema simple for maximum client compatibility.
const booksToolWireInputSchema = {
  lang: z.enum(["en", "ru", "eng", "rus"]).optional().nullable(),
  q: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(50).optional().nullable(),
  offset: z.number().int().min(0).max(5000).optional().nullable(),
  text: z.enum(["full", "snippet", "none"]).optional().nullable(),
  books: z.array(z.string()).optional().nullable(),
  song: z.string().optional().nullable(),
  chapter: z.string().optional().nullable(),
  verses: z.array(z.string()).optional().nullable(),
};

const mcpHandler = createMcpHandler(
  async (server) => {
    server.registerTool(
      "books",
      {
        description: BOOKS_TOOL_DESCRIPTION,
        inputSchema: booksToolWireInputSchema,
      },
      async (args) => {
        const parsed = booksToolInputSchema.parse(args as BooksToolInput);

        const output = await queryBooks({
          lang: parsed.lang,
          q: parsed.q,
          limit: parsed.limit ?? 5,
          offset: parsed.offset ?? 0,
          text: parsed.text ?? "snippet",
          books: parsed.books,
          song: parsed.song,
          chapter: parsed.chapter,
          verses: parsed.verses,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
        };
      }
    );
  },
  {
    capabilities: { tools: {} },
  },
  {
    basePath: "/api",
    verboseLogs: true,
    disableSse: true,
  }
);

const authorize = (request: Request): Response | null => {
  const expectedToken = process.env.BOOKS_MCP_TOKEN?.trim();
  if (!expectedToken) {
    return null;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token !== expectedToken) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  return null;
};

const withAuth = async (request: Request) => {
  log.info(
    {
      method: request.method,
      url: request.url,
      accept: request.headers.get("accept"),
      contentType: request.headers.get("content-type"),
      mcpSessionId: request.headers.get("mcp-session-id"),
    },
    "MCP request received"
  );

  const unauthorized = authorize(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    return await mcpHandler(request);
  } catch (error) {
    log.error(
      { error, method: request.method, url: request.url },
      "MCP route failed"
    );
    return Response.json({ ok: false, error: "MCP_ROUTE_FAILED" }, { status: 500 });
  }
};

export async function GET(request: Request) {
  return withAuth(request);
}

export async function POST(request: Request) {
  return withAuth(request);
}

export async function DELETE(request: Request) {
  return withAuth(request);
}
