import { createOpenApiDocument } from "@/books/openapi";

export const runtime = "nodejs";

const buildLinkHeader = (origin: string) => {
  const openApiUrl = `${origin}/api/v1/openapi.json`;
  const docsUrl = `${origin}/books`;
  const metaUrl = `${origin}/api/v1`;
  return [
    `<${openApiUrl}>; rel="service-desc"; type="application/vnd.oai.openapi+json"`,
    `<${docsUrl}>; rel="service-doc"; type="text/html"`,
    `<${metaUrl}>; rel="service-meta"; type="application/json"`,
  ].join(", ");
};

const toDiscoveryPayload = (origin: string) => ({
  ok: true,
  data: {
    name: "Sankirtanam Books API",
    apiVersion: "v1",
    links: {
      self: `${origin}/api/v1`,
      openapi: `${origin}/api/v1/openapi.json`,
      openapiAlias: `${origin}/openapi.json`,
      books: `${origin}/api/v1/books`,
      search: `${origin}/api/v1/books/search`,
      mcp: `${origin}/api/mcp`,
      ui: `${origin}/books`,
    },
    capabilities: {
      transport: ["rest", "mcp"],
      auth: {
        rest: "public",
        mcp: "optional bearer token via BOOKS_MCP_TOKEN",
      },
    },
    examples: {
      search:
        "curl -sS 'https://sankirtan.am/api/v1/books/search?lang=eng&q=Krishna&books=ISO&limit=3&text=snippet'",
      read:
        "curl -sS 'https://sankirtan.am/api/v1/books/search?lang=eng&verses=BG-1-2-47&text=full'",
    },
  },
});

const getOrigin = (request: Request) =>
  process.env.SITE_URL || new URL(request.url).origin;

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const payload = toDiscoveryPayload(origin);
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    link: buildLinkHeader(origin),
  });
  return new Response(JSON.stringify(payload), { status: 200, headers });
}

export async function OPTIONS(request: Request) {
  const origin = getOrigin(request);
  const headers = new Headers({
    allow: "GET,OPTIONS",
    link: buildLinkHeader(origin),
  });
  const payload = {
    ok: true,
    data: {
      methods: ["GET", "OPTIONS"],
      openapi: `${origin}/api/v1/openapi.json`,
      routes: Object.keys(createOpenApiDocument(origin).paths),
    },
  };
  return new Response(JSON.stringify(payload), { status: 200, headers });
}
