import { ENG_BOOK_CODES, RUS_BOOK_CODES } from "@/books/book-codes";

const buildSearchDescription = () => {
  const eng = ENG_BOOK_CODES.join(", ");
  const rus = RUS_BOOK_CODES.join(", ");
  return [
    "Search and read Srila Prabhupada books.",
    "At least one selector is required: q, books, song, chapter, or verses.",
    `For lang=eng use book codes: ${eng}.`,
    `For lang=rus use book codes: ${rus}.`,
  ].join(" ");
};

export const createOpenApiDocument = (origin: string) => {
  return {
    openapi: "3.1.0",
    info: {
      title: "Sankirtanam Books API",
      version: "1.0.0",
      description:
        "Public API for searching and reading Srila Prabhupada books, plus MCP transport.",
    },
    servers: [
      {
        url: origin,
      },
    ],
    tags: [
      { name: "books", description: "Books catalog and search endpoints" },
      { name: "mcp", description: "Model Context Protocol transport endpoint" },
    ],
    paths: {
      "/api/v1": {
        get: {
          tags: ["books"],
          summary: "Discovery entrypoint",
          description: "Returns API links and quick usage examples.",
          responses: {
            "200": {
              description: "Discovery metadata",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/books": {
        get: {
          tags: ["books"],
          summary: "List supported book codes",
          responses: {
            "200": {
              description: "Book code catalog by language",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/BooksCatalogResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/books/search": {
        get: {
          tags: ["books"],
          summary: "Search and read books",
          description: buildSearchDescription(),
          parameters: [
            {
              name: "q",
              in: "query",
              required: false,
              description: "Search text. Supports OR variants with `||`.",
              schema: { type: "string", minLength: 1, maxLength: 200 },
            },
            {
              name: "lang",
              in: "query",
              required: false,
              description: "Language. Defaults to eng.",
              schema: {
                type: "string",
                enum: ["en", "ru", "eng", "rus"],
                default: "eng",
              },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
            },
            {
              name: "offset",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 0, maximum: 5000, default: 0 },
            },
            {
              name: "text",
              in: "query",
              required: false,
              description: "Text payload mode.",
              schema: {
                type: "string",
                enum: ["full", "snippet", "none"],
                default: "snippet",
              },
            },
            {
              name: "books",
              in: "query",
              required: false,
              description: "Comma-separated book codes, e.g. BG,SB,CC.",
              schema: { type: "string" },
            },
            {
              name: "song",
              in: "query",
              required: false,
              schema: { type: "string", minLength: 1, maxLength: 50 },
            },
            {
              name: "chapter",
              in: "query",
              required: false,
              schema: { type: "string", minLength: 1, maxLength: 50 },
            },
            {
              name: "verses",
              in: "query",
              required: false,
              description:
                "Comma-separated exact verse IDs, e.g. SB-1-1-1,BG-2-47.",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Search/read results",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", const: true },
                      data: {
                        type: "object",
                        additionalProperties: true,
                      },
                    },
                    required: ["ok", "data"],
                  },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", const: false },
                      error: { type: "string", const: "VALIDATION_ERROR" },
                      issues: { type: "object", additionalProperties: true },
                    },
                    required: ["ok", "error", "issues"],
                  },
                },
              },
            },
            "500": {
              description: "Search failure",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", const: false },
                      error: { type: "string", const: "BOOKS_SEARCH_FAILED" },
                    },
                    required: ["ok", "error"],
                  },
                },
              },
            },
          },
        },
      },
      "/api/mcp": {
        get: {
          tags: ["mcp"],
          summary: "MCP transport endpoint",
          description:
            "Model Context Protocol endpoint. Supports GET/POST/DELETE per server/client transport needs.",
          responses: {
            "200": { description: "MCP response stream or JSON response" },
            "401": { description: "Unauthorized when BOOKS_MCP_TOKEN is set" },
          },
        },
        post: {
          tags: ["mcp"],
          summary: "MCP transport endpoint",
          responses: {
            "200": { description: "MCP JSON-RPC response" },
            "401": { description: "Unauthorized when BOOKS_MCP_TOKEN is set" },
          },
        },
        delete: {
          tags: ["mcp"],
          summary: "MCP transport endpoint",
          responses: {
            "200": { description: "MCP session teardown response" },
            "401": { description: "Unauthorized when BOOKS_MCP_TOKEN is set" },
          },
        },
      },
    },
    components: {
      schemas: {
        BookCodeEntry: {
          type: "object",
          properties: {
            code: { type: "string" },
            name: { type: "string" },
          },
          required: ["code", "name"],
        },
        BooksCatalogResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", const: true },
            data: {
              type: "object",
              properties: {
                eng: {
                  type: "array",
                  items: { $ref: "#/components/schemas/BookCodeEntry" },
                },
                rus: {
                  type: "array",
                  items: { $ref: "#/components/schemas/BookCodeEntry" },
                },
              },
              required: ["eng", "rus"],
            },
          },
          required: ["ok", "data"],
        },
      },
    },
  };
};
