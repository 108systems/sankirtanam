export async function GET(request: Request) {
  return Response.json({ ok: true, origin: request.url});
}
