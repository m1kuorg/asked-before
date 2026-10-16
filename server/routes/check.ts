// POST /api/check. A placeholder until m1kuorg/basics#27 lands.

export async function check(_request: Request): Promise<Response> {
  return Response.json({ error: "Checking an answer isn't built yet." }, { status: 501 });
}
