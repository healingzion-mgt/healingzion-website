export async function onRequestGet(context) {
  const { env } = context;
  const row = await env.DB.prepare(`SELECT COUNT(*) as count FROM followers`).first();
  return jsonResponse({ ok: true, follower_count: row.count });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return jsonResponse({ ok: false, error: "Please enter a valid email" }, 400);
    }

    const existing = await env.DB.prepare(
      `SELECT id FROM followers WHERE email = ?`
    ).bind(email).first();

    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO followers (email) VALUES (?)`
      ).bind(email).run();
    }

    const row = await env.DB.prepare(`SELECT COUNT(*) as count FROM followers`).first();
    return jsonResponse({ ok: true, already_following: !!existing, follower_count: row.count });
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
