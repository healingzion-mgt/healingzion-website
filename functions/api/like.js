export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return jsonResponse({ ok: false, error: "Missing slug" }, 400);

  const row = await env.DB.prepare(
    `SELECT love_count FROM likes WHERE guide_slug = ?`
  ).bind(slug).first();

  return jsonResponse({ ok: true, slug, love_count: row ? row.love_count : 0 });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const slug = (body.slug || "").slice(0, 200);
    if (!slug) return jsonResponse({ ok: false, error: "Missing slug" }, 400);

    await env.DB.prepare(
      `INSERT INTO likes (guide_slug, love_count) VALUES (?, 1)
       ON CONFLICT(guide_slug) DO UPDATE SET love_count = love_count + 1`
    ).bind(slug).run();

    const row = await env.DB.prepare(
      `SELECT love_count FROM likes WHERE guide_slug = ?`
    ).bind(slug).first();

    return jsonResponse({ ok: true, slug, love_count: row.love_count });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
