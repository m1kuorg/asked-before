// POST /api/group. A placeholder until m1kuorg/basics#28 lands.

export async function group(_request: Request): Promise<Response> {
  return Response.json({ error: "Grouping isn't built yet." }, { status: 501 });
}
