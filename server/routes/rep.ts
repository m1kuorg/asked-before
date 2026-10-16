// POST /api/rep. A placeholder until m1kuorg/basics#27 lands.

export async function rep(_request: Request): Promise<Response> {
  return Response.json({ error: "Writing a rep isn't built yet." }, { status: 501 });
}
